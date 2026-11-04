"""Lê gabaritos do Cebraspe/Cespe em PDF no formato de grade (números em cima, respostas embaixo)."""
import re
import statistics
import tempfile
from pathlib import Path
from collections import defaultdict

import pdfplumber

RE_NUM = re.compile(r"^\d{1,3}$")
RE_LETRA = re.compile(r"^[A-E]$")


def _linhas(words, tol=3.0):
    """Agrupa palavras em linhas pela posição vertical."""
    linhas = []
    for w in sorted(words, key=lambda w: w["top"]):
        for l in linhas:
            if abs(l["top"] - w["top"]) <= tol:
                l["w"].append(w)
                break
        else:
            linhas.append({"top": w["top"], "w": [w]})
    for l in linhas:
        l["w"].sort(key=lambda w: w["x0"])
        l["bottom"] = max(w["bottom"] for w in l["w"])
    return sorted(linhas, key=lambda l: l["top"])


def _cx(w):
    return (w["x0"] + w["x1"]) / 2


def _e_linha_de_numeros(l):
    ws = l["w"]
    nums = [w for w in ws if RE_NUM.match(w["text"])]
    return len(nums) >= 5 and len(nums) >= 0.8 * len(ws)


def _dividir_tabelas(nums):
    """Separa tabelas lado a lado pelo salto horizontal entre números vizinhos."""
    if len(nums) < 3:
        return [nums]
    gaps = [_cx(b) - _cx(a) for a, b in zip(nums, nums[1:])]
    med = statistics.median(gaps)
    grupos, atual = [], [nums[0]]
    for g, w in zip(gaps, nums[1:]):
        if g > 1.6 * med:
            grupos.append(atual); atual = []
        atual.append(w)
    grupos.append(atual)
    return grupos


