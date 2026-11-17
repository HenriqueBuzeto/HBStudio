import { NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/bff-client";

export async function POST(request: NextRequest) {
  return forwardToBackend(request, "/api/inventory/initial-receipt");
}
