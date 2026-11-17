import { NextRequest, NextResponse } from "next/server";

export function getInternalApiUrl(): string {
  const url = process.env.API_INTERNAL_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CONFIG_ERROR: A variável de ambiente API_INTERNAL_URL é obrigatória em ambiente de produção."
      );
    }
    return "http://localhost:5021";
  }
  return url;
}

export async function forwardToBackend(
  request: NextRequest,
  endpointPath: string,
  options?: {
    customMethod?: string;
    customBody?: unknown;
  }
) {
  // 1. Proteção SSRF: Garantir que endpointPath comece obrigatoriamente com '/' e não contenha '://'
  if (!endpointPath.startsWith("/") || endpointPath.includes("://")) {
    return NextResponse.json(
      { error: "Requisição inválida: caminho de destino não permitido.", code: "INVALID_PATH" },
      { status: 400 }
    );
  }

  const method = options?.customMethod || request.method;

  // 2. Proteção CSRF em métodos de mutação (POST, PUT, DELETE, PATCH)
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase())) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");

    if (origin) {
      try {
        const originUrl = new URL(origin);
        // Validar se a origem bate com o host da requisição
        if (host && originUrl.host !== host) {
          return NextResponse.json(
            { error: "Acesso bloqueado por violação de política de Origem (CSRF detectado).", code: "CSRF_FORBIDDEN" },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json(
          { error: "Cabeçalho Origin malformado.", code: "INVALID_ORIGIN" },
          { status: 400 }
        );
      }
    } else {
      // Política Fail-Closed para Navegadores:
      // Em requisições de mutação, o navegador SEMPRE envia Origin ou Sec-Fetch-Site / Referer
      const secFetchSite = request.headers.get("sec-fetch-site");
      const referer = request.headers.get("referer");

      if (secFetchSite) {
        if (secFetchSite === "cross-site") {
          return NextResponse.json(
            { error: "Requisição cross-site bloqueada.", code: "CSRF_CROSS_SITE" },
            { status: 403 }
          );
        }
      } else if (referer) {
        try {
          const refUrl = new URL(referer);
          if (host && refUrl.host !== host) {
            return NextResponse.json(
              { error: "Acesso bloqueado por cabeçalho Referer incompatível.", code: "CSRF_FORBIDDEN" },
              { status: 403 }
            );
          }
        } catch {
          return NextResponse.json(
            { error: "Cabeçalho Referer malformado.", code: "INVALID_REFERER" },
            { status: 400 }
          );
        }
      } else if (process.env.NODE_ENV === "production") {
        // Em produção, rejeitar mutações sem Origin, Sec-Fetch-Site ou Referer
        return NextResponse.json(
          { error: "Requisição rejeitada por ausência de identificação de origem segura.", code: "CSRF_FAIL_CLOSED" },
          { status: 403 }
        );
      }
    }
  }

  // 3. Obtenção do Token HttpOnly
  const token = request.cookies.get("hb_access_token")?.value;
  if (!token) {
    return NextResponse.json(
      { error: "Sessão não encontrada ou expirada. Faça login novamente.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  let apiUrl: string;
  try {
    apiUrl = getInternalApiUrl();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro de configuração de URL.";
    return NextResponse.json({ error: msg, code: "CONFIGURATION_ERROR" }, { status: 500 });
  }

  // 4. Headers com Repasse de CorrelationId
  const correlationId =
    request.headers.get("x-correlation-id") ||
    request.headers.get("x-request-id") ||
    crypto.randomUUID();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "X-Correlation-Id": correlationId,
    Accept: "application/json",
  };

  let body: string | undefined = undefined;
  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
    if (options?.customBody !== undefined) {
      body = JSON.stringify(options.customBody);
    } else {
      try {
        const jsonBody = await request.json();
        body = JSON.stringify(jsonBody);
      } catch {
        // Body vazio é aceitável em certas mutações
      }
    }
  }

  // 5. Timeout e Cancelamento Seguro
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const backendRes = await fetch(`${apiUrl}${endpointPath}`, {
      method,
      headers,
      body,
      signal: controller.signal,
      cache: "no-store", // Nunca cachear dados transacionais de backend
    });

    clearTimeout(timeoutId);

    // Tratamento de HTTP 204 No Content
    if (backendRes.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const contentType = backendRes.headers.get("content-type");
    let responseData: unknown = null;

    if (contentType && contentType.includes("application/json")) {
      responseData = await backendRes.json();
    } else {
      responseData = await backendRes.text();
    }

    if (!backendRes.ok) {
      return NextResponse.json(
        typeof responseData === "object" && responseData !== null
          ? responseData
          : { error: responseData || "Erro retornado pelo servidor.", code: `HTTP_${backendRes.status}` },
        { status: backendRes.status }
      );
    }

    return NextResponse.json(responseData, { status: backendRes.status });
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        { error: "A requisição excedeu o tempo limite de resposta.", code: "TIMEOUT" },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Serviço temporariamente indisponível. Tente novamente mais tarde.", code: "SERVICE_UNAVAILABLE" },
      { status: 503 }
    );
  }
}
