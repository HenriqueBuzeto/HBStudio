import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("hb_access_token")?.value;
  const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:5021";

  if (!token) {
    return NextResponse.json(
      { error: "Sessão não encontrada.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    const backendRes = await fetch(`${apiUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Se o backend explicitamente retornou 401 (token expirado ou SecurityStamp revogado)
    if (backendRes.status === 401) {
      const res = NextResponse.json(
        { error: "Sessão inválida ou expirada.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
      res.cookies.set("hb_access_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return res;
    }

    // Se o backend retornou outro status de erro (ex: 403, 500, etc.), preservar exatamente o status real
    if (!backendRes.ok) {
      const errorData = await backendRes.json().catch(() => ({ error: "Erro no serviço de autenticação." }));
      return NextResponse.json(errorData, { status: backendRes.status });
    }

    const user = await backendRes.json();
    return NextResponse.json({ user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Falha na conexão";
    return NextResponse.json(
      { error: "Erro de comunicação com o serviço de backend.", details: message },
      { status: 503 }
    );
  }
}
