# -*- coding: utf-8 -*-
"""Roda sem rede e sem IA:  python -m unittest discover -s tests -v   (na pasta extrator/)"""
import json
import sys
import unittest
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parent))

import ids  # noqa: E402
from extrair_geo import extrair_prova  # noqa: E402
from classificar_v2 import classificar_prova  # noqa: E402

GOLDEN = json.loads((AQUI / "golden_provas.json").read_text(encoding="utf-8"))["provas"]
ROTULOS = json.loads((AQUI / "golden_disciplinas.json").read_text(encoding="utf-8"))["rotulos"]
_cache = {}


def prova(ano):
    if ano not in _cache:
        pdf = AQUI / "amostras" / f"pas3-prova-{ano}.pdf"
        if not pdf.exists():
            raise unittest.SkipTest(f"PDF de amostra ausente: {pdf}")
        r = extrair_prova(pdf, AQUI / "_saida", com_imagens=False)
        classificar_prova(r["questoes"], r["contextos"])
        _cache[ano] = r
    return _cache[ano]


class TestIds(unittest.TestCase):
    def test_formato(self):
        self.assertEqual(ids.id_questao(3, 2023, 42), "pas3-2023-q042")
        self.assertEqual(ids.id_questao("PAS3", 2023, 3, "ing"), "pas3-2023-ing-q003")
        self.assertEqual(ids.nome_prova(3, 2023), "PAS 3 – 2023")


class TestGolden(unittest.TestCase):
    def test_itens_esperados_igual_extraidos(self):
        for ano in (2008, 2015, 2023):
            r = prova(ano)
            self.assertEqual(len(r["questoes"]), GOLDEN[f"pas3-{ano}"]["total"], ano)
            self.assertEqual(len({q["id"] for q in r["questoes"]}), len(r["questoes"]), "ids duplicados")

    def test_tipos_batem_com_gabarito_oficial(self):
        nome = {"multipla_escolha": "C", "numerica": "B", "discursiva": "D"}
        for ano in (2008, 2015, 2023):
            achado = {"C": [], "B": [], "D": []}
            for q in prova(ano)["questoes"]:
                k = nome.get(q["tipo"])
                if k:
                    achado[k].append((q["lingua"] or "") + str(q["numero"]))
            esperado = GOLDEN[f"pas3-{ano}"]["tipos_conferidos_com_gabarito"]
            for k in "CBD":
                self.assertEqual(sorted(achado[k]), sorted(esperado[k]), f"{ano} tipo {k}")

    def test_inicio_dos_enunciados(self):
        for ano in (2008, 2015, 2023):
            q = {x["id"]: x for x in prova(ano)["questoes"]}
            for qid, ini in GOLDEN[f"pas3-{ano}"]["enunciado_inicio"].items():
                self.assertEqual(q[qid]["enunciado"][:40], ini, qid)


class TestContratoJson(unittest.TestCase):
    CAMPOS = ["id", "prova", "ano", "numero", "tipo", "enunciado", "opcoes", "contexto_id", "imagens", "gabarito",
              "origem_extracao", "proveniencia", "disciplinas", "disciplina_principal", "confianca", "motivo",
              "origem_disciplina", "precisa_revisar_disciplina", "revisar", "motivos_revisao"]

    def test_campos_e_alternativas(self):
        for ano in (2008, 2015, 2023):
            r = prova(ano)
            ctx = {c["id"] for c in r["contextos"]}
            for q in r["questoes"]:
                for c in self.CAMPOS:
                    self.assertIn(c, q, f"{q['id']} sem {c}")
                if q["tipo"] == "multipla_escolha" and q["opcoes"]:
                    self.assertEqual([o["letra"] for o in q["opcoes"]], list("ABCD"))
                    for o in q["opcoes"]:
                        self.assertTrue(o["texto"], f"{q['id']} alternativa vazia/null")
                if q["tipo"] == "multipla_escolha" and not q["opcoes"]:
                    self.assertTrue(q["revisar"], f"{q['id']} tipo C sem alternativas e sem 'revisar'")
                if q["contexto_id"]:
                    self.assertIn(q["contexto_id"], ctx)
                n = len(q["enunciado"])
                if n < 15 or n > 3000:
                    self.assertTrue(q["revisar"] and q["motivos_revisao"], q["id"])
                self.assertIsNotNone(q["disciplina_principal"] or q["sugestoes_disciplina"] == [], q["id"])
                if q["precisa_revisar_disciplina"]:
                    self.assertIn("sugestoes_disciplina", q)

    def test_discursiva_marcada(self):
        for q in prova(2023)["questoes"]:
            if q["tipo"] == "discursiva":
                self.assertEqual(q["gabarito_obs"], "sem gabarito (discursiva)")


class TestClassificacao(unittest.TestCase):
    def test_acuracia_nao_piora(self):
        q = {x["id"]: x for x in prova(2023)["questoes"]}
        ok = sum(q[i]["disciplina_principal"] == d for i, d in ROTULOS.items())
        self.assertGreaterEqual(ok / len(ROTULOS), 0.80, f"acurácia caiu: {ok}/{len(ROTULOS)}")
        alta = [i for i in ROTULOS if not q[i]["precisa_revisar_disciplina"]]
        ok_alta = sum(q[i]["disciplina_principal"] == ROTULOS[i] for i in alta)
        self.assertGreaterEqual(ok_alta / len(alta), 0.85)

    def test_manual_nunca_sobrescrito(self):
        r = prova(2023)
        qs = [dict(x) for x in r["questoes"][40:45]]
        qs[0].update(origem_disciplina="manual", disciplina_principal="Artes")
        classificar_prova(qs, r["contextos"])
        self.assertEqual(qs[0]["disciplina_principal"], "Artes")


if __name__ == "__main__":
    unittest.main()
