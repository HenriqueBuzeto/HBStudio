import { NextRequest } from "next/server";
import { forwardToBackend } from "@/lib/bff-client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetPath = `/api/fiscal/${path.join("/")}`;
  return forwardToBackend(request, targetPath);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetPath = `/api/fiscal/${path.join("/")}`;
  return forwardToBackend(request, targetPath);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetPath = `/api/fiscal/${path.join("/")}`;
  return forwardToBackend(request, targetPath);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetPath = `/api/fiscal/${path.join("/")}`;
  return forwardToBackend(request, targetPath);
}
