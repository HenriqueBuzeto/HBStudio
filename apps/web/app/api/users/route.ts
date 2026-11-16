import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("hb_access_token")?.value;
  const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:5021";

  if (!token) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const backendRes = await fetch(`${apiUrl}/api/users`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!backendRes.ok) {
      return NextResponse.json({ error: "Erro ao carregar usuários." }, { status: backendRes.status });
    }

    const data = await backendRes.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Erro de comunicação com o serviço de usuários." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("hb_access_token")?.value;
  const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:5021";

  if (!token) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const backendRes = await fetch(`${apiUrl}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch {
    return NextResponse.json({ error: "Erro ao criar usuário no servidor." }, { status: 503 });
  }
}
