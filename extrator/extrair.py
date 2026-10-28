#!/usr/bin/env python3
"""
extrair.py - Extrai questoes e figuras de provas do PAS/UnB (Cebraspe) em PDF.

Uso:
    python extrair.py provas/            # processa todos os PDFs da pasta
    python extrair.py provas/a.pdf b.pdf # ou arquivos especificos

Saida (pasta ./site/dados):
    questoes.json   -> contextos (texto-base) + questoes
    imagens/*.png   -> figuras recortadas das provas
"""
import json
import re
import sys
import hashlib
from pathlib import Path

import pdfplumber

SAIDA = Path(__file__).parent / "site" / "dados"
IMG_DIR = SAIDA / "imagens"
DPI = 170

RE_PARTE = re.compile(r"PARTE\s*[–\-]?\s*([12])", re.I)
RE_LINGUA = re.compile(r"^L[ÍI]NGUA(ESPANHOLA|FRANCESA|INGLESA)$", re.I)
RE_ROTULO = re.compile(r"(Edital|Aplica[çc][ãa]o)\s*:?\s*(\d{4})", re.I)
RE_LIXO = re.compile(
    r"^(Espa[çc]o livre|O espa[çc]o reservado.*|Caso o utilize.*|Caderno de Respostas\.?|"
    r"para o Caderno de Respostas\.?|Não se esque[çc]a.*|!FimDoTexto!)$", re.I)
RE_DISC = re.compile(r"^(explique|descreva|comente|justifique|redija|discorra|escreva)\b", re.I)


# ----------------------------------------------------------------- geometria
def _centro(o):
    return (o["x0"] + o["x1"]) / 2


def mesclar(caixas, folga=3):
    """Une caixas (x0,top,x1,bottom) que se tocam. Imagens fatiadas viram uma so."""
    caixas = [list(c) for c in caixas]
    mudou = True
    while mudou:
        mudou = False
        saida = []
        for c in caixas:
            for s in saida:
                if not (c[0] > s[2] + folga or c[2] < s[0] - folga or
                        c[1] > s[3] + folga or c[3] < s[1] - folga):
                    s[0], s[1] = min(s[0], c[0]), min(s[1], c[1])
                    s[2], s[3] = max(s[2], c[2]), max(s[3], c[3])
                    mudou = True
                    break
            else:
                saida.append(c)
        caixas = saida
    return [tuple(c) for c in caixas]


def achar_figuras(page, topo, base):
    """Imagens (mescladas) e agrupamentos de tracos vetoriais (graficos)."""
    cx = []
    for im in page.images:
        if im["bottom"] - im["top"] < 2 or im["x1"] - im["x0"] < 2:
            continue
        if im["top"] < topo or im["bottom"] > base + 2:
            continue
        # faixas de cabecalho (barra cinza das linguas): largura total e baixa
        if im["x1"] - im["x0"] > 500 and im["bottom"] - im["top"] < 25:
            continue
        cx.append((im["x0"], im["top"], im["x1"], im["bottom"]))
    vet = [(o["x0"], o["top"], o["x1"], o["bottom"]) for o in (page.curves + page.lines)
           if topo < o["top"] and o["bottom"] < base]
    if len(vet) >= 8:  # so considera vetor se houver bastante traco (grafico de verdade)
        for g in mesclar(vet, folga=6):
            if (g[2] - g[0]) > 60 and (g[3] - g[1]) > 40:
                cx.append(g)
    figs = mesclar(cx)
    return [f for f in figs if (f[2] - f[0]) > 25 and (f[3] - f[1]) > 12]


def regras_horizontais(page, topo, base):
    """Linhas finas que separam blocos (texto+itens)."""
    out = []
    for r in page.rects:
        if (r["bottom"] - r["top"]) < 2.5 and (r["x1"] - r["x0"]) > 120 and topo < r["top"] < base:
            out.append((r["x0"], r["top"], r["x1"]))
    return out


