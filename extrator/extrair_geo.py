# -*- coding: utf-8 -*-
"""Extrator determinístico (sem IA, sem internet) por GEOMETRIA.

Ideia: cada página tem 2 colunas. Dentro de cada coluna, linhas finas horizontais
separam "blocos" (texto-base + comando + itens). Os itens são achados pelo número
sequencial no começo da linha (1, 2, 3...) e cada item recebe o intervalo vertical
(página, coluna, bbox) onde está. O que vem antes do 1.º item do bloco é o texto-base
(contexto); figuras são ligadas ao item/contexto pela posição.
"""
import hashlib
import re
import sys
from pathlib import Path

import pdfplumber

from extrair import mesclar, achar_figuras, _texto_chars
import ids

DPI = 150
ESC = DPI / 72.0

RE_CAB = re.compile(
    r"CEBRASPE\s*[–-]\s*UnB|CESPE\s*\|\s*CEBRASPE|^\d{10,}\b|"
    r"Subprograma\s+\d{4}\s*[–-]\s*Terceira\s+Etapa|Caderno:\s*\w+\s*[–-]\s*\d+|\s[–-]\s*\d+\s*[–-]\s*$", re.I)
RE_LIXO = re.compile(
    r"^(Espa[çc]o livre|Rascunho|O espa[çc]o reservado.*|Caso o utilize.*|\(?N[ãa]o se esque[çc]a.*|"
    r"Caderno de Respostas\.?|[—–-]|[–-]\s*\d+\s*[–-])$", re.I)
RE_SO_NUM = re.compile(r"^\d{1,2}$")
RE_JULGUE = re.compile(r"\b(julg\w+|judge|jugez|juzgue|propositions|affirmations|proposi[çc][õo]es|"
                       r"according to the text|it can be concluded|de acuerdo con el texto|seg[úu]n el texto|con relaci[óo]n|"
                       r"d['’]apr[èe]s le texte|selon le texte|de acordo com o texto|com base no texto|tendo como refer[êe]ncia|"
                       r"considerando|based on|bas[áa]ndose)\b", re.I)
RE_FIG = re.compile(r"\b(figura|gr[áa]fico|tabela|ilustra[çc][ãa]o|imagem|charge|diagrama|esquema|circuito|"
                    r"cartum|obra|pintura|escultura|fotografia|mapa)\b", re.I)
RE_TERMINAL = re.compile(r"[.!?:;»”\"\)]\s*$")
LINGUAS = {"ESPANHOLA": "esp", "FRANCESA": "fra", "INGLESA": "ing"}
TIPO_COD = {"A": "certo_errado", "B": "numerica", "C": "multipla_escolha", "D": "discursiva"}


# ------------------------------------------------------------------ utilidades
def _cy(c):
    return (c["top"] + c["bottom"]) / 2


def _dentro(c, caixas):
    cx, cy = (c["x0"] + c["x1"]) / 2, _cy(c)
    return any(b[0] - 1 <= cx <= b[2] + 1 and b[1] - 1 <= cy <= b[3] + 1 for b in caixas)


def detectar_banners(words):
    """Acha faixas 'PARTE I', 'LÍNGUA FRANCESA', 'REDAÇÃO EM LÍNGUA...' (page-level, linha a linha)."""
    ws = sorted(words, key=lambda w: (round(w["top"] / 3), w["x0"]))
    linhas, atual = [], []
    for w in ws:
        if atual and abs(w["top"] - atual[0]["top"]) > 3:
            linhas.append(atual)
            atual = []
        atual.append(w)
    if atual:
        linhas.append(atual)
    achados, remover = [], []
    for ln in linhas:
        ln = sorted(ln, key=lambda w: w["x0"])
        i = 0
        while i < len(ln):
            t = ln[i]["text"]
            prox = ln[i + 1]["text"] if i + 1 < len(ln) else ""
            ban = None
            if t == "PARTE" and re.fullmatch(r"I{1,2}|[12]", prox):
                ban = ("parte", {"I": 1, "II": 2, "1": 1, "2": 2}[prox], 2)
            elif t in ("LÍNGUA", "LINGUA") and prox in LINGUAS:
                ban = ("lingua", LINGUAS[prox], 2)
            elif t == "REDAÇÃO" and prox == "EM":
                ban = ("redacao", None, 1)
            if ban:
                tipo, val, n = ban
                grp = ln[i:i + n]
                x0, x1 = min(w["x0"] for w in grp), max(w["x1"] for w in grp)
                top, bot = min(w["top"] for w in grp), max(w["bottom"] for w in grp)
                achados.append({"tipo": tipo, "valor": val, "x": (x0 + x1) / 2, "y": top})
                remover.append((x0, top, x1, bot))
                i += n
            else:
                i += 1
    return achados, remover


