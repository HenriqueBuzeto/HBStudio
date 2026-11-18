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
  const isApiRequest = pathname.startsWith("/api/");

  // 1. Usuário tenta acessar rota protegida sem cookie HttpOnly
  if (!isPublic && !token) {
    // Se for uma requisição de API (/api/*), NUNCA redirecionar para HTML (/login)
    // Retornar JSON 401 Unauthorized estruturado
    if (isApiRequest) {
      return NextResponse.json(
        {
          error: "Sessão não encontrada ou expirada.",
          code: "UNAUTHORIZED",
          message: "Faça login novamente para continuar."
        },
        { status: 401 }
      );
    }

    // Se for página navegável, redireciona para a tela de login preservando returnUrl
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("returnUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Nao redirecionar /login apenas porque existe um cookie: ele pode estar
  // expirado, revogado ou incorreto. O /api/auth/me valida a sessao de fato.
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
