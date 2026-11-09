"""Núcleo do serviço: recebe os bytes de um PDF de prova e devolve questões + imagens (base64)."""
import base64
import os
import hashlib
import tempfile
import threading
from pathlib import Path

import classificar
import extrair

_lock = threading.Lock()  # extrair.py usa variáveis globais (pasta de imagens)


def extrair_bytes(dados: bytes, nome: str | None = None, ano: int | None = None, etapa: str | None = None) -> dict:
    if not dados.startswith(b"%PDF"):
        raise ValueError("O arquivo enviado não é um PDF.")
    sha = hashlib.sha1(dados).hexdigest()[:12]
    with _lock, tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        tmp = Path(tmp)
        pdf = tmp / f"{sha}.pdf"  # o nome entra no hash das figuras: evita colisão entre PDFs
        pdf.write_bytes(dados)
        extrair.IMG_DIR = tmp / "imagens"
        contextos, questoes = extrair.processar_pdf(pdf, nome=nome, ano_manual=ano, etapa_manual=etapa)
        if not questoes:
            raise ValueError("Não encontrei questões. O PDF é escaneado ou tem outro layout?")
        if questoes[0]["ano"] == 0:
            raise ValueError("Não achei o ano da prova no PDF. Preencha o campo 'Ano' (e, se quiser, o nome) no envio.")
        ctx = {c["id"]: c for c in contextos}
        for q in questoes:
            disc = classificar.classificar_local(q, ctx[q["contexto_id"]])
            q["disciplinas"], q["disciplina"] = disc, disc[0]
        if os.environ.get("LLM_REFINAR") == "1":  # opcional: IA só nos itens marcados para revisar (limite por PDF)
            from llm import LLM, SemProvedor
            from refinar import refinar_questao
            ia, gastas = LLM(), 0
            for q in questoes:
                if not q["revisar"] or gastas >= int(os.environ.get("LLM_MAX_POR_PDF", "40")): continue
                try:
                    res, _ = refinar_questao(q, ia); gastas += 1
                except (SemProvedor, ValueError): break  # sem IA disponível: segue com a extração local
                if res:
                    q.update(tipo=res["tipo"], enunciado=res["enunciado"], revisar=False)
                    q["opcoes"] = res["opcoes"]
        imagens = {p.name: base64.b64encode(p.read_bytes()).decode() for p in (tmp / "imagens").glob("*.png")}
    avisos = []
    for g in extrair.lacunas(questoes):
        rotulo = f"Língua {g['lingua']}" if g["lingua"] else f"Parte {g['parte']}"
        msg = f"{rotulo}: itens {g['min']} a {g['max']} ({g['n']} lidos)"
        if g["faltam"]:
            msg += f"; faltam {', '.join(map(str, g['faltam'][:20]))}" + ("…" if len(g["faltam"]) > 20 else "")
        avisos.append(msg)
    if sum(1 for q in questoes if q["revisar"]):
        avisos.append(f"{sum(1 for q in questoes if q['revisar'])} itens marcados para revisar (texto muito curto ou muito longo).")
    return {"contextos": contextos, "questoes": questoes, "imagens": imagens, "avisos": avisos}
