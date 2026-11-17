import { NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/bff-client";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  return forwardToBackend(request, query ? `/api/inventory/kardex?${query}` : "/api/inventory/kardex");
}
