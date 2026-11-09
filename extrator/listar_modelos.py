"""Mostra os modelos que CADA provedor libera para as suas chaves (lê o .env do extrator).
Uso:  python listar_modelos.py            -> todos os provedores
      python listar_modelos.py llama      -> só ids que contêm 'llama' (útil na NVIDIA, que tem centenas)"""
import json, sys, urllib.request, urllib.error
import llm


def listar(p, filtro=""):
    req = urllib.request.Request(p["url"] + "/models", headers={"User-Agent": "extrator-pas/1.0", "Accept": "application/json",
                                                               **({"Authorization": f"Bearer {p['chave']}"} if p["chave"] else {})})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            dados = json.loads(r.read())
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}: {e.read()[:200].decode('utf-8', 'ignore')}"
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"
    ids = sorted(m.get("id", "") for m in dados.get("data", []))
    return [i for i in ids if filtro.lower() in i.lower()], None


if __name__ == "__main__":
    filtro = sys.argv[1] if len(sys.argv) > 1 else ""
    ia = llm.LLM()
    print("Provedores carregados do .env:", ", ".join(p["nome"] for p in ia.provs) or "NENHUM (confira os nomes das variáveis)")
    for p in ia.provs:
        ids, erro = listar(p, filtro)
        print(f"\n== {p['nome']}  (modelo configurado: {p['modelo']})")
        if erro: print("  erro:", erro); continue
        print("  configurado está disponível?", "SIM" if p["modelo"] in ids or not filtro and p["modelo"] in ids else "NÃO (ou fora do filtro)")
        for i in ids[:60]: print("  ", i)
        if len(ids) > 60: print(f"   ... +{len(ids) - 60} (use um filtro: python listar_modelos.py llama)")
