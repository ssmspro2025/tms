export default (async (req) => {
  try {
    // Log headers for debugging
    try {
      console.log('auth-login headers', Object.fromEntries(req.headers.entries()));
    } catch (_) {}
    const auth = req.headers.get('Authorization');
    // Allow unauthenticated requests for safe testing: return a clear test response
    if (!auth) {
      return new Response(JSON.stringify({
        ok: true,
        test: true,
        message: 'unauthenticated test response'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
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
        'Content-Type': 'application/json'
      }
    });
  }
});