def ler_gabarito(caminho):
    entradas, avisos = [], []
    caderno = None
    tipo_b = defaultdict(dict)       # caderno -> {numero: valor}
    secoes_antes = []                # (x0, x1, nome) das tabelas já vistas, para herdar o título
    with pdfplumber.open(str(caminho)) as pdf:
        for pg in pdf.pages:
            words = pg.extract_words(keep_blank_chars=False, extra_attrs=["size"])
            linhas = _linhas(words)
            # marcadores de caderno e título da tabela de itens tipo B
            marcas = []
            for l in linhas:
                t = " ".join(w["text"] for w in l["w"])
                m = re.match(r"^CADERNO\s+(.+)$", t, re.I)
                if m:
                    marcas.append((l["top"], "caderno", m.group(1).strip().title()))
                if re.match(r"^ITENS\s+DO\s+TIPO\s+B", t, re.I):
                    marcas.append((l["top"], "tipob", None))
            marcas.sort()
            tipob_y = [y for y, k, _ in marcas if k == "tipob"]

            def caderno_em(y):
                c = caderno
                for yy, k, v in marcas:
                    if k == "caderno" and yy <= y:
                        c = v
                return c

            for i, l in enumerate(linhas):
                # --- tabela de itens tipo B: duas linhas abaixo do título
                if any(0 < l["top"] - y < 12 for y in tipob_y) or (tipob_y and any(0 < l["top"] - y < 30 and _e_linha_de_numeros(l) for y in tipob_y)):
                    prox = linhas[i + 1] if i + 1 < len(linhas) else None
                    if prox and _e_linha_de_numeros(l):
                        for a in l["w"]:
                            b = min((w for w in prox["w"] if RE_NUM.match(w["text"])), key=lambda w: abs(_cx(w) - _cx(a)), default=None)
                            if b is not None and abs(_cx(b) - _cx(a)) < 25:
                                tipo_b[caderno_em(l["top"])][int(a["text"])] = b["text"].zfill(3)
                    continue
                if not _e_linha_de_numeros(l):
                    continue
                if any(y < l["top"] < y + 60 for y in tipob_y):
                    continue
                nums = [w for w in l["w"] if RE_NUM.match(w["text"])]
                limite = linhas[i + 1]["top"] if i + 1 < len(linhas) else l["bottom"] + 40
                prox_num = next((x for x in linhas[i + 1:] if _e_linha_de_numeros(x)), None)
                fim = min(prox_num["top"] - 1 if prox_num else 1e9, l["bottom"] + 38)
                abaixo = [y for y in tipob_y if y > l["top"]]
                if abaixo:
                    fim = min(fim, min(abaixo) - 1)
                banda = [w for w in words if l["bottom"] <= w["top"] <= fim and not RE_NUM.match(w["text"])]
                for tab in _dividir_tabelas(nums):
                    x0, x1 = tab[0]["x0"] - 6, tab[-1]["x1"] + 6
                    # título: palavras acima, dentro da largura da tabela, que não são respostas
                    tit = [w for w in words if l["top"] - 26 <= w["top"] < l["top"] - 1 and x0 - 40 <= _cx(w) <= x1 + 40 and not RE_NUM.match(w["text"])]
                    if tit:
                        ytop = max(w["top"] for w in tit)
                        tit = [w for w in tit if abs(w["top"] - ytop) <= 3]
                        resp = sum(1 for w in tit if RE_LETRA.match(w["text"]) or w["text"] in ("tipo", "B"))
                        if resp >= 0.6 * len(tit):   # é a linha de respostas da tabela de cima, não um título
                            tit = []
                    nome = " ".join(w["text"] for w in sorted(tit, key=lambda w: w["x0"])).strip()
                    # se a tabela vizinha tiver título junto na mesma linha, recorta pela proximidade ao centro
                    if nome:
                        secoes_antes.append((x0, x1, nome))
                    else:
                        nome = next((n for a, b, n in reversed(secoes_antes) if min(x1, b) - max(x0, a) > 0.5 * (x1 - x0)), "Sem título")
                    for w in tab:
                        cel = [a for a in banda if abs(_cx(a) - _cx(w)) <= 13.5]
                        textos = [a["text"] for a in cel]
                        e = {"caderno": caderno_em(l["top"]), "secao": nome, "numero": int(w["text"]), "resposta": None, "tipoB": False}
                        if any(t == "tipo" for t in textos):
                            e["tipoB"] = True
                        else:
                            letras = [t for t in textos if RE_LETRA.match(t)]
                            e["resposta"] = letras[0] if letras else None
                        entradas.append(e)
            caderno = caderno_em(1e9)

    for e in entradas:
        if e["tipoB"]:
            e["resposta"] = tipo_b.get(e["caderno"], {}).get(e["numero"])
            if e["resposta"] is None:
                avisos.append(f"Item {e['numero']} é tipo B, mas o valor não foi encontrado.")
        elif e["resposta"] is None:
            avisos.append(f"Item {e['numero']} ({e['secao']}): resposta não encontrada.")
    if not entradas:
        avisos.append("Não reconheci o formato do gabarito. Envie o PDF para ajustarmos o leitor.")
    cadernos = list(dict.fromkeys(e["caderno"] for e in entradas))
    return {"cadernos": cadernos, "entradas": entradas, "avisos": avisos[:40]}


def ler_gabarito_bytes(dados: bytes) -> dict:
    if not dados.startswith(b"%PDF"):
        raise ValueError("O arquivo enviado não é um PDF.")
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        p = Path(tmp) / "gabarito.pdf"
        p.write_bytes(dados)
        return ler_gabarito(p)


if __name__ == "__main__":
    import json, sys
    r = ler_gabarito(sys.argv[1])
    print(json.dumps({"cadernos": r["cadernos"], "n": len(r["entradas"]), "avisos": r["avisos"]}, ensure_ascii=False))
    por = defaultdict(list)
    for e in r["entradas"]:
        por[e["secao"]].append(e)
    for s, es in por.items():
        print(f"{s[:60]:60} {es[0]['numero']}-{es[-1]['numero']} ({len(es)}):", "".join((e['resposta'] or '?') if not e['tipoB'] else '[' + (e['resposta'] or '?') + ']' for e in es))
