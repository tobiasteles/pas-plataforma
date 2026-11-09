# Mapa do projeto PAS·Questões (trienio) — para não refazer

## Fluxo
PDF da prova ──► extrator/ (Python, uvicorn :8001) ──► JSON {contextos, questoes} ──► /admin (site Next.js) ──► Neon (Postgres)

| Peça | Onde | Papel |
|---|---|---|
| Extrator (pdfplumber) | `extrator/extrair.py`, `classificar.py`, `gabarito.py`, `servico.py`, `app.py` | lê PDF → questões/figuras; já gera `tipo` válido |
| IA (novo) | `extrator-ia/llm.py`, `refinar.py` | NVIDIA → Groq → Ollama com retry/fallback/limite diário; só refina itens `revisar=true` |
| Importador | `src/actions/admin.ts` → `importarJson` / `enviarProvas` | upsert por `id`; reenviar não duplica e preserva gabarito editado |
| Banco | `src/db/schema.ts` | `questions.itemType` A=certo/errado, B=numérica, C=múltipla, D=discursiva |
| Conversor antigo | `scripts/convert-json.ts` | QUEBRADO (aspas escapadas) → substituído por `corrigir_json.py` |

## Contrato do JSON aceito pelo importador
obrigatórios: `id, prova, ano, numero, etapa(PAS1|PAS2|PAS3), tipo(certo_errado|multipla_escolha|numerica|discursiva), enunciado`
opcionais: `opcoes[{letra,texto}], imagens[], gabarito, explicacao, dificuldade, contexto_id, revisar, obras, subprograma, lingua`
Imagens: caminho `dados/imagens/<arquivo>.png` (site serve `/${src}`) ou `api/img/<nome>` (banco).

## Por que o site "não lia" o questoes-import.json
1. 800 questões com `tipo` fora dos 4 aceitos (`desconhecido` 786, `numérico-discursiva` 14) → insert sem `item_type`.
2. Arquivo de 6,1 MB: acima do limite de ~4,5 MB por envio da Vercel → agora dividido em partes < 3,5 MB.
3. Imagens apontavam para `output/imagens_extraidas/` (o site não serve essa pasta).
4. 632 questões sem texto ("não extraído") → separadas em `pendentes-sem-texto.json` (não importar).
5. Gabaritos incompatíveis com o tipo (96) → removidos e marcados para revisar.

## Estado (08/11/2026)
- `importacao/import-parte-01.json`: 665 questões prontas (465 marcadas `revisar` por texto com itens colados).
- Falta: copiar as PNGs para `public/dados/imagens/`; rodar `refinar.py`; reextrair os 632 pendentes dos PDFs originais.

## Comandos
```
python corrigir_json.py questoes-import.json importacao          # normaliza + divide
python refinar.py importacao/import-parte-01.json refinado.json --max 50   # IA (cache em .refinar_cache.json)
python test_llm.py                                              # testes sem rede
```
## .env do extrator
LLM_ORDER=nvidia,groq,ollama · NVIDIA_API_KEY · GROQ_API_KEY · OLLAMA_MODEL/OLLAMA_BASE_URL · LLM_LIMITE_NVIDIA=500 (chamadas/dia) · LLM_REFINAR=1 · LLM_MAX_POR_PDF=40
