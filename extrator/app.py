"""API HTTP do extrator. Rodar: uvicorn app:app --port 8001"""
import os

from fastapi import FastAPI, File, Header, HTTPException, UploadFile

from servico import extrair_bytes

CHAVE = os.environ.get("EXTRATOR_KEY")
app = FastAPI(title="Extrator PAS")


@app.get("/saude")
def saude():
    return {"ok": True}


@app.post("/extrair")
def extrair_prova(arquivo: UploadFile = File(...), x_api_key: str | None = Header(default=None)):
    if CHAVE and x_api_key != CHAVE:
        raise HTTPException(401, "Chave inválida")
    try:
        return extrair_bytes(arquivo.file.read())
    except ValueError as e:
        raise HTTPException(422, str(e))