# ------------------------------------------------------------------ paginas
def eventos_da_pagina(pdf_page, num_pag, pdf_path):
    """
    Devolve lista de eventos na ordem de leitura (coluna esquerda, depois direita):
      ("hdr", texto) ("lin", texto, x_rel, negrito) ("fig", caminho) ("regra",)
    """
    page = pdf_page
    W, H = page.width, page.height
    meio = W / 2
    TOPO, BASE = 44, 815
    ev = []

    # barra "PARTE n" no meio do cabecalho
    banda = None
    for w in page.extract_words():
        if w["top"] < 80 and w["text"].upper().startswith("PARTE") and 200 < w["x0"] < 330:
            banda = (w["top"] - 3, w["bottom"] + 3)
            break
    if banda:
        txt = page.crop((0, banda[0], W, banda[1])).extract_text() or ""
        ev.append(("hdr", txt.strip()))

    figs = achar_figuras(page, TOPO, BASE)
    regras = regras_horizontais(page, TOPO, BASE)

    for col, (x0, x1) in enumerate([(0, meio), (meio, W)]):
        def dentro(o, x0=x0, x1=x1):
            if o.get("object_type") == "char":
                return x0 <= _centro(o) < x1
            return True
        base_pg = page.filter(dentro)
        regiao = base_pg.crop((x0, TOPO, x1, BASE))
        linhas = regiao.extract_text_lines(return_chars=True, strip=True, layout=False)
        linhas = fundir_subscritos(linhas)
        esq_col = min([l["x0"] for l in linhas], default=x0 + 28)
        itens = []
        for l in linhas:
            if banda and banda[0] <= l["top"] <= banda[1]:
                continue
            if l["top"] < TOPO or l["bottom"] > BASE + 2:
                continue
            ch = l["chars"][0]
            negrito = "bold" in ch["fontname"].lower() or ch["size"] < 9.6
            itens.append(("lin", l["top"], l["text"].strip(), l["x0"], negrito))
        for f in figs:
            if x0 - 5 <= (f[0] + f[2]) / 2 < x1 + 5 and (f[2] - f[0]) < (W * 0.6 or W) or \
               (f[2] - f[0]) >= W * 0.6 and col == 0:
                if not (x0 - 5 <= (f[0] + f[2]) / 2 < x1 + 5) and (f[2] - f[0]) < W * 0.6:
                    continue
                pix = _salvar_recorte(page, f, pdf_path, num_pag)
                itens.append(("fig", f[1], pix, f[0], False))
        for r in regras:
            if x0 - 5 <= r[0] and r[0] < x1 - 5:
                itens.append(("regra", r[1], "", r[0], False))
        itens.sort(key=lambda t: t[1])
        # margem esquerda da coluna = menor x0 entre linhas que comecam com numero de item
        ev.append(("col", esq_col))
        for it in itens:
            ev.append(it)
    return ev


def _texto_chars(chars):
    chars = sorted(chars, key=lambda c: c["x0"])
    out, prev = [], None
    for c in chars:
        if prev is not None and c["text"] != " " and prev["text"] != " " \
                and c["x0"] - prev["x1"] > 0.18 * max(c["size"], prev["size"]):
            out.append(" ")
        out.append(c["text"])
        prev = c
    return re.sub(r"\s+", " ", "".join(out)).strip()


