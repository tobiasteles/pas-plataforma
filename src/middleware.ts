import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PROTEGIDAS = ["/listas", "/simulados", "/desempenho", "/cursos", "/admin"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTEGIDAS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const token = req.cookies.get("session")?.value;
  try {
    const { payload } = await jwtVerify(token ?? "", new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-inseguro"));
    if (pathname.startsWith("/admin") && payload.role !== "admin") return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/entrar", req.url));
  }
}
export const config = { matcher: ["/((?!_next|api|dados|favicon.ico).*)"] };
