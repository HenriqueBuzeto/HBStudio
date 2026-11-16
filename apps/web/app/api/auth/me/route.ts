import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("hb_access_token")?.value;
  const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:5021";

  if (!token) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const backendRes = await fetch(`${apiUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!backendRes.ok) {
      // Token expirado ou revogado no servidor: limpa o cookie
      const res = NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });
      res.cookies.set("hb_access_token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return res;
    }

    const user = await backendRes.json();
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Erro de comunicação interna." }, { status: 503 });
  }
}
