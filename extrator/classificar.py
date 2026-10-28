#!/usr/bin/env python3
"""
classificar.py - Atribui disciplinas as questoes do questoes.json.

Uso:
    python classificar.py            # classificacao offline por palavras-chave
    python classificar.py --api      # refina com a API da Anthropic (opcional)

Para --api: defina a variavel ANTHROPIC_API_KEY (e, se quiser, CLAUDE_MODEL).
As respostas ficam em cache (dados/classificacao_cache.json), entao rodar de novo nao gasta de novo.
"""
import json, os, re, sys, time, urllib.request
from pathlib import Path

DADOS = Path(__file__).parent / "site" / "dados"
ARQ = DADOS / "questoes.json"
CACHE = DADOS / "classificacao_cache.json"

DISCIPLINAS = ["Língua Portuguesa", "Literatura", "Matemática", "Física", "Química", "Biologia",
               "História", "Geografia", "Filosofia", "Sociologia", "Artes", "Música", "Teatro"]

# palavras-chave (regex, sem acento nao e necessario: o texto mantem acentos)
PALAVRAS = {
    "Matemática": r"\bfun[çc][ãa]o\b|equa[çc][ãa]o|[áa]rea|volume|progress[ãa]o|geom[ée]tric|aritm[ée]tic|tri[âa]ngulo|"
                  r"\bângulo|porcentag|percentual|\bjuros\b|\bgr[áa]fico|probabilidade|\bmetros?\b|\braz[ãa]o\b|"
                  r"\bcalcule\b|\bloga?ritm|\b(?:seno|cosseno)\b|pir[âa]mide|quadril[áa]tero|trap[ée]zio|\bpar[áa]bola|\bescala\b|\bpoliedro",
    "Física": r"\bvelocidade|acelera[çc][ãa]o|\bfor[çc]a\b|energia (?:cin|pot|mec)|\btorque|\bimpulso|\bcolis[ãa]o|"
              r"gravita|\bpress[ãa]o\b|\bempuxo|\bmassa\b|\bpeso\b|\bwatts?\b|\bpot[êe]ncia\b|\btrabalho (?:realizado|da)|"
              r"\bórbita|\bsat[ée]lite|\bat[ri]to\b|\bm/s|\bnewton|\bcentr[íi]peta|ondas?\b|\bcalor\b|\btemperatura de fus",
    "Química": r"\bmol\b|\bmolecul|\bátomo|\bat[ôo]mic|\bliga[çc][õo]es?|\bsubst[âa]ncia|rea[çc][ãa]o qu[íi]mica|"
               r"\bcomposto|c[áa]tion|[âa]nion|combust[ãa]o|\bfermenta[çc]|\bpolar|\bpH\b|[áa]cido|\bsal\b|\bhidrog[êe]nio|"
               r"\bcarbono|oxig[êe]nio|estequiom|coeficientes? estequi|tabela peri[óo]dica|\bdestila[çc]|\bmistura (?:homog|heter)|"
               r"\bpol[íi]mero|\bhidrogel|\bsolu[çc][ãa]o\b",
    "Biologia": r"\bcélula|\bgene\b|\bgen[ée]tic|\bevolu[çc][ãa]o\b|esp[ée]cie|ecossistema|cadeia alimentar|\bbioma|"
                r"\bfotoss[íi]ntese|\bbact[ée]ri|\bv[íi]rus|\bparasit|\bdoen[çc]a|ciclo (?:do|da|dos)|\bmicrorganism|"
                r"intera[çc][ãa]o (?:ecol|entre)|\bmutualismo|\bpredat|\bcomensalismo|\bcarbono|\bplantas?\b|\banimal|\bbiodiversidade|"
                r"\bpeixes?\b|\bimun|\bvacina|\bzoonose|\bprotozo|\beutrofiza",
    "História": r"\bImpério|\bcolon(?:ial|iza)|\bescravi|\bquilombo|\bIdade M[ée]dia|\bRenascimento|\bRevolu[çc][ãa]o\b|"
                r"\bmonarquia|\bindígena|\bindigena|\bastecas?\b|\bmaias?\b|\begípci|\bgrega?\b|\bRoma|\bdi[áa]spora|"
                r"\bséculo|\bAmérica portuguesa|\bBrasil colônia|\bColônia|\bIgreja Cat[óo]lica|\bReforma|\bantigo regime|\bfaraó|\bpir[âa]mides",
    "Geografia": r"\bbioma|\bcerrado|\bclima|\bclimograma|\brelevo|\burbaniza|\bpopula[çc][ãa]o (?:mundial|urbana|idosa)|"
                 r"\bagroneg[óo]cio|\bdesmatamento|\bterritório|\bhidrogr[áa]fic|\bmapa|\bregi[ãa]o (?:Centro|Norte|Sul|Nordeste|Sudeste)|"
                 r"\bCentro-Oeste|\bilhas? oce[âa]nic|\bglobaliza|\bSul global|\bPantanal|\bAmaz[ôo]nia|\bdéficit habitacional|\bcartograf",
    "Filosofia": r"\bEpicuro|\bEpicteto|\bepicur|\bestoic|\bS[óo]crates|\bPlat[ãa]o|\bArist[óo]teles|\b[ée]tica\b|"
                 r"\bfil[óo]sof|\bhedonis|\bconhecimento filos|\bPlatão|\bm[ée]todo cient[íi]fico|\bpseudoci[êe]ncia",
    "Sociologia": r"\bdesigualdade|\bdivis[ãa]o do trabalho|\bracismo|\bantirracist|\bidentidade de g[êe]nero|\bviol[êe]ncia de g[êe]nero|"
                  r"\btransg[êe]nero|\bLGBT|\bclasses? social|\bexclus[ãa]o|\bsegrega[çc][ãa]o|\bpobreza|\bacessibilidade|\bidosos|"
                  r"\bdireitos humanos|\bhist[óo]ria [úu]nica|\bestere[óo]tipo|\bconstitui[çc][ãa]o|\btrabalho (?:escravo|informal)",
    "Literatura": r"\bBarroco|\bArcadismo|\bTrovadorismo|\bsoneto|\bpoema|\bpoeta|\bsujeito l[íi]rico|\beu l[íi]rico|\bverso|\bestrofe|"
                  r"\bg[êe]nero l[íi]rico|\bcantiga|\bGreg[óo]rio de Matos|\bCl[áa]udio Manoel|\bGil Vicente|\bSuassuna|\bAnt[íi]gona|"
                  r"\bcordel|\bPetrarca|\bClassicismo|\bromance|\bCaminha|\bpoesia",
    "Língua Portuguesa": r"\bperíodo\b|\bpar[áa]grafo|\bvocativo|\bcoes[ãa]o|\bregência|\bconjun[çc][ãa]o|\bpronome|\bverbo|\bforma verbal|"
                         r"\bsujeito\b|\bcomplemento|\bv[íi]rgula|\badjetiv|\bsintátic|\btipologia textual|\bgramatical|\bfun[çc][ãa]o sint|"
                         r"\bsubordinad|\bcrase|\bsentido conotativo|\bregistro coloquial|\breescrit|\bprosa|\bargumentativ|\bexpositiv|\bnarrativ",
    "Música": r"\bpartitura|\bmelodia|\bharmonia|\bvoz(?:es)?\b|\bpentagrama|\bsemínima|\bcolcheia|\bacorde|\bcompasso|\bpolifonia|"
              r"\bbaixo el[ée]trico|\bviolonc|\bsoprano|\bcanto\b|\bfuga\b|\binstrumentos? musicais|\breggae|\btrovadorismo|\bópera",
    "Teatro": r"\bpeça\b|\brubrica|\bencena[çc][ãa]o|\bcoro\b|\bcom[ée]dia|\btrag[ée]dia|\bpersonagens?\b|\bdram[áa]tic|\bmamulengo|\bator(?:es)?\b|\bteatro",
    "Artes": r"\bescultura|\bpintura|\bxilogravura|\bafresco|\bperspectiva|\barquitet[ôo]nic|\bobra de arte|\barte (?:sacra|medieval|eg[ií]pci|amarna)|"
             r"\bvitr[aá]i|\bbusto|\bgótic|\bEscher|\blitografia|\bMestre Didi|\bcat[eé]dral",
}
PESOS_LOCAL = {"enun": 3, "opc": 2, "ctx": 1}
RE = {d: re.compile(p, re.I) for d, p in PALAVRAS.items()}


