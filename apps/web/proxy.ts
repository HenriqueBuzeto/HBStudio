import { NextRequest, NextResponse } from "next/server";

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rotas públicas que não exigem cookie de autenticação
  const publicPaths = [
    "/login",
    "/api/auth/login",
    "/api/auth/logout",
    "/favicon.ico",
    "/_next",
    "/images",
  ];

  const isPublic = publicPaths.some((p) => pathname.startsWith(p));
  const token = request.cookies.get("hb_access_token")?.value;

  // 1. Usuário tenta acessar rota protegida sem cookie HttpOnly
  if (!isPublic && !token) {
    const loginUrl = new URL("/login", request.url);
    // Preserva o caminho de retorno de forma segura (somente rotas relativas internas)
    if (pathname !== "/") {
      loginUrl.searchParams.set("returnUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 2. Usuário com cookie válido tentando acessar /login: redireciona para a home
  if (pathname === "/login" && token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
