# PROGRESSO — PAS·Questões (reforma do extrator e do site)

## Regras do jogo (combinadas com o Tobias)
- PDFs originais são a fonte da verdade; o banco atual será apagado e refeito.
- Extrator/gabarito funcionam SEM IA e SEM internet. IA = botão opcional, 1 questão por vez, desligada por padrão (LLM_REFINAR=0).
- Nada entra no site público sem preview + aprovação. Editor manual de recorte é o plano B.
- Trabalhar por etapas; parar ao fim de cada uma e esperar "pode seguir". Respostas curtas, em português simples.
- Discursivas (tipo D) sem resposta fixa: `gabarito_obs = "sem gabarito (discursiva)"`, não contam como falta.

## Etapas
- [x] 0 — chaves expostas (REVOGAR!), .gitignore, plano, diagnóstico confirmado
- [x] 1 — extrator por geometria + classificação v1 + CLI + testes (este arquivo descreve)
- [ ] 2 — gabarito integrado (casar por caderno/etapa/número; preliminar/definitivo/anulado)
- [ ] 3 — preview e aprovação no admin (+ correção de disciplina em lote)
- [ ] 4 — editor manual de recorte
- [ ] 5 — banco/infra (imagens fora do Postgres, busca, lote, endpoint protegido, jobs)
- [ ] 6 — site (filtros, páginas públicas, celular, acessibilidade, estudo)
- [ ] 7 — modelo local de disciplinas treinável + login/segurança + IA por botão + docs

## Comandos úteis (pasta extrator/)
- `python processar_pasta.py PASTA_PDFS SAIDA [--sem-imagens]` → prova.json, imagens/, recortes/, relatorio.md/json; sai com código 1 se as metas falharem
- `python -m unittest discover -s tests -v` → 9 testes (sem rede, sem IA)
- `pip install -r requirements.txt` (pdfplumber, Pillow, ...)

## Arquivos principais (Etapa 1)
- `extrair_geo.py` — extrator novo (colunas → blocos por linhas finas → itens por número sequencial → texto-base, figuras, recortes, tipo)
- `ids.py` — ÚNICO padrão de ids/nomes: `pas3-2023-q042`, `pas3-2023-ing-q003` (ano = ano de APLICAÇÃO)
- `classificar_v2.py` + `disciplinas.json` (léxico editável) — disciplina com confiança/motivo/sugestões
- `relatorio.py`, `processar_pasta.py`; testes em `tests/` (golden de 3 provas + disciplinas)
- Antigos ainda no repo (não mais usados pelo fluxo novo): `extrair.py` (só helpers), `classificar.py`, `corrigir_json.py`, `refinar.py` (remover instrução de misturar texto-base: Etapa 7)

## Decisões / aprendizados
- PAS3 tem 140 itens: 3 línguas × 10 + itens 11–120. Os 3 PDFs de amostra (2008, 2015, 2023): 140/140 em todos.
- Item número só vale se for o próximo da sequência, estiver na margem da coluna e não for "106 e 107 ..." (continuação de frase).
- Blocos = separados por linhas finas ≥ 225 pt; no topo de coluna sem linha, decide por pontuação/figura.
- Símbolos matemáticos saem como "(cid:N)" no texto → questão marcada `revisar`; o recorte em imagem é a rede de segurança.
- Gabaritos 2015 são PRELIMINARES (caderno Salgado); 2008 e 2023 definitivos; X/"anular" = anulado; B vira número (ex.: 742); D = discursiva.
- PDFs sem texto (capas) só geram aviso; OCR de verdade ainda NÃO implementado (Tesseract sem idioma `por` no ambiente).

## Próximo passo
Etapa 2: `gabarito.py` lê a GRADE por posição (texto corrido sai embaralhado), casa por etapa/ano/língua/número, guarda `status_gabarito`.
Pendências do usuário: revogar chaves NVIDIA/Groq/Ollama; conferir rótulos provisórios em tests/golden_disciplinas.json; checar OCR para provas 2005–2010 escaneadas.
