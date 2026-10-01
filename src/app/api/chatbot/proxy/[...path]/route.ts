const WIDGET_ORIGIN =
  "https://3cf7-2a01-9700-6484-9f01-7971-de3b-d0d2-b07c.ngrok-free.app";

async function forward(
  request: Request,
  { params }: { params: { path: string[] } },
) {
  const target = `${WIDGET_ORIGIN}/${params.path.join("/")}${new URL(request.url).search}`;
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const origin = request.headers.get("origin");
  if (origin) headers.set("origin", origin);
  const referer = request.headers.get("referer");
  if (referer) headers.set("referer", referer);
  headers.set("ngrok-skip-browser-warning", "true");

  const response = await fetch(target, {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await request.arrayBuffer(),
    cache: "no-store",
  });

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  request: Request,
  context: { params: { path: string[] } },
) {
  return forward(request, context);
}

export async function POST(
  request: Request,
  context: { params: { path: string[] } },
) {
  return forward(request, context);
}
