import type { Config } from "tailwindcss";

// Cores vêm de variáveis CSS (src/app/globals.css) para o modo escuro trocar tudo de uma vez.
const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        folha: c("folha"),          // fundo da página (verde-sálvia bem claro)
        papel: c("papel"),          // superfície de cartões e campos
        grafite: c("grafite"),      // texto principal
        suave: c("suave"),          // texto secundário
        linha: c("linha"),          // bordas e divisórias
        mata: { DEFAULT: c("mata"), escura: c("mata-escura"), tinta: c("mata-tinta") },
        azul: { DEFAULT: c("azul"), tinta: c("azul-tinta") },
        ipe: c("ipe"),              // amarelo-ipê: só detalhes e marcações, nunca texto
        acerto: { DEFAULT: c("acerto"), texto: c("acerto-texto"), fundo: c("acerto-fundo") },
        erro: { DEFAULT: c("erro"), fundo: c("erro-fundo") },
        duvida: { texto: c("duvida-texto"), fundo: c("duvida-fundo") },
      },
      fontFamily: {
        sans: ["var(--font-ui)", "system-ui", "sans-serif"],
        leitura: ["var(--font-leitura)", "Georgia", "serif"],
      },
      boxShadow: {
        // sombras em duas camadas, tingidas com o grafite (não cinza puro)
        papel: "0 1px 0 rgb(var(--grafite) / 0.04), 0 14px 26px -20px rgb(var(--grafite) / 0.40)",
        elevado: "0 1px 0 rgb(var(--grafite) / 0.05), 0 22px 40px -24px rgb(var(--grafite) / 0.45)",
      },
    },
  },
  plugins: [],
} satisfies Config;
