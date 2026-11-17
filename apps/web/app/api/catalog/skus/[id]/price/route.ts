import { NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/bff-client";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardToBackend(request, `/api/catalog/skus/${id}/price`);
}