def montar_linhas(chars):
    """Agrupa caracteres em linhas; índices/expoentes (fonte pequena) entram na linha principal."""
    if not chars:
        return []
    tam = sorted(c["size"] for c in chars)[len(chars) // 2]
    grandes = sorted((c for c in chars if c["size"] >= 0.8 * tam), key=_cy)
    peq = [c for c in chars if c["size"] < 0.8 * tam]
    cl = []
    for c in grandes:
        if cl and abs(_cy(c) - cl[-1]["cy"]) <= 0.55 * tam:
            cl[-1]["g"].append(c)
            cl[-1]["cy"] = _cy(c)
        else:
            cl.append({"g": [c], "p": [], "cy": _cy(c)})
    sozinhas = []
    for c in peq:
        melhor = min(cl, key=lambda k: abs(k["cy"] - _cy(c)), default=None)
        if melhor is not None and abs(melhor["cy"] - _cy(c)) <= 0.9 * tam:
            melhor["p"].append(c)
        else:
            sozinhas.append(c)
    # linhas só de fonte pequena (avisos, legendas) viram linhas próprias
    for c in sorted(sozinhas, key=_cy):
        if cl and any(k.get("so_peq") and abs(k["cy"] - _cy(c)) <= 0.9 * tam for k in cl):
            next(k for k in cl if k.get("so_peq") and abs(k["cy"] - _cy(c)) <= 0.9 * tam)["g"].append(c)
        else:
            cl.append({"g": [c], "p": [], "cy": _cy(c), "so_peq": True})
    saida = []
    for k in cl:
        x0g = min(c["x0"] for c in k["g"])
        extra = [c for c in k["p"] if c["x0"] >= x0g - 0.5 or (c["text"].isdigit() and c["size"] >= 6.8)]  # numeração de linha (<6,8pt, à esquerda) é descartada; número de item (>=6,8pt) fica
        todos = k["g"] + extra
        txt = _texto_chars(todos)
        if not txt:
            continue
        saida.append({
            "text": txt, "x0": min(c["x0"] for c in todos), "x1": max(c["x1"] for c in todos),
            "top": min(c["top"] for c in todos), "bottom": max(c["bottom"] for c in todos),
            "size": tam, "first_size": min(k["g"], key=lambda c: c["x0"])["size"],
        })
    return sorted(saida, key=lambda l: l["top"])


# ------------------------------------------------------------------ página -> eventos
def eventos_da_pagina(page, num_pag):
    """Lista de eventos em ordem de leitura: (col, y, tipo, dados)."""
    W, H = page.width, page.height
    mid = W / 2
    words = page.extract_words(extra_attrs=["size"])
    banners, remover = detectar_banners(words)
    chars = [c for c in page.chars if 24 <= _cy(c) <= H - 30 and not _dentro(c, remover)]
    figs = achar_figuras(page, 24, H - 30)
    ev = []
    for col in (0, 1):
        cc = [c for c in chars if ((c["x0"] + c["x1"]) / 2 < mid) == (col == 0)]
        linhas = montar_linhas(cc)
        linhas = [l for l in linhas if not RE_CAB.search(l["text"])]
        if linhas:
            xs = sorted(l["x0"] for l in linhas if len(l["text"]) >= 8 and l["top"] < H - 45) or [min(l["x0"] for l in linhas)]
            margem = xs[0]
        else:
            margem = 0
        for l in linhas:
            l.update(pagina=num_pag, col=col, margem=margem)
            ev.append((col, l["top"], 1, "linha", l))
    for f in figs:
        col = 0 if (f[0] + f[2]) / 2 < mid else 1
        ev.append((col, f[1], 0, "fig", {"bbox": f, "pagina": num_pag, "col": col}))
    # linhas finas que separam blocos (>= 85% da largura da coluna)
    for r in list(page.rects) + list(page.lines):
        if (r["bottom"] - r["top"]) < 3.5 and 50 < r["top"] < H - 60:
            for col, (cx0, cx1) in enumerate(((0, mid), (mid, W))):
                if min(r["x1"], cx1) - max(r["x0"], cx0) >= 225:
                    ev.append((col, (r["top"] + r["bottom"]) / 2, -1, "regra", {}))
    for b in banners:
        col = 0 if (b["x"] < mid + 30 or b["y"] < 90) else 1
        ev.append((col, b["y"], -2, "banner", b))
    ev.sort(key=lambda e: (e[0], e[1], e[2]))
    # marca 1.º evento de cada coluna da página
    visto = set()
    out = []
    for col, y, _, tipo, d in ev:
        if col not in visto and tipo in ("linha", "fig"):
            visto.add(col)
            out.append(("topo_coluna", {}))
        out.append((tipo, d))
    return out


# ------------------------------------------------------------------ máquina de estados
class Bloco:
    def __init__(self, lingua, parte):
        self.lingua, self.parte = lingua, parte
        self.ctx = {"linhas": [], "figs": []}
        self.itens = []

    def aberto(self):
        return self.itens[-1] if self.itens else self.ctx


def _vazio(o):
    return not o["linhas"] and not o["figs"]


def eh_inicio(d, esperado):
    """A linha é o começo do item `esperado`? (número no início, na margem da coluna)"""
    t = d["text"]
    m = re.match(r"^(\d{1,3})\s+\S", t) or re.match(r"^(\d{1,3})$", t)
    return bool(m and int(m.group(1)) == esperado and d["first_size"] >= 6.8 and d["x0"] <= d["margem"] + 8
                and not re.match(r"^\d{1,3}\s*(e|a|à|y|et|and|to|,|ou)\s+\d", t)
                and not re.match(r"^\d{1,3}\s+(e|y|et|and|ou)\s+[a-zà-ú]", t))


def segmentar(pdf):
    """Percorre o PDF e devolve blocos [{lingua, parte, ctx, itens}] e avisos."""
    avisos = []
    blocos, pendente = [], {"linhas": [], "figs": []}
    estado = {"esp": 1, "lingua": None, "parte": None, "fim": False}
    atual = Bloco(None, None)
    topo = False
    ultima_linha = None

    def fechar():
        nonlocal atual, pendente
        if atual.itens:
            atual.ctx = {"linhas": pendente["linhas"] + atual.ctx["linhas"],
                         "figs": pendente["figs"] + atual.ctx["figs"]}
            pendente = {"linhas": [], "figs": []}
            blocos.append(atual)
        elif not _vazio(atual.ctx):
            pendente["linhas"] += atual.ctx["linhas"]
            pendente["figs"] += atual.ctx["figs"]
        atual = Bloco(estado["lingua"], estado["parte"])

    for i, page in enumerate(pdf.pages):
        if estado["fim"]:
            break
        if len(page.chars) < 30:
            avisos.append({"pagina": i + 1, "aviso": "pagina_sem_texto (capa ou escaneada; OCR não aplicado nesta etapa)"})
            continue
        for tipo, d in eventos_da_pagina(page, i + 1):
            if estado["fim"]:
                break
            if tipo == "topo_coluna":
                topo = True
                continue
            if tipo == "banner":
                if d["tipo"] == "redacao":
                    fechar()
                    estado["fim"] = True
                    continue
                fechar()
                if d["tipo"] == "lingua":
                    pendente = {"linhas": [], "figs": []}
                    estado["lingua"], estado["esp"] = d["valor"], 1
                else:
                    estado["parte"] = d["valor"]
                    if d["valor"] == 2:
                        estado["lingua"] = None
                atual.lingua, atual.parte = estado["lingua"], estado["parte"]
                continue
            if tipo == "regra":
                fechar()
                continue
            # decisão ao entrar numa coluna nova: continua o bloco ou começa outro?
            if topo:
                topo = False
                if atual.itens:
                    if tipo == "fig":
                        fechar()
                    else:
                        t0 = d["text"]
                        cont = (t0[:1].islower() or not (ultima_linha and RE_TERMINAL.search(ultima_linha))
                                or eh_inicio(d, estado["esp"]))
                        if not cont:
                            fechar()
            if tipo == "fig":
                atual.aberto()["figs"].append(d)
                continue
            t = d["text"]
            if re.search(r"^\(?N[ãa]o se esque[çc]a.*transcre|^O espa[çc]o reservado acima|transcrever a sua resposta|transcrever (o )?seu texto", t, re.I):
                if not atual.itens and blocos and blocos[-1].itens:
                    blocos[-1].itens[-1]["dica_d"] = True   # a grade de rascunho fecha o bloco antes do aviso
                else:
                    atual.aberto()["dica_d"] = True
                continue
            if RE_LIXO.match(t):
                continue
            m = re.match(r"^(\d{1,3})", t)
            if eh_inicio(d, estado["esp"]):
                atual.itens.append({"numero": int(m.group(1)), "linhas": [d], "figs": [],
                                    "lingua": estado["lingua"], "parte": estado["parte"]})
                estado["esp"] += 1
                continue
            if RE_SO_NUM.match(t):          # números soltos da grade de rascunho
                continue
            ultima_linha = t
            atual.aberto()["linhas"].append(d)
    fechar()
    return blocos, avisos


# ------------------------------------------------------------------ texto, tipo, opções
def limpar(t):
    """Reagrupa linhas de prosa em parágrafos; preserva versos (linhas curtas)."""
    linhas = [re.sub(r"[ \t]+", " ", l).strip() for l in t.split("\n") if l.strip()]
    if not linhas:
        return ""
    maxlen = max(len(l) for l in linhas)
    saida = [linhas[0]]
    for l in linhas[1:]:
        ant = saida[-1]
        if len(ant) >= 0.88 * maxlen and not re.search(r"[.!?:;»”\"]$", ant):
            saida[-1] = (ant[:-1] + l) if ant.endswith("-") and l[:1].islower() else ant + " " + l
        else:
            saida.append(l)
    return "\n".join(saida)


def texto_das_linhas(linhas, tirar_numero=False):
    ls = [l["text"] for l in linhas]
    while ls and RE_SO_NUM.match(ls[-1]):   # grade numerada de rascunho (1..10)
        ls.pop()
    if tirar_numero and ls:
        ls[0] = re.sub(r"^\d{1,3}\s*", "", ls[0])
    return ls


def separar_opcoes(ls):
    """Alternativas A–D no começo de linha, em ordem."""
    pos, letra = [], "A"
    for i, l in enumerate(ls):
        if i > 0 and re.match(rf"^{letra}\s+\S", l):
            pos.append(i)
            letra = chr(ord(letra) + 1)
            if letra == "E":
                break
    if len(pos) == 4:
        ops = []
        for k, p in enumerate(pos):
            fim = pos[k + 1] if k + 1 < 4 else len(ls)
            ops.append({"letra": "ABCD"[k], "texto": re.sub(r"\s+", " ", " ".join(ls[p:fim])[1:]).strip()})
        return ls[:pos[0]], ops
    return ls, None


def tipos_declarados(texto):
    """'... no item 26, que é do tipo C' -> {26:'C'}; 'itens 92 e 93 ... tipo B' -> {92:'B',93:'B'}."""
    out = {}
    t = re.sub(r"\s+", " ", texto)
    for m in re.finditer(r"tipo\s+([ABCD])\b", t, re.I):
        antes = t[:m.start()]
        k = max(antes.lower().rfind("item"), antes.lower().rfind("ítem"), antes.lower().rfind("itens"))
        if k < 0:
            continue
        trecho = antes[k:]
        if not re.search(r"\d", trecho):
            out["*"] = m.group(1).upper()
            continue
        nums = set()
        for r in re.finditer(r"(\d+)\s*(?:a|à|al|to)\s*(\d+)", trecho):
            nums.update(range(int(r.group(1)), int(r.group(2)) + 1))
        for n in re.findall(r"\d+", re.sub(r"(\d+)\s*(?:a|à|al|to)\s*(\d+)", "", trecho)):
            nums.add(int(n))
        for n in nums:
            out[n] = m.group(1).upper()
    return out


def decidir_tipo(numero, ctx_texto, ops, enun, declarados, primeiro=False, dica_d=False):
    motivos = []
    if numero in declarados:
        cod, orig = declarados[numero], "declarado"
    elif "*" in declarados and primeiro and not ops:
        cod, orig = declarados["*"], "declarado"
    elif ops:
        cod, orig = "C", "alternativas"
    elif re.search(r"(assinale|marque|indique|choose|select|signal[ea]|se[ñn]ale|signalez|cochez)\s+(a|the|la|l['’])?\s*(op[çc][ãa]o|option|opci[óo]n)", enun[:160], re.I):
        cod, orig = "C", "comando_assinale"
        motivos.append("tipo C pelo comando 'assinale a opção', mas as alternativas não são texto (imagem/fórmula)")
    elif dica_d:
        cod, orig = "D", "marcas_de_rascunho"
    elif re.search(r"\b(redija|expresse,? em um texto|represente,? no espa[çc]o|responda,? justificadamente|formulando hip[óo]teses|escreva,? no espa[çc]o)\b", enun, re.I):
        cod, orig = "D", "verbo_de_comando"
        motivos.append("tipo D deduzido do verbo de comando (sem declaração explícita)")
    elif re.search(r"parte fracion|fraction part|parte fraccion|partie fractionnaire|fra[cç][ãa]o", enun + ctx_texto, re.I) \
            and re.search(r"calcule|calculate|calcul|divida|divide|multiplique|multipl", enun, re.I):
        cod, orig = "B", "regra_numerica"
        motivos.append("tipo B deduzido do texto (sem declaração explícita)")
    elif RE_JULGUE.search(ctx_texto):
        cod, orig = "A", "comando_julgue"
    else:
        cod, orig = "A", "padrao"
        motivos.append("tipo duvidoso: sem declaração, sem alternativas e sem comando 'julgue'")
    if cod == "C" and not ops:
        motivos.append("tipo C declarado mas 4 alternativas não encontradas")
    if cod != "C" and ops:
        motivos.append(f"alternativas A–D encontradas mas tipo declarado é {cod}")
    return cod, orig, motivos


# ------------------------------------------------------------------ imagens
class Renderizador:
    def __init__(self, pdf, pasta):
        self.pdf, self.pasta, self.cache = pdf, Path(pasta), {}
        (self.pasta / "imagens").mkdir(parents=True, exist_ok=True)
        (self.pasta / "recortes").mkdir(parents=True, exist_ok=True)

    def pagina(self, n):
        if n not in self.cache:
            if len(self.cache) > 3:
                self.cache.pop(next(iter(self.cache)))
            self.cache[n] = self.pdf.pages[n - 1].to_image(resolution=DPI).original.convert("RGB")
        return self.cache[n]

    def recorte(self, n, bbox, pad=1):
        im = self.pagina(n)
        x0, t, x1, b = bbox
        box = (max(0, int((x0 - pad) * ESC)), max(0, int((t - pad) * ESC)),
               min(im.width, int((x1 + pad) * ESC)), min(im.height, int((b + pad) * ESC)))
        return im.crop(box)

    def salvar(self, imagens, nome, sub, max_larg=1000):
        from PIL import Image
        if not imagens:
            return None
        w = max(i.width for i in imagens)
        h = sum(i.height for i in imagens) + 6 * (len(imagens) - 1)
        tela = Image.new("RGB", (w, h), "white")
        y = 0
        for i in imagens:
            tela.paste(i, (0, y))
            y += i.height + 6
        if tela.width > max_larg:
            r = max_larg / tela.width
            tela = tela.resize((max_larg, max(1, int(tela.height * r))))
        dest = self.pasta / sub / f"{nome}.webp"
        tela.save(dest, "WEBP", quality=78)
        return f"{sub}/{dest.name}", tela.width, tela.height


def grupos_bbox(linhas, figs):
    """Une linhas e figuras em caixas por (página, coluna)."""
    g = {}
    for l in linhas:
        k = (l["pagina"], l["col"])
        b = g.setdefault(k, [l["x0"], l["top"], l["x1"], l["bottom"]])
        b[0], b[1], b[2], b[3] = min(b[0], l["x0"]), min(b[1], l["top"]), max(b[2], l["x1"]), max(b[3], l["bottom"])
    for f in figs:
        k = (f["pagina"], f["col"])
        x0, t, x1, bt = f["bbox"]
        b = g.setdefault(k, [x0, t, x1, bt])
        b[0], b[1], b[2], b[3] = min(b[0], x0), min(b[1], t), max(b[2], x1), max(b[3], bt)
    return sorted(g.items())


def ligar_figuras(rend, figs, prefixo):
    out = []
    for f in figs:
        h = hashlib.md5(f"{prefixo}|{f['pagina']}|{round(f['bbox'][0])}|{round(f['bbox'][1])}".encode()).hexdigest()[:10]
        im = rend.recorte(f["pagina"], f["bbox"], pad=2)
        r = rend.salvar([im], f"fig_{h}", "imagens")
        out.append({"src": r[0], "largura": r[1], "altura": r[2], "pagina": f["pagina"],
                    "bbox": [round(v, 1) for v in f["bbox"]]})
    return out


def proveniencia(pdf_nome, linhas, figs):
    return [{"pdf": pdf_nome, "pagina": p, "coluna": c, "bbox": [round(v, 1) for v in b]}
            for (p, c), b in grupos_bbox(linhas, figs)]


# ------------------------------------------------------------------ prova inteira
def inferir_meta(caminho, pdf):
    nome = Path(caminho).stem
    m = re.search(r"pas\s*-?\s*([123]).*?(20\d\d)", nome, re.I)
    etapa, ano = (int(m.group(1)), int(m.group(2))) if m else (None, None)
    sub = None
    for p in pdf.pages[:3]:
        mm = re.search(r"Subprograma\s*(20\d\d)", p.extract_text() or "", re.I)
        if mm:
            sub = int(mm.group(1))
            break
    return etapa, ano, sub


def extrair_prova(caminho, saida, etapa=None, ano=None, com_imagens=True):
    caminho = Path(caminho)
    with pdfplumber.open(caminho) as pdf:
        e0, a0, sub = inferir_meta(caminho, pdf)
        etapa, ano = etapa or e0, ano or a0
        if not etapa or not ano:
            raise ValueError("Não consegui descobrir etapa/ano pelo nome do arquivo; informe etapa e ano.")
        sub_esperado = int(ano) - 2 if etapa == 3 else None
        pid = ids.id_prova(etapa, ano)
        pasta = Path(saida) / pid
        pasta.mkdir(parents=True, exist_ok=True)
        blocos, avisos = segmentar(pdf)
        rend = Renderizador(pdf, pasta) if com_imagens else None
        contextos, questoes = [], []
        for bi, bl in enumerate(blocos, 1):
            ctx_ls = texto_das_linhas(bl.ctx["linhas"])
            ctx_txt = limpar("\n".join(ctx_ls))
            cid, ctx_imgs = None, []
            if ctx_txt or bl.ctx["figs"]:
                cid = ids.id_contexto(etapa, ano, bi, bl.lingua)
                ctx_imgs = ligar_figuras(rend, bl.ctx["figs"], cid) if rend else []
                crop = None
                if rend and (bl.ctx["linhas"] or bl.ctx["figs"]):
                    pecas = [rend.recorte(p, b) for (p, c), b in grupos_bbox(bl.ctx["linhas"], bl.ctx["figs"])]
                    r = rend.salvar(pecas, f"ctx_{cid}", "recortes")
                    crop = r[0] if r else None
                contextos.append({"id": cid, "text": ctx_txt, "images": [i["src"] for i in ctx_imgs],
                                  "crop_image": crop,
                                  "proveniencia": proveniencia(caminho.name, bl.ctx["linhas"], bl.ctx["figs"])})
            declarados = tipos_declarados(ctx_txt)
            for it in bl.itens:
                ls = texto_das_linhas(it["linhas"], tirar_numero=True)
                corpo, ops = separar_opcoes(ls)
                enun = limpar("\n".join(corpo)).replace("\n", " ").strip()
                cod, orig, motivos = decidir_tipo(it["numero"], ctx_txt, ops, enun, declarados, it is bl.itens[0], it.get("dica_d", False))
                qid = ids.id_questao(etapa, ano, it["numero"], it["lingua"])
                imgs = ligar_figuras(rend, it["figs"], qid) if rend else []
                crop = None
                if rend:
                    pecas = [rend.recorte(p, b) for (p, c), b in grupos_bbox(it["linhas"], it["figs"])]
                    r = rend.salvar(pecas, qid, "recortes")
                    crop = r[0] if r else None
                if re.search(r"\(cid:\d+\)", enun + " ".join(o["texto"] for o in (ops or []))):
                    motivos.append("símbolos matemáticos não decodificados no texto (use o recorte da prova)")
                if len(enun) < 15:
                    motivos.append(f"enunciado muito curto ({len(enun)} caracteres)")
                if len(enun) > 3000:
                    motivos.append(f"enunciado muito longo ({len(enun)} caracteres)")
                if ops and any(not o["texto"] for o in ops):
                    motivos.append("alternativa vazia")
                if not imgs and not ctx_imgs and RE_FIG.search(enun):
                    motivos.append("cita figura/gráfico/tabela mas não há imagem ligada ao item")
                if len(imgs) > 3:
                    motivos.append(f"{len(imgs)} figuras ligadas ao item")
                q = {
                    "id": qid, "prova": ids.nome_prova(etapa, ano), "etapa": f"PAS{etapa}", "ano": int(ano),
                    "subprograma": sub or sub_esperado, "numero": it["numero"],
                    "parte": it["parte"], "lingua": it["lingua"],
                    "tipo": TIPO_COD[cod], "tipo_origem": orig,
                    "enunciado": enun, "opcoes": ops or [],
                    "contexto_id": cid, "imagens": [i["src"] for i in imgs], "imagens_info": imgs,
                    "crop_image": crop, "gabarito": None, "status_gabarito": None,
                    "origem_extracao": "regra",
                    "proveniencia": proveniencia(caminho.name, it["linhas"], it["figs"]),
                    "fonte": "CEBRASPE/UnB",
                }
                if cod == "D":
                    q["gabarito_obs"] = "sem gabarito (discursiva)"
                q["revisar"] = bool(motivos)
                q["motivos_revisao"] = motivos
                questoes.append(q)
        # itens sem texto-base próprio herdam o contexto cujo cabeçalho cita o número ("itens de 47 a 54")
        faixas = []
        for c in contextos:
            lo_hi = [(int(a), int(b)) for a, b in re.findall(r"it\s?e\s?(?:n\s?s|m)\s+(?:de\s+)?(\d+)\s*(?:a|à|e|al|to|y)\s*(\d+)", c["text"], re.I)]
            if lo_hi:
                faixas.append((c["id"], min(x[0] for x in lo_hi), max(x[1] for x in lo_hi)))
        for q in questoes:
            if not q["contexto_id"]:
                lg = q["lingua"]
                cand = [f for f in faixas if f[1] <= q["numero"] <= f[2]
                        and (f[0].split("-")[2] in ids.LINGUA_NOME if False else True)
                        and (("-%s-" % lg in f[0]) if lg else not re.search(r"-(esp|fra|ing)-", f[0]))]
                if cand:
                    q["contexto_id"] = cand[-1][0]
                    q["contexto_herdado"] = True
        meta = {"pdf": caminho.name, "id_prova": pid, "etapa": etapa, "ano": int(ano), "subprograma": sub or sub_esperado,
                "subprograma_no_texto": sub, "paginas": len(pdf.pages), "avisos": avisos}
    return {"meta": meta, "contextos": contextos, "questoes": questoes}


if __name__ == "__main__":
    import json
    r = extrair_prova(sys.argv[1], sys.argv[2])
    (Path(sys.argv[2]) / r["meta"]["id_prova"] / "prova.json").write_text(
        json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
    print(len(r["questoes"]), "questões;", len(r["contextos"]), "contextos")
