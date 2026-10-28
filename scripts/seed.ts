import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { works } from "../src/db/schema";

// Exemplo mínimo só para testar a página de obras. Cadastre a matriz oficial em /admin/obras.
const db = drizzle(neon(process.env.DATABASE_URL!));
await db.insert(works).values([
  { title: "A Pena e a Lei", author: "Ariano Suassuna", type: "teatral", stage: "PAS1", summary: "Exemplo — substitua pelo perfil real." },
  { title: "Antígona", author: "Sófocles", type: "teatral", stage: "PAS1" },
  { title: "O Manual de Epicteto", author: "Epicteto", type: "literaria", stage: "PAS1" },
]).onConflictDoNothing();
console.log("seed ok");
