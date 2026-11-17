import { NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/bff-client";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardToBackend(request, `/api/parties/${id}`);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardToBackend(request, `/api/parties/${id}`);
}
