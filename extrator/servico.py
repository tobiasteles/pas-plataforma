"""Núcleo do serviço: recebe os bytes de um PDF de prova e devolve questões + imagens (base64)."""
import base64
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
        imagens = {p.name: base64.b64encode(p.read_bytes()).decode() for p in (tmp / "imagens").glob("*.png")}
    return {"contextos": contextos, "questoes": questoes, "imagens": imagens}