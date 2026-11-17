import { NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/bff-client";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();
  const endpoint = query ? `/api/catalog/models?${query}` : "/api/catalog/models";
  return forwardToBackend(request, endpoint);
}

export async function POST(request: NextRequest) {
  return forwardToBackend(request, "/api/catalog/models");
}
