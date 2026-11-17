import { NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/bff-client";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  return forwardToBackend(request, query ? `/api/procurement/orders?${query}` : "/api/procurement/orders");
}

export async function POST(request: NextRequest) {
  return forwardToBackend(request, "/api/procurement/orders");
}
