import { NextRequest, NextResponse } from "next/server";
import { forwardToBackend } from "@/lib/bff-client";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const isActive = Boolean(body.isActive);
    return forwardToBackend(request, `/api/parties/${id}/status`, {
      customMethod: "PUT",
      customBody: { isActive },
    });
  } catch {
    return NextResponse.json({ error: "Payload inválido para atualização de status." }, { status: 400 });
  }
}
