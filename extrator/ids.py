# -*- coding: utf-8 -*-
"""Padrão ÚNICO de ids e nomes de prova (extrator, conversor e importador usam isto).

id da questão:  pas3-2023-q042          (ano = ano de APLICAÇÃO da prova)
                pas3-2023-ing-q003      (itens de língua estrangeira: esp | fra | ing)
nome da prova:  PAS 3 – 2023
"""
import re

LINGUA_COD = {"espanhola": "esp", "francesa": "fra", "inglesa": "ing"}
LINGUA_NOME = {"esp": "Língua Espanhola", "fra": "Língua Francesa", "ing": "Língua Inglesa"}


def etapa_cod(etapa) -> str:
    """'PAS3' / 'pas 3' / 3 -> 'pas3'"""
    m = re.search(r"([123])", str(etapa))
    if not m:
        raise ValueError(f"etapa inválida: {etapa!r}")
    return f"pas{m.group(1)}"


def nome_prova(etapa, ano) -> str:
    return f"PAS {etapa_cod(etapa)[-1]} – {int(ano)}"


def id_prova(etapa, ano) -> str:
    return f"{etapa_cod(etapa)}-{int(ano)}"


def id_questao(etapa, ano, numero, lingua=None) -> str:
    lg = f"{lingua}-" if lingua else ""
    return f"{id_prova(etapa, ano)}-{lg}q{int(numero):03d}"


def id_contexto(etapa, ano, n, lingua=None) -> str:
    lg = f"{lingua}-" if lingua else ""
    return f"{id_prova(etapa, ano)}-{lg}c{int(n):03d}"
