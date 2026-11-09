"""Cliente de IA com fallback entre provedores (NVIDIA, Grok, Ollama). Só biblioteca padrão.

Ordem e limites vêm do ambiente (.env), nada de chave no código:
  LLM_ORDER=nvidia,groq,ollama          # quem tenta primeiro
  NVIDIA_API_KEY / NVIDIA_MODEL / NVIDIA_BASE_URL
  GROQ_API_KEY   / GROQ_MODEL   / GROQ_BASE_URL    # Groq (llama etc.)
  OLLAMA_API_KEY + OLLAMA_MODEL  (nuvem: endereço https://ollama.com/v1 já é automático)
  OLLAMA_BASE_URL (só se usar Ollama instalado no PC; aí a chave é opcional)
  LLM_LIMITE_NVIDIA=500 ...             # chamadas/dia: ao atingir, troca de provedor ANTES de esgotar a cota
Todos usam o formato OpenAI (/chat/completions).
"""
import json, os, random, time, urllib.error, urllib.request
from datetime import date
from pathlib import Path

def _carregar_env():
    """Lê extrator/.env (e ./.env) sem depender do python-dotenv. Variáveis já definidas no sistema têm prioridade."""
    if os.environ.get("LLM_SEM_ENV"): return  # usado nos testes: ignora o seu .env real
    for pasta in (Path(__file__).parent, Path.cwd()):
        f = pasta / ".env"
        if not f.is_file(): continue
        for linha in f.read_text(encoding="utf-8-sig").splitlines():
            linha = linha.strip()
            if not linha or linha.startswith("#") or "=" not in linha: continue
            k, v = linha.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_carregar_env()

PADROES = {  # modelos mudam: confira no painel de cada provedor e ajuste no .env
    "nvidia": ("https://integrate.api.nvidia.com/v1", "meta/llama-3.1-70b-instruct"),
    "groq": ("https://api.groq.com/openai/v1", "llama-3.3-70b-versatile"),
    "grok": ("https://api.x.ai/v1", "grok-3-mini"),  # xAI: só entra se você listar em LLM_ORDER
    "ollama": ("http://127.0.0.1:11434/v1", "llama3.1"),
}
RETENTAVEL = {429, 500, 502, 503, 504, 529}
USO = Path(os.environ.get("LLM_USO_ARQ", ".llm_uso.json"))


class SemProvedor(RuntimeError):
    pass


