export default (async (req) => {
  // Basic CORS helper — in production you may want to restrict the origin
  const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    // Allow the browser to expose these headers to the client JavaScript
    'Access-Control-Expose-Headers': 'Content-Type'
  } as Record<string,string>;

  // Respond to preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    // Log headers for debugging
    try {
      console.log('auth-login headers', Object.fromEntries(req.headers.entries()));
    } catch (_) {}

    const auth = req.headers.get('Authorization');

    // Allow unauthenticated requests for safe testing: return a clear test response
    if (!auth) {
      const resp = new Response(JSON.stringify({
        ok: true,
        test: true,
        message: 'unauthenticated test response'
      }), {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      });
      return resp;
    }

    const data = await req.json().catch(()=>({}));
    const email = data?.email ?? null;
    const body = {
      ok: true,
      message: 'auth-login placeholder',
      email
    };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: String(err)
    }), {
      status: 500,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json'
      }
    });
  }
});
