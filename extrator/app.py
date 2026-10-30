"""API HTTP do extrator. Rodar: python -m uvicorn app:app --host 127.0.0.1 --port 8001"""
import os
import traceback

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

from servico import extrair_bytes

CHAVE = os.environ.get("EXTRATOR_KEY")
app = FastAPI(title="Extrator PAS")


@app.get("/saude")
def saude():
    return {"ok": True}


@app.post("/extrair")
def extrair_prova(
    arquivo: UploadFile = File(...),
    nome: str | None = Form(default=None),
    ano: int | None = Form(default=None),
    etapa: str | None = Form(default=None),
    x_api_key: str | None = Header(default=None),
):
    if CHAVE and x_api_key != CHAVE:
        raise HTTPException(401, "Chave inválida")
    try:
        return extrair_bytes(arquivo.file.read(), nome or None, ano or None,
                             etapa if etapa in ("PAS1", "PAS2", "PAS3") else None)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:  # PDF corrompido, layout inesperado etc.: mostra o motivo no site
        traceback.print_exc()
        raise HTTPException(500, f"Falha ao processar o PDF ({type(e).__name__}): {e}")