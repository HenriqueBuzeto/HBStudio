import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get("hb_access_token")?.value;
  const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:5021";
  const { id } = await params;

  if (!token) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const endpoint = body.action === "toggle-status" 
      ? `${apiUrl}/api/users/${id}/toggle-status` 
      : `${apiUrl}/api/users/${id}/password`;

    const backendRes = await fetch(endpoint, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar usuário no backend." }, { status: 503 });
  }
}
