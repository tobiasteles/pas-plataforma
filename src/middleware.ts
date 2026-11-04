import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PROTEGIDAS = ["/listas", "/simulados", "/desempenho", "/cursos", "/admin", "/bem-vindo"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTEGIDAS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const token = req.cookies.get("session")?.value;
  // em produção, sem AUTH_SECRET ninguém passa (o segredo padrão só existe em desenvolvimento)
  const segredo = process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "dev-inseguro");
  try {
    const { payload } = await jwtVerify(token ?? "", new TextEncoder().encode(segredo));
    if (pathname.startsWith("/admin") && payload.role !== "admin") return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/entrar", req.url));
  }
}

export const config = {
  // não roda nas chamadas de Server Actions (cabeçalho "next-action"): elas se protegem com requireUser()/requireAdmin()
  matcher: [{ source: "/((?!_next|api|dados|img|favicon.ico).*)", missing: [{ type: "header", key: "next-action" }] }],
};
