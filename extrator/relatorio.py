# -*- coding: utf-8 -*-
"""Relatório de qualidade por prova (JSON + resumo legível)."""
import collections
import re

ESTRUTURA = {3: {"lingua": 10, "ultimo": 120, "linguas": ["esp", "fra", "ing"]}}  # PAS 3: 3 línguas x 10 + itens 11..120


def esperados(etapa):
    e = ESTRUTURA.get(int(etapa))
    if not e:
        return None
    out = [(lg, n) for lg in e["linguas"] for n in range(1, e["lingua"] + 1)]
    out += [(None, n) for n in range(e["lingua"] + 1, e["ultimo"] + 1)]
    return out


def gerar(prova):
    qs, meta = prova["questoes"], prova["meta"]
    achados = {(q["lingua"], q["numero"]) for q in qs}
    esp = esperados(meta["etapa"])
    lacunas = sorted(esp and [f"{lg or ''}{n}" for lg, n in esp if (lg, n) not in achados] or [])
    n = len(qs)
    figs = [len(q["imagens"]) for q in qs]
    motivos = collections.Counter()
    for q in qs:
        for m in q["motivos_revisao"]:
            motivos[re.sub(r"\d+", "N", m)] += 1
    tipos = collections.Counter(q["tipo"] for q in qs)
    r = {
        "prova": meta["id_prova"], "pdf": meta["pdf"], "subprograma": meta["subprograma"],
        "itens_esperados": len(esp) if esp else None, "itens_extraidos": n, "lacunas": lacunas,
        "com_contexto": sum(1 for q in qs if q["contexto_id"]), "sem_contexto": [q["id"] for q in qs if not q["contexto_id"]],
        "contextos": len(prova["contextos"]),
        "revisar": sum(q["revisar"] for q in qs),
        "motivos_revisao": dict(motivos.most_common()),
        "tipos": dict(tipos),
        "sem_gabarito": sum(1 for q in qs if q["gabarito"] in (None, "") and q["tipo"] != "discursiva"),
        "discursivas_sem_gabarito_por_natureza": tipos.get("discursiva", 0),
        "sem_figura_mas_cita": [q["id"] for q in qs if any("cita figura" in m for m in q["motivos_revisao"])],
        "enunciado_curto_ou_longo": [q["id"] for q in qs if len(q["enunciado"]) < 15 or len(q["enunciado"]) > 3000],
        "figuras_por_questao_media": round(sum(figs) / max(1, n), 2),
        "figuras_por_questao_max": max(figs) if figs else 0,
        "contextos_com_figura": sum(1 for c in prova["contextos"] if c["images"]),
        "paginas_sem_texto": meta["avisos"],
        "disciplina_precisa_revisar": sum(1 for q in qs if q.get("precisa_revisar_disciplina")),
    }
    r["enunciado_curto_ou_longo_sem_revisar"] = [q["id"] for q in qs if (len(q["enunciado"]) < 15 or len(q["enunciado"]) > 3000) and not q["revisar"]]
    return r


def resumo_texto(r):
    L = [f"# {r['prova']}  ({r['pdf']})",
         f"- Itens: {r['itens_extraidos']} extraídos" + (f" de {r['itens_esperados']} esperados" if r["itens_esperados"] else " (sem estrutura conhecida para conferir)"),
         f"- Lacunas: {', '.join(r['lacunas']) or 'nenhuma'}",
         f"- Textos-base: {r['contextos']}; questões sem texto-base: {len(r['sem_contexto'])}",
         f"- Tipos: {r['tipos']}",
         f"- Para revisar: {r['revisar']} questões",
         f"- Sem gabarito: {r['sem_gabarito']} (+ {r['discursivas_sem_gabarito_por_natureza']} discursivas, sem gabarito por natureza)",
         f"- Figuras por questão: média {r['figuras_por_questao_media']}, máximo {r['figuras_por_questao_max']}; textos-base com figura: {r['contextos_com_figura']}",
         f"- Cita figura/gráfico/tabela mas sem imagem: {len(r['sem_figura_mas_cita'])}",
         f"- Disciplina precisa revisar: {r['disciplina_precisa_revisar']} questões",
         "- Motivos de revisão:"]
    L += [f"    - {v}× {k}" for k, v in r["motivos_revisao"].items()] or ["    - nenhum"]
    return "\n".join(L) + "\n"
