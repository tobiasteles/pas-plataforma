# -*- coding: utf-8 -*-
"""Classificação por disciplina SEM IA e SEM internet (v1: estrutura + propagação + léxico).

Camadas (da mais certa para a menos certa):
 1. estrutura: item de língua estrangeira -> Língua Inglesa/Espanhola/Francesa (confiança 1.0)
 2. léxico em disciplinas.json (termos fortes/fracos/exclusão/símbolos, com peso por local)
 3. propagação: itens do mesmo texto-base (contexto_id) se influenciam
 Abaixo do limiar de confiança: precisa_revisar_disciplina = True + 3 melhores sugestões.
 Correção manual (origem_disciplina == "manual") nunca é sobrescrita.
"""
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

import ids

LEX_PADRAO = Path(__file__).with_name("disciplinas.json")


def norm(t):
    t = unicodedata.normalize("NFD", (t or "").lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", t)


def carregar_lexico(caminho=None):
    cfg = json.loads(Path(caminho or LEX_PADRAO).read_text(encoding="utf-8"))
    comp = {}
    for disc, d in cfg["disciplinas"].items():
        def rx(termos):
            out = []
            for t in termos:
                t = norm(t)
                pref = t.endswith("*")
                t = re.escape(t.rstrip("*")).replace("\\ ", " ")
                out.append((re.compile(rf"(?<![a-z0-9]){t}" + (r"\w*" if pref else r"(?![a-z0-9])")), t))
            return out
        comp[disc] = {
            "fortes": rx(d.get("fortes", [])), "fracos": rx(d.get("fracos", [])),
            "exclusao": rx(d.get("exclusao", [])),
            "simbolos": [re.compile(s, re.I) for s in d.get("simbolos", [])],
        }
    cfg["_comp"] = comp
    return cfg


def pontuar(partes, lex):
    """partes = {'enunciado':txt,'opcoes':txt,'contexto':txt} -> ({disc: pontos}, {disc: [termos]})"""
    pesos = lex["pesos_local"]
    S, T = defaultdict(float), defaultdict(list)
    for local, txt in partes.items():
        if not txt:
            continue
        n, bruto, w = norm(txt), txt, pesos[local]
        for disc, c in lex["_comp"].items():
            for rx, nome in c["fortes"]:
                k = min(len(rx.findall(n)), 3)
                if k:
                    S[disc] += 3 * w * (0.6 + 0.4 * k) / 1.0
                    T[disc].append(nome)
            for rx, nome in c["fracos"]:
                if rx.search(n):
                    S[disc] += 1 * w
            for rx, nome in c["exclusao"]:
                if rx.search(n):
                    S[disc] -= 2 * w
            for rx in c["simbolos"]:
                if rx.search(bruto):
                    S[disc] += 2 * w
                    T[disc].append("símbolo")
    return {d: max(0.0, v) for d, v in S.items()}, T


def _vetor(S):
    tot = sum(S.values())
    return {d: v / tot for d, v in S.items()} if tot > 0 else {}


def classificar_prova(questoes, contextos, lexico=None, limiar=None):
    """Preenche os campos de disciplina em cada questão (in-place) e devolve um resumo."""
    lex = lexico or carregar_lexico()
    limiar = limiar if limiar is not None else lex["limiar_confianca"]
    ctx = {c["id"]: c for c in contextos}
    brutos = {}
    for q in questoes:
        if q.get("origem_disciplina") == "manual":
            continue
        partes = {"enunciado": q["enunciado"],
                  "opcoes": " ".join(o["texto"] or "" for o in q.get("opcoes", [])),
                  "contexto": (ctx.get(q.get("contexto_id")) or {}).get("text", "")}
        brutos[q["id"]] = pontuar(partes, lex)
    grupos = defaultdict(list)
    for q in questoes:
        if q.get("contexto_id") and q["id"] in brutos:
            grupos[q["contexto_id"]].append(q["id"])
    for q in questoes:
        if q.get("origem_disciplina") == "manual":
            continue
        if q.get("lingua"):
            nome = ids.LINGUA_NOME[q["lingua"]]
            q.update(disciplinas=[nome], disciplina_principal=nome, confianca=1.0,
                     motivo="item de língua estrangeira (estrutura da prova)", origem_disciplina="estrutura",
                     precisa_revisar_disciplina=False, sugestoes_disciplina=[nome])
            continue
        S, T = brutos[q["id"]]
        own = _vetor(S)
        forca_own = sum(S.values()) / (sum(S.values()) + 3.0)
        # propagação: média dos vetores dos OUTROS itens do mesmo texto-base
        outros = [i for i in grupos.get(q.get("contexto_id"), []) if i != q["id"]]
        g = defaultdict(float)
        for i in outros:
            v = _vetor(brutos[i][0])
            f = sum(brutos[i][0].values()) / (sum(brutos[i][0].values()) + 3.0)
            for d, x in v.items():
                g[d] += x * f
        tg = sum(g.values())
        g = {d: x / tg for d, x in g.items()} if tg else {}
        forca_g = min(1.0, tg / max(1, len(outros))) if tg else 0.0
        a = forca_own
        final = defaultdict(float)
        for d in set(own) | set(g):
            final[d] = a * own.get(d, 0) + (1 - a) * 0.8 * g.get(d, 0)
        rank = sorted(final.items(), key=lambda kv: -kv[1])
        if not rank or rank[0][1] <= 0:
            q.update(disciplinas=[], disciplina_principal=None, confianca=0.0,
                     motivo="nenhum termo reconhecido", origem_disciplina="regra",
                     precisa_revisar_disciplina=True, sugestoes_disciplina=[])
            continue
        top, seg = rank[0][1], (rank[1][1] if len(rank) > 1 else 0.0)
        forca = max(forca_own, 0.8 * forca_g * (1 - a))
        conf = round(min(1.0, (top - seg) / (top + 1e-9) * 0.6 + top * 0.4) * (0.35 + 0.65 * forca), 2)
        princ = rank[0][0]
        usou_prop = bool(g) and g.get(princ, 0) * (1 - a) * 0.8 > own.get(princ, 0) * a * 0.5
        termos = list(dict.fromkeys(T.get(princ, [])))[:5]
        motivo = ("termos: " + ", ".join(termos)) if termos else "sinais fracos"
        if usou_prop:
            motivo += " + mesmo texto-base de outros itens"
        q.update(disciplinas=[d for d, v in rank[:3] if v >= 0.25 * top],
                 disciplina_principal=princ, confianca=conf, motivo=motivo,
                 origem_disciplina="propagacao" if usou_prop and not termos else "regra",
                 precisa_revisar_disciplina=conf < limiar,
                 sugestoes_disciplina=[d for d, _ in rank[:3]])
    revisar = sum(1 for q in questoes if q.get("precisa_revisar_disciplina"))
    return {"total": len(questoes), "precisa_revisar": revisar,
            "pct_precisa_revisar": round(100 * revisar / max(1, len(questoes)), 1)}
