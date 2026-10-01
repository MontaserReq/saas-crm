const WIDGET_URL = 'https://3cf7-2a01-9700-6484-9f01-7971-de3b-d0d2-b07c.ngrok-free.app/widget.js';

export async function GET() {
  const response = await fetch(WIDGET_URL, {
    headers: { 'ngrok-skip-browser-warning': 'true' },
    cache: 'no-store',
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
    },
  });
}
