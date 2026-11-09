#!/usr/bin/env python3
"""Corrige questoes-import.json para o importador do site (admin.ts / importarJson).
Uso: python corrigir_json.py entrada.json pasta_saida [--max-mb 3.5]"""
import json, re, sys, collections
from pathlib import Path

entrada, saida = Path(sys.argv[1]), Path(sys.argv[2]); saida.mkdir(parents=True, exist_ok=True)
MAX = float(sys.argv[sys.argv.index('--max-mb') + 1]) * 1e6 if '--max-mb' in sys.argv else 3.5e6
SEM_TEXTO = re.compile(r'não extraído', re.I)
RE_ALT = re.compile(r'(?:^|\n)\s*A\s.*?(?:\n)\s*B\s.*?(?:\n)\s*C\s.*?(?:\n)\s*D\s', re.S)

def rotulo(prova):
    p = re.sub(r'\s*\(\d+\)$', '', prova)
    m = re.match(r'pas-?(\d)-prova-(\d{4})(?:_p(\d))?', p)
    if not m: return p
    return f"PAS {m[1]} – Prova {m[2]}" + (f" (parte {m[3]})" if m[3] else "")

def tipo_de(q):
    t, g, txt = q['tipo'], (q.get('gabarito') or '').upper(), q['enunciado']
    if t in ('certo_errado', 'multipla_escolha'): return t
    if t.startswith('num'): return 'numerica' if g.isdigit() else 'discursiva'
    if q.get('opcoes') or RE_ALT.search(txt): return 'multipla_escolha'
    if g in ('C', 'E'): return 'certo_errado'
    if g in ('A', 'B', 'C', 'D'): return 'multipla_escolha'
    return 'discursiva'          # desconhecido sem pista: fica fora da pontuação automática

stats = collections.Counter(); ok, pend = [], []
for q in json.load(open(entrada, encoding='utf-8'))['questoes']:
    prova = re.sub(r'\s*\(\d+\)$', '', q['prova'])
    tipo = tipo_de(q); g = (q.get('gabarito') or '').upper() or None
    valido = {'certo_errado': ('C', 'E'), 'multipla_escolha': ('A', 'B', 'C', 'D')}.get(tipo)
    if tipo == 'numerica': valido = None if (g and g.isdigit()) else ()
    elif tipo == 'discursiva': g, valido = None, None
    revisar = bool(q.get('revisar'))
    if valido is not None and g not in valido:
        if g: stats['gabarito inválido p/ o tipo → removido'] += 1
        g, revisar = None, True
    txt = q['enunciado'].strip()
    sem_texto = bool(SEM_TEXTO.search(txt)) or len(txt) < 15
    if len(txt) > 1100: revisar = True; stats['texto longo (itens colados) → revisar'] += 1
    if tipo != q['tipo']: stats[f"tipo {q['tipo']} → {tipo}"] += 1
    imgs = list(dict.fromkeys('dados/imagens/' + Path(i).name for i in q.get('imagens') or []))
    out = {'id': re.sub(r'\s*\(\d+\)', '', q['id']), 'prova': rotulo(prova), 'ano': q['ano'], 'numero': q['numero'],
           'etapa': q['etapa'], 'tipo': tipo, 'enunciado': txt, 'imagens': imgs, 'revisar': revisar}
    if g: out['gabarito'] = g
    if q.get('opcoes'): out['opcoes'] = q['opcoes']
    (pend if sem_texto else ok).append(out)

# ids únicos (segurança contra "ON CONFLICT ... a second time")
vistos = set()
for q in ok + pend:
    assert q['id'] not in vistos, q['id']; vistos.add(q['id'])

def partes(lista):
    grupos, atual, tam = [], [], 0
    for q in lista:
        n = len(json.dumps(q, ensure_ascii=False).encode())
        if atual and tam + n > MAX: grupos.append(atual); atual, tam = [], 0
        atual.append(q); tam += n
    return grupos + ([atual] if atual else [])

arqs = []
for i, p in enumerate(partes(ok), 1):
    f = saida / f'import-parte-{i:02d}.json'
    f.write_text(json.dumps({'contextos': [], 'questoes': p}, ensure_ascii=False), encoding='utf-8'); arqs.append(f)
(saida / 'pendentes-sem-texto.json').write_text(json.dumps({'contextos': [], 'questoes': pend}, ensure_ascii=False), encoding='utf-8')
print('prontas p/ importar:', len(ok), '| sem texto (separadas):', len(pend))
for k, v in stats.items(): print(' ', v, k)
for f in arqs: print(f.name, round(f.stat().st_size / 1e6, 2), 'MB')
print('imagens referenciadas:', len({i for q in ok for i in q['imagens']}))
