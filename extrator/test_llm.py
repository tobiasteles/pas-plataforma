"""Testes com transporte falso (sem rede, sem chave): python test_llm.py"""
import os, time, tempfile
ARQ = os.path.join(tempfile.gettempdir(), "uso_teste.json")
for k in list(os.environ):  # isola o teste das suas variáveis/.env reais
    if k.startswith(("NVIDIA_", "GROQ_", "GROK_", "OLLAMA_", "LLM_")): del os.environ[k]
os.environ.update(LLM_SEM_ENV="1", LLM_ORDER="nvidia,groq,ollama", NVIDIA_API_KEY="x", GROQ_API_KEY="y", OLLAMA_MODEL="m", LLM_USO_ARQ=ARQ)
import llm; from llm import LLM, SemProvedor
def novo(respostas, **kw):
    chamadas = []
    def http(url, corpo, chave, to):
        chamadas.append(url.split("/v1")[0][-12:]); return respostas.pop(0)
    return LLM(transporte=http, dormir=lambda s: None, **kw), chamadas
OK = (200, {"choices": [{"message": {"content": "oi"}}]}, {})
def zera(): os.path.exists(ARQ) and os.remove(ARQ)

zera(); ia, c = novo([(503, {}, {}), (503, {}, {}), OK]); assert ia.chat([])[1] == "nvidia" and len(c) == 3        # retry 5xx no mesmo provedor
zera(); ia, c = novo([(401, {}, {}), OK]); assert ia.chat([])[1] == "groq" and len(c) == 2                         # 401: sem retry, troca
zera(); ia, c = novo([(429, {}, {"Retry-After": "120"}), OK]); assert ia.chat([])[1] == "groq" and len(c) == 2     # cota longa: troca sem esperar
zera(); ia, c = novo([(0, {}, {})] * 6 + [OK]); assert ia.chat([])[1] == "ollama"                                  # nvidia e grok esgotam 3 tentativas, ollama responde
zera(); ia, c = novo([(400, {}, {})] * 3)
try: ia.chat([]); assert False
except SemProvedor: assert len(c) == 3                                                                                 # 400 nunca repete
zera(); os.environ["LLM_LIMITE_NVIDIA"] = "1"; ia, c = novo([OK, OK]); ia.chat([]); assert ia.chat([])[1] == "groq"  # limite diário: troca antes de esgotar
zera(); os.environ["LLM_LIMITE_NVIDIA"] = "0"
VAZIO = (200, {"choices": [{"message": {"content": None}}]}, {})
ia, c = novo([VAZIO, OK]); assert ia.chat([])[1] == "groq" and len(c) == 2                                          # content null: troca de provedor
zera(); os.environ["LLM_LIMITE_NVIDIA"] = "0"
ia, c = novo([(404, {"_erro": "sem acesso"}, {}), OK, OK]); ia.chat([]); assert ia.chat([])[1] == "groq" and len(c) == 3      # 404: nvidia fica de fora nas chamadas seguintes
zera(); ia, c = novo([(404, {}, {}), (429, {}, {"Retry-After": "90"}), (500, {}, {})] + [(500, {}, {})] * 3)
try: ia.chat([]); assert False
except SemProvedor as e: assert all(n in str(e) for n in ("nvidia", "groq", "ollama"))                                   # erro lista TODOS os provedores
os.environ["NVIDIA_MODEL"] = "nvidia  meta/llama-3.2-90b-vision-instruct"
assert LLM(ordem=["nvidia"]).provs[0]["modelo"] == "meta/llama-3.2-90b-vision-instruct"; del os.environ["NVIDIA_MODEL"]  # espaço colado no .env
print("todos os testes passaram")
