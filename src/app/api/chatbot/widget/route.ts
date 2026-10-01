const WIDGET_URL = process.env.CHATBOT_WIDGET_URL;

export async function GET() {
  if (!WIDGET_URL) return new Response('Unable to load chatbot widget.', { status: 503 });
  const response = await fetch(WIDGET_URL, {
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    return new Response('Unable to load chatbot widget.', { status: 502 });
  }

  const source = await response.text();
  // The widget derives its API base from document.currentScript.src. Point it
  // to our same-origin proxy so browser CORS does not block widget requests.
  const script = source.replace(
    'const base = new URL(tag.src).origin',
    "const base = '/api/chatbot/proxy'",
  );

  return new Response(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
