import { NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/bff-client";

export async function GET(request: NextRequest) {
  return forwardToBackend(request, "/api/inventory/warehouses");
}

export async function POST(request: NextRequest) {
  return forwardToBackend(request, "/api/inventory/warehouses");
}
