import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:5021";

    const backendRes = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!backendRes.ok) {
      return NextResponse.json(
        { error: "Não foi possível entrar. Verifique suas credenciais ou procure o responsável pelo acesso." },
        { status: backendRes.status }
      );
    }

    const data = await backendRes.json();
    const { accessToken, user } = data;

    // Resposta BFF com Cookie HttpOnly blindado contra XSS
    const response = NextResponse.json({ user });

    response.cookies.set("hb_access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60, // 8 horas
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Não foi possível conectar ao servidor. Tente novamente." },
      { status: 503 }
    );
  }
}
