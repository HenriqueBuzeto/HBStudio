import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("hb_access_token")?.value;
  const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:5021";

  if (token) {
    try {
      // Notifica o backend oficial para revogar a sessão server-side na memória e auditar
      await fetch(`${apiUrl}/api/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Ignora erro de rede para garantir que o cookie seja limpo no cliente
    }
  }

  const response = NextResponse.json({ message: "Sessão encerrada com sucesso." });

  // Remove o cookie HttpOnly
  response.cookies.set("hb_access_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
