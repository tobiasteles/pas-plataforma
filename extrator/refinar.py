"""Refina questões marcadas para revisar usando a IA (com cache, limite de chamadas e validação).
Uso:  python refinar.py entrada.json saida.json [--max 50] [--so-rever]
- só chama a IA nas questões com revisar=true (as boas nem são enviadas: economiza cota)
- guarda cada resultado em .refinar_cache.json: rodar de novo NÃO repete o que já foi feito
- se a IA devolver algo inválido, a questão fica como estava"""
import json, re, sys
from pathlib import Path
from llm import LLM, SemProvedor

CACHE = Path(".refinar_cache.json")
TIPOS = {"certo_errado", "multipla_escolha", "numerica", "discursiva"}
PROMPT = ("Você recebe texto bruto extraído de um PDF de prova do PAS/UnB (Cebraspe), possivelmente com vários itens colados. "
          "Isole APENAS o item de número {n}: devolva o enunciado do item {n} COMPLETO, incluindo os dados, definições e o trecho do texto-base de que ele depende para ser resolvido sozinho (mantenha expoentes como 1,1^10), sem os outros itens e sem o número do item no início. "
          "Tipos: certo_errado (julgue, sem alternativas), multipla_escolha (alternativas A-D), numerica (resposta 000-999), discursiva. "
          "Responda SOMENTE JSON: {{\"tipo\":..., \"enunciado\":..., \"opcoes\":[{{\"letra\":\"A\",\"texto\":\"...\"}}] ou null}}. "
          "Não invente texto que não esteja no trecho. Se o item {n} não estiver no trecho, devolva {{\"erro\":\"nao_encontrado\"}}.\n\nTRECHO:\n{t}")


def ler_cache():
    if not CACHE.exists(): return {}
    b = CACHE.read_bytes()
    try: return json.loads(b.decode("utf-8"))
    except UnicodeDecodeError: return json.loads(b.decode("cp1252"))  # cache antigo salvo pelo Windows


def sem_numero(texto, n):
    """Tira o número do item que às vezes vem colado no começo ('16 Em ...')."""
    return re.sub(rf"^\s*{n}\s+(?=\D)", "", texto)


def validar(r):
    if not isinstance(r, dict) or r.get("erro") or r.get("tipo") not in TIPOS: return None
    e = (r.get("enunciado") or "").strip()
    if not 15 <= len(e) <= 3000: return None
    op = r.get("opcoes")
    if r["tipo"] == "multipla_escolha":
        if not (isinstance(op, list) and len(op) >= 2 and all({"letra", "texto"} <= set(o) for o in op)): return None
    else: op = None
    return {"tipo": r["tipo"], "enunciado": e, "opcoes": op}


def refinar_questao(q, ia):
    txt = q["enunciado"][:12000]  # limita tokens
    bruto, prov = ia.chat([{"role": "user", "content": PROMPT.format(n=q["numero"], t=txt)}], json_mode=True)
    m = re.search(r"\{.*\}", bruto or "", re.S)
    ok = validar(json.loads(m.group(0))) if m else None
    return (ok, prov)


def main(ent, sai, maximo=50, so_rever=True):
    if not Path(ent).is_file():
        sys.exit(f"Não achei o arquivo: {Path(ent).resolve()}\nColoque o import-parte-01.json nessa pasta ou passe o caminho completo, ex.: C:\\Users\\Tobias\\Downloads\\import-parte-01.json")
    dados = json.loads(Path(ent).read_text(encoding="utf-8"))
    cache = ler_cache()
    ia, feitas, melhoradas = LLM(), 0, 0
    print("Provedores ativos:", ", ".join(f"{p['nome']} ({p['modelo']})" for p in ia.provs) or "NENHUM — confira o .env")
    for q in dados["questoes"]:
        if so_rever and not q.get("revisar"): continue
        if q["id"] in cache: res = cache[q["id"]]
        else:
            if feitas >= maximo: continue
            try: res, prov = refinar_questao(q, ia); feitas += 1
            except SemProvedor as e: print("parei:", e); break
            except (json.JSONDecodeError, KeyError, TypeError): res = None
            cache[q["id"]] = res; CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
        if res:
            q.update(tipo=res["tipo"], enunciado=sem_numero(res["enunciado"], q["numero"]), revisar=False)
            if res["opcoes"]: q["opcoes"] = res["opcoes"]
            else: q.pop("opcoes", None)
            melhoradas += 1
    Path(sai).write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")
    print(f"{feitas} chamadas novas, {melhoradas} questões melhoradas, restam {sum(bool(q.get('revisar')) for q in dados['questoes'])} para revisar")


if __name__ == "__main__":
    a = sys.argv
    if len(a) < 3:
        sys.exit("Uso: python refinar.py entrada.json saida.json [--max 50]\nEx.:  python refinar.py ../importacao/import-parte-01.json ../importacao/refinado.json --max 20")
    main(a[1], a[2], int(a[a.index("--max") + 1]) if "--max" in a else 50)
