# -*- coding: utf-8 -*-
"""Uma linha de comando para processar uma pasta de PDFs de provas (sem IA, sem internet).

    python processar_pasta.py PASTA_COM_PDFS PASTA_DE_SAIDA [--sem-imagens]

Para cada *prova*.pdf: extrai, classifica por disciplina, grava prova.json + imagens + relatório.
No fim confere as metas de qualidade e sai com código 1 se alguma falhar.
"""
import argparse
import json
import sys
from pathlib import Path

from extrair_geo import extrair_prova
from classificar_v2 import classificar_prova, carregar_lexico
import relatorio

META_FIG_MEDIA = 1.5


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("pasta")
    ap.add_argument("saida")
    ap.add_argument("--sem-imagens", action="store_true")
    a = ap.parse_args(argv)
    pdfs = sorted(p for p in Path(a.pasta).rglob("*.pdf") if "prova" in p.name.lower())
    if not pdfs:
        print("Nenhum PDF com 'prova' no nome em", a.pasta)
        return 2
    lex = carregar_lexico()
    falhas, resumo = [], []
    for p in pdfs:
        try:
            r = extrair_prova(p, a.saida, com_imagens=not a.sem_imagens)
        except Exception as e:  # uma prova ruim não derruba o lote
            falhas.append(f"{p.name}: erro ao extrair ({type(e).__name__}: {e})")
            continue
        classificar_prova(r["questoes"], r["contextos"], lex)
        rel = relatorio.gerar(r)
        pasta = Path(a.saida) / r["meta"]["id_prova"]
        (pasta / "prova.json").write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
        (pasta / "relatorio.json").write_text(json.dumps(rel, ensure_ascii=False, indent=1), encoding="utf-8")
        (pasta / "relatorio.md").write_text(relatorio.resumo_texto(rel), encoding="utf-8")
        resumo.append(rel)
        print(f"{r['meta']['id_prova']}: {rel['itens_extraidos']} itens, {rel['revisar']} p/ revisar, "
              f"figuras/questão {rel['figuras_por_questao_media']}, lacunas {len(rel['lacunas'])}")
        if rel["itens_esperados"] and rel["itens_extraidos"] != rel["itens_esperados"]:
            falhas.append(f"{p.name}: {rel['itens_extraidos']} itens extraídos, esperados {rel['itens_esperados']} (lacunas: {rel['lacunas'][:10]})")
        if rel["figuras_por_questao_media"] > META_FIG_MEDIA:
            falhas.append(f"{p.name}: média de figuras por questão {rel['figuras_por_questao_media']} > {META_FIG_MEDIA}")
        if rel["enunciado_curto_ou_longo_sem_revisar"]:
            falhas.append(f"{p.name}: enunciado <15 ou >3000 caracteres sem 'revisar': {rel['enunciado_curto_ou_longo_sem_revisar'][:5]}")
        if rel["sem_contexto"]:
            print(f"   aviso: {len(rel['sem_contexto'])} questões sem texto-base (pode ser normal)")
    (Path(a.saida) / "resumo_qualidade.json").write_text(json.dumps(resumo, ensure_ascii=False, indent=1), encoding="utf-8")
    if falhas:
        print("\nMETAS NÃO ATINGIDAS:")
        for f in falhas:
            print(" -", f)
        return 1
    print("\nTodas as metas automáticas atingidas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