def pontuar(txt, peso, pts):
    for d, rx in RE.items():
        n = len(rx.findall(txt))
        if n:
            pts[d] = pts.get(d, 0) + min(n, 4) * peso


def classificar_local(q, ctx):
    if q.get("lingua"):
        return [f"Língua {q['lingua']}"]
    pts = {}
    pontuar(q["enunciado"], 3, pts)
    pontuar(" ".join(o["texto"] for o in (q["opcoes"] or [])), 2, pts)
    pontuar(ctx.get("texto", "")[:2500], 1, pts)
    if not pts:
        return ["Não classificada"]
    ordem = sorted(pts.items(), key=lambda kv: -kv[1])
    topo = ordem[0][1]
    if topo < 3:
        return ["Não classificada"]
    return [d for d, v in ordem if v >= topo * 0.6][:3]


def classificar_api(q, ctx, chave, modelo):
    prompt = (
        "Classifique a questao de vestibular (PAS/UnB) abaixo. Responda SOMENTE com JSON no formato "
        '{"disciplinas": ["..."], "assuntos": ["..."]}. '
        f"Disciplinas permitidas (1 a 3): {', '.join(DISCIPLINAS)}. "
        "Assuntos: 1 a 3 topicos curtos (ex.: 'Cinematica', 'Barroco', 'Ciclo do carbono').\n\n"
        f"TEXTO-BASE:\n{ctx.get('texto','')[:2500]}\n\nQUESTAO {q['numero']}:\n{q['enunciado']}\n"
        + "\n".join(f"{o['letra']} {o['texto']}" for o in (q["opcoes"] or []))
    )
    corpo = json.dumps({"model": modelo, "max_tokens": 300,
                        "messages": [{"role": "user", "content": prompt}]}).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=corpo, headers={
        "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        resp = json.load(r)
    txt = "".join(b.get("text", "") for b in resp["content"])
    txt = re.sub(r"```json|```", "", txt).strip()
    dados = json.loads(txt)
    disc = [d for d in dados.get("disciplinas", []) if d in DISCIPLINAS][:3]
    return disc, [a for a in dados.get("assuntos", [])][:3]


def main():
    usar_api = "--api" in sys.argv
    base = json.loads(ARQ.read_text(encoding="utf-8"))
    ctxs = {c["id"]: c for c in base["contextos"]}
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    chave = os.environ.get("ANTHROPIC_API_KEY")
    modelo = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5")
    if usar_api and not chave:
        sys.exit("Defina ANTHROPIC_API_KEY antes de usar --api (veja o README).")

    for i, q in enumerate(base["questoes"], 1):
        ctx = ctxs[q["contexto_id"]]
        disc = classificar_local(q, ctx)
        if usar_api and not q.get("lingua"):
            if q["id"] not in cache:
                try:
                    d, a = classificar_api(q, ctx, chave, modelo)
                    cache[q["id"]] = {"disciplinas": d, "assuntos": a}
                    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
                    time.sleep(0.3)
                except Exception as e:  # mantem o resultado local se falhar
                    print(f"  ! {q['id']}: {e}")
            if q["id"] in cache and cache[q["id"]]["disciplinas"]:
                disc = cache[q["id"]]["disciplinas"]
                q["assuntos"] = cache[q["id"]]["assuntos"]
        q["disciplinas"] = disc
        q["disciplina"] = disc[0]
        if usar_api and i % 25 == 0:
            print(f"  {i}/{len(base['questoes'])}")

    ARQ.write_text(json.dumps(base, ensure_ascii=False, indent=1), encoding="utf-8")
    cont = {}
    for q in base["questoes"]:
        for d in q["disciplinas"]:
            cont[d] = cont.get(d, 0) + 1
    print("Questoes por disciplina:")
    for d, n in sorted(cont.items(), key=lambda kv: -kv[1]):
        print(f"  {d:22} {n}")


if __name__ == "__main__":
    main()
