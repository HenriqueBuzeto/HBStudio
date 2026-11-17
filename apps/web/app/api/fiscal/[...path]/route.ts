import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const token = request.cookies.get("hb_access_token")?.value;
  const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:5021";

  if (!token) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { path } = await params;
  const targetPath = path.join("/");

  try {
    const backendRes = await fetch(`${apiUrl}/api/fiscal/${targetPath}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch {
    return NextResponse.json({ error: "Erro de comunicação com o módulo fiscal." }, { status: 503 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const token = request.cookies.get("hb_access_token")?.value;
  const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:5021";

  if (!token) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { path } = await params;
  const targetPath = path.join("/");

  try {
    const body = await request.json();
    const backendRes = await fetch(`${apiUrl}/api/fiscal/${targetPath}`, {
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
    return NextResponse.json({ error: "Erro de comunicação com o módulo fiscal." }, { status: 503 });
  }
}
