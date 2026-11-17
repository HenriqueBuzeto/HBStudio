import { NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/bff-client";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  return forwardToBackend(request, query ? `/api/procurement/receipts?${query}` : "/api/procurement/receipts");
}

export async function POST(request: NextRequest) {
  return forwardToBackend(request, "/api/procurement/receipts");
}
