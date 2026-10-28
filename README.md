# PAS·Questões (Next.js 15 + Neon + Drizzle)

## Rodar (passo a passo)
1. Instale Node 20+ e crie um projeto gratuito em https://neon.tech (copie a *connection string*).
2. `cp .env.example .env.local` e preencha `DATABASE_URL`, `AUTH_SECRET` (`openssl rand -base64 32`) e `ADMIN_EMAIL` (seu e-mail).
3. `npm install`
4. `npx drizzle-kit push` — cria as tabelas no Neon.
5. `npm run dev` → http://localhost:3000
6. Em **/cadastrar** crie a conta com o e-mail igual ao `ADMIN_EMAIL` (ela vira admin).
7. Em **/admin** envie `public/dados/questoes.json` (já vem com as 720 questões do extrator). As figuras já estão em `public/dados/imagens/`.
8. Em **/admin/obras** cadastre as obras da matriz; em **/admin/questoes** vincule obras, preencha gabarito e resolução. Gabaritos em lote: CSV `id,gabarito` na tela do admin.
9. Em **/admin/cursos** cadastre cursos e notas de corte oficiais.

## Enviar prova em PDF (extração automática)
O admin recebe o PDF, extrai as questões/figuras e grava no banco. A extração roda em Python, num serviço à parte (`extrator/`):
```
cd extrator
pip install -r requirements.txt
uvicorn app:app --port 8001
```
No `.env.local`: `EXTRATOR_URL=http://localhost:8001` e `EXTRATOR_KEY` (opcional; use a mesma no serviço: `EXTRATOR_KEY=... uvicorn ...`).
Aí, em **/admin → Enviar prova em PDF**, selecione o(s) PDF(s) (pode ser parte 1 e parte 2) e clique em *Extrair e salvar*.
As figuras ficam no banco (tabela `stored_images`, servidas em `/api/img/…`), então não precisa copiar imagens.

**Em produção:** suba `extrator/` (tem Dockerfile) no Render, Railway ou Fly.io e aponte `EXTRATOR_URL` para ele. Na Vercel, o corpo da requisição tem limite de ~4,5 MB por envio: mande um PDF por vez (as provas do PAS têm 0,2–2,3 MB). Se o PDF for maior, rode o site localmente apontando para o mesmo banco Neon.

## Atualizar questões (alternativa pelo JSON)
Rode o extrator Python (`extrair.py` + `classificar.py`), copie as novas imagens para `public/dados/imagens/` e reenvie o `questoes.json` em /admin. Reenviar é seguro: atualiza sem duplicar e preserva gabarito/resolução já editados.
Campos opcionais que o JSON pode trazer: `gabarito`, `explicacao`, `dificuldade` (`facil|media|dificil`), `obras` (títulos), `etapa` (`PAS1|PAS2|PAS3`), `subprograma`.

## Deploy
Vercel: importe o repositório e defina as 3 variáveis de ambiente. Imagens em `public/` vão junto no deploy.

## Regras de pontuação
Em `src/lib/scoring.ts` (`SCORING`): tipo A certo +1/errado −1; tipos B e C certo +1/errado 0; D fora do escore automático. Confira com o edital e ajuste ali.
