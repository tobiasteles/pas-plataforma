"""Testa se um modelo REALMENTE responde na sua conta (pergunta mínima, gasta quase nada).
Uso:  python testar_modelos.py                       -> testa o modelo configurado de cada provedor no .env
      python testar_modelos.py nvidia MODELO1 MODELO2 ...   -> testa vários modelos de um provedor"""
import sys
import llm


def testar(ia, p, modelo):
    p = dict(p, modelo=modelo)
    ia.provs, ia.fora, ia.log = [p], {}, []
    msg = [{"role": "user", "content": 'Responda somente com a palavra: ok'}]
    try:
        txt, _ = ia.chat(msg, max_tokens=300)
        return True, txt.strip()[:40]
    except llm.SemProvedor as e:
        return False, str(e).replace("nenhum provedor respondeu: ", "")[:220]


if __name__ == "__main__":
    ia = llm.LLM(tentativas=1); base = list(ia.provs)
    if len(sys.argv) > 2:
        alvo = [p for p in base if p["nome"] == sys.argv[1]]
        if not alvo: sys.exit(f"provedor '{sys.argv[1]}' não carregado do .env")
        jobs = [(alvo[0], m) for m in sys.argv[2:]]
    else:
        jobs = [(p, p["modelo"]) for p in base]
    for p, m in jobs:
        ok, info = testar(ia, p, m)
        print(("FUNCIONA  " if ok else "FALHOU    ") + f"{p['nome']:7} {m}  ->  {info}")