def _http(url, corpo, chave, timeout):
    req = urllib.request.Request(url, json.dumps(corpo).encode(), {"Content-Type": "application/json", "User-Agent": "extrator-pas/1.0", "Accept": "application/json", **({"Authorization": f"Bearer {chave}"} if chave else {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read()), {}
    except urllib.error.HTTPError as e:
        try: msg = e.read()[:300].decode("utf-8", "ignore").replace("\n", " ")
        except Exception: msg = ""
        return e.code, {"_erro": msg}, dict(e.headers or {})
    except (urllib.error.URLError, TimeoutError, OSError):
        return 0, {}, {}  # 0 = erro de rede/timeout (retentável)


class LLM:
    def __init__(self, transporte=_http, dormir=time.sleep, ordem=None, tentativas=3, timeout=60):
        self.http, self.dormir, self.tentativas, self.timeout = transporte, dormir, tentativas, timeout
        nomes = ordem or [n.strip() for n in os.environ.get("LLM_ORDER", "nvidia,groq,ollama").split(",") if n.strip()]
        self.provs = [p for p in (self._cfg(n) for n in nomes if n in PADROES) if p]
        self.fora = {}  # nome -> instante até o qual ficamos longe (cota/limite) ou inf (chave inválida)
        self.mem = {}   # contagem em memória (vale mesmo se o arquivo de uso não puder ser gravado)
        self.log = []   # (provedor, motivo) — sem chaves nem prompts

    @staticmethod
    def _cfg(n):
        up = n.upper(); url, modelo = PADROES[n]
        chave = os.environ.get(f"{up}_API_KEY", "")
        if n != "ollama" and not chave:
            return None  # nunca usa provedor sem conta/chave
        if n == "ollama" and not (os.environ.get("OLLAMA_MODEL") or os.environ.get("OLLAMA_BASE_URL")):
            return None
        if n == "ollama" and chave and not os.environ.get("OLLAMA_BASE_URL"):
            url = "https://ollama.com/v1"  # chave de API do Ollama = nuvem (ollama.com/settings/keys)
        return {"nome": n, "url": os.environ.get(f"{up}_BASE_URL", url).rstrip("/"), "modelo": os.environ.get(f"{up}_MODEL", modelo),
                "chave": chave, "limite": int(os.environ.get(f"LLM_LIMITE_{up}", "0") or 0)}

    # ---- contador diário: troca de provedor antes de a cota acabar
    def _uso(self):
        try: d = json.loads(USO.read_text())
        except Exception: d = {}
        return d if d.get("dia") == str(date.today()) else {"dia": str(date.today()), "n": {}}

    def _conta(self, nome):
        self.mem[nome] = self.mem.get(nome, 0) + 1
        d = self._uso(); d["n"][nome] = d["n"].get(nome, 0) + 1
        try: USO.write_text(json.dumps(d))
        except OSError: pass

    def _disponivel(self, p):
        if self.fora.get(p["nome"], 0) > time.time(): return False
        return not (p["limite"] and max(self._uso()["n"].get(p["nome"], 0), self.mem.get(p["nome"], 0)) >= p["limite"])

    def chat(self, mensagens, json_mode=False, max_tokens=None):
        """Devolve (texto, provedor). Levanta SemProvedor se todos falharem."""
        max_tokens = max_tokens or int(os.environ.get("LLM_MAX_TOKENS", "1500"))
        for p in self.provs:
            if not self._disponivel(p):
                self.log.append((p["nome"], "pulado (limite/quarentena)")); continue
            corpo = {"model": p["modelo"], "messages": mensagens, "temperature": 0, "max_tokens": max_tokens}
            if json_mode and p["nome"] != "grok": corpo["response_format"] = {"type": "json_object"}
            for t in range(self.tentativas):
                self._conta(p["nome"])
                st, dados, cab = self.http(f"{p['url']}/chat/completions", corpo, p["chave"], self.timeout)
                if st == 200:
                    try: texto = dados["choices"][0]["message"]["content"]
                    except (KeyError, IndexError, TypeError): texto = None
                    if isinstance(texto, str) and texto.strip(): return texto, p["nome"]
                    try: fim = dados["choices"][0].get("finish_reason")
                    except Exception: fim = None
                    self.log.append((p["nome"], f"resposta vazia (finish_reason={fim}; modelo de raciocínio? aumente LLM_MAX_TOKENS ou troque o modelo)")); break  # tenta o próximo provedor
                if st in (400, 401, 403, 404):  # não adianta repetir
                    self.log.append((p["nome"], f"HTTP {st} (sem retry): {str(dados.get('_erro', ''))[:160]}"))
                    if st in (401, 403): self.fora[p["nome"]] = float("inf")
                    break
                if st in RETENTAVEL or st == 0:
                    espera = float(cab.get("Retry-After", cab.get("retry-after", 0)) or 0) or min(30, 2 ** t) + random.random()
                    self.log.append((p["nome"], f"HTTP {st}, tentativa {t + 1}"))
                    if st == 429 and espera > 20:  # cota longa: troca de provedor em vez de esperar
                        self.fora[p["nome"]] = time.time() + espera; break
                    if t + 1 < self.tentativas: self.dormir(espera)
                    else: self.fora[p["nome"]] = time.time() + 300
                    continue
                break
        raise SemProvedor("nenhum provedor respondeu: " + "; ".join(f"{a}: {b}" for a, b in self.log[-6:]))