def fundir_subscritos(linhas):
    """Junta indices/expoentes (linhas curtas de fonte pequena) na linha principal."""
    if not linhas:
        return linhas
    def tam(l):
        return max(c["size"] for c in l["chars"])
    grandes = sorted(tam(l) for l in linhas)
    ref = grandes[len(grandes) // 2]
    usados = set()
    for i, l in enumerate(linhas):
        if tam(l) >= ref * 0.85 or len(l["text"]) > 12:
            continue
        melhor, dist = None, 1e9
        for j, o in enumerate(linhas):
            if j == i or j in usados or tam(o) < ref * 0.85:
                continue
            d = abs(o["top"] - l["top"])
            if d < 9 and o["x0"] - 3 <= l["x0"] <= o["x1"] + 3 and d < dist:
                melhor, dist = j, d
        if melhor is not None:
            o = linhas[melhor]
            o["chars"] = o["chars"] + l["chars"]
            o["text"] = _texto_chars(o["chars"])
            o["x1"] = max(o["x1"], l["x1"])
            usados.add(i)
    return [l for i, l in enumerate(linhas) if i not in usados]


def _salvar_recorte(page, caixa, pdf_path, num_pag):
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    x0, t, x1, b = caixa
    x0, t = max(0, x0 - 2), max(0, t - 2)
    x1, b = min(page.width, x1 + 2), min(page.height, b + 2)
    chave = f"{pdf_path.name}|{num_pag}|{round(x0)}|{round(t)}"
    h = hashlib.md5(chave.encode()).hexdigest()[:10]
    nome = f"fig_{h}.png"
    destino = IMG_DIR / nome
    if not destino.exists():
        page.crop((x0, t, x1, b)).to_image(resolution=DPI).save(str(destino))
    return f"dados/imagens/{nome}"


# -------------------------------------------------------------- montagem
def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def rotulo_da_prova(pdf):
    t = pdf.pages[0].extract_text() or ""
    m = RE_ROTULO.search(t)
    if not m:
        return None, None
    tipo = "Edital" if m.group(1).lower().startswith("edital") else "Aplicação"
    return tipo, int(m.group(2))


def processar_pdf(caminho):
    pdf = pdfplumber.open(str(caminho))
    tipo, ano = rotulo_da_prova(pdf)
    if ano is None:
        print(f"  ! nao achei o rotulo da prova em {caminho.name}; usando nome do arquivo")
        tipo, ano = "Prova", 0
    prova = f"PAS1-{tipo}-{ano}"
    prova_nome = f"PAS 1 – {tipo} {ano}"

    esperado = 1
    parte = 1
    lingua = None
    primeira = pdf.pages[0].extract_text() or ""
    if re.search(r"PARTE\s*[–\-]?\s*2", primeira[:300], re.I) and not re.search(r"L[ÍI]NGUA", primeira, re.I):
        parte, esperado = 2, 11

    contextos, questoes = [], []
    # estado do bloco corrente
    bloco = {"ctx": [], "imgs": [], "itens": [], "lingua": None, "parte": parte}
    item = None

    def fechar_bloco():
        nonlocal bloco, item
        if bloco["itens"]:
            cid = f"{prova}-p{bloco['parte']}-ctx{len(contextos) + 1:03d}"
            texto = "\n".join(bloco["ctx"]).strip()
            contextos.append({"id": cid, "texto": limpar(texto), "imagens": bloco["imgs"]})
            for it in bloco["itens"]:
                questoes.append(finalizar(it, cid, prova, prova_nome, tipo, ano, bloco["lingua"], bloco["parte"]))
            bloco = {"ctx": [], "imgs": [], "itens": [], "lingua": bloco["lingua"], "parte": bloco["parte"]}
        item = None

    for np_, pg in enumerate(pdf.pages, 1):
        eventos = eventos_da_pagina(pg, np_, caminho)
        esq = 28
        for e in eventos:
            k = e[0]
            if k == "hdr":
                m = RE_PARTE.search(e[1])
                if m:
                    fechar_bloco()
                    bloco["parte"] = int(m.group(1))
                    if bloco["parte"] == 2:
                        esperado = 11
                        bloco["lingua"] = None
                continue
            if k == "col":
                esq = e[1]
                item = item if item else None
                continue
            _, _, txt, x0, neg = e
            if k == "regra":
                if bloco["itens"]:
                    fechar_bloco()
                continue
            if k == "fig":
                alvo = item["imgs"] if item else bloco["imgs"]
                alvo.append(txt)
                continue
            # linha de texto
            if not txt or RE_LIXO.match(txt):
                continue
            if re.fullmatch(r"\d{1,2}", txt) and not (esperado == int(txt) and neg):
                continue  # numeracao do rascunho (1..10)
            m = RE_LINGUA.match(txt.replace(" ", ""))
            if m:
                fechar_bloco()
                bloco["lingua"] = m.group(1).capitalize()
                bloco["parte"] = 1
                esperado = 1
                continue
            if re.match(r"^CEBRASPE", txt):
                continue
            mi = re.match(r"^(\d{1,3})\s+(\S.*)$", txt)
            eh_inicio = bool(mi and int(mi.group(1)) == esperado and x0 <= esq + 32)
            if eh_inicio:
                if esperado == 11 and bloco["parte"] == 1:
                    if bloco["itens"]:
                        fechar_bloco()
                    bloco["lingua"], bloco["parte"] = None, 2
                item = {"numero": esperado, "linhas": [mi.group(2)], "imgs": [], "x": x0}
                bloco["itens"].append(item)
                esperado += 1
                continue
            if item is not None and bloco["itens"]:
                if x0 <= item["x"] + 4:  # texto rente a margem => novo contexto sem regra
                    fechar_bloco()
                    bloco["ctx"].append(txt)
                else:
                    item["linhas"].append(txt)
            else:
                bloco["ctx"].append(txt)
    fechar_bloco()
    return contextos, questoes


def limpar(t):
    """Reagrupa linhas de prosa em paragrafos; preserva versos (linhas curtas)."""
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


def juntar(linhas):
    txt = " ".join(linhas)
    return re.sub(r"\s+", " ", txt).strip()


RE_OPCAO = re.compile(r"(?:(?<=\s)|^)([A-D])\s+(?=\S)")


def separar_opcoes(texto):
    """Separa enunciado e opcoes A-D (itens tipo C), procurando de tras para frente."""
    marcas = list(RE_OPCAO.finditer(texto))
    seq, limite = [], len(texto) + 1
    for letra in "DCBA":
        achou = None
        for m in marcas:
            if m.group(1) == letra and m.start() < limite and m.start() > 5:
                achou = m
        if achou is None:
            return texto, None
        seq.insert(0, achou)
        limite = achou.start()
    ops = []
    for i, m in enumerate(seq):
        fim = seq[i + 1].start() if i + 1 < len(seq) else len(texto)
        ops.append({"letra": m.group(1), "texto": texto[m.end():fim].strip()})
    return texto[:seq[0].start()].strip(), ops


def finalizar(it, cid, prova, prova_nome, tipo_prova, ano, lingua, parte):
    texto = juntar(it["linhas"])
    enun, ops = separar_opcoes(texto)
    if ops:
        tipo = "multipla_escolha"
    elif "parte fracionária" in texto or "parte fracionaria" in texto:
        tipo = "numerica"
    elif RE_DISC.match(texto) or re.search(r"\b(explique|descreva|comente)\b", texto[:200], re.I) and len(texto) > 200 \
            and "julgue" not in texto[:60].lower():
        tipo = "discursiva"
    else:
        tipo = "certo_errado"
    qid = f"{prova}-{slug(lingua) + '-' if lingua else ''}q{it['numero']}"
    revisar = len(enun) > 1100 or len(enun) < 15
    return {
        "id": qid,
        "prova": prova_nome,
        "tipo_prova": tipo_prova,
        "ano": ano,
        "parte": parte,
        "numero": it["numero"],
        "lingua": lingua,
        "disciplina": lingua and f"Língua {lingua}" or None,
        "assuntos": [],
        "tipo": tipo,
        "enunciado": enun,
        "opcoes": ops,
        "contexto_id": cid,
        "imagens": it["imgs"],
        "gabarito": None,
        "revisar": revisar,
    }


def main():
    args = [Path(a) for a in sys.argv[1:]] or [Path("provas")]
    pdfs = []
    for a in args:
        pdfs += sorted(a.glob("*.pdf")) if a.is_dir() else [a]
    if not pdfs:
        sys.exit("Nenhum PDF encontrado. Coloque as provas na pasta 'provas/'.")

    vistos, todos_ctx, todas_q = set(), [], []
    for p in pdfs:
        h = hashlib.md5(p.read_bytes()).hexdigest()
        if h in vistos:
            print(f"- {p.name}: duplicado, ignorando")
            continue
        vistos.add(h)
        print(f"- {p.name}")
        ctx, qs = processar_pdf(p)
        print(f"    {len(qs)} questoes, {len(ctx)} contextos")
        todos_ctx += ctx
        todas_q += qs

    # remove ids repetidos (mesma prova enviada em arquivos diferentes)
    ids, unicas = set(), []
    for q in todas_q:
        if q["id"] in ids:
            continue
        ids.add(q["id"])
        unicas.append(q)
    usados = {q["contexto_id"] for q in unicas}
    todos_ctx = [c for c in todos_ctx if c["id"] in usados]

    SAIDA.mkdir(parents=True, exist_ok=True)
    (SAIDA / "questoes.json").write_text(
        json.dumps({"contextos": todos_ctx, "questoes": unicas}, ensure_ascii=False, indent=1),
        encoding="utf-8")
    print(f"\nOK: {len(unicas)} questoes -> {SAIDA / 'questoes.json'}")
    print("Proximo passo: python classificar.py")


if __name__ == "__main__":
    main()
