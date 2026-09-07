(function () {
  const ACCESS_COOKIE = "osso_access_token";
  let clientPromise;

  function setAccessCookie(token, expiresAt) {
    if (!token) {
      document.cookie = `${ACCESS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
      return;
    }
    const maxAge = Math.max(0, (expiresAt || 0) - Math.floor(Date.now() / 1000));
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${ACCESS_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  }

  async function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const [sdk, configResponse] = await Promise.all([
          import("https://esm.sh/@supabase/supabase-js@2.103.0"),
          fetch("/api/auth-config")
        ]);
        if (!configResponse.ok) throw new Error("Supabase Auth não configurado");
        const config = await configResponse.json();
        const client = sdk.createClient(config.supabaseUrl, config.supabaseAnonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        client.auth.onAuthStateChange((_event, session) => {
          setAccessCookie(session?.access_token, session?.expires_at);
        });
        return client;
      })();
    }
    return clientPromise;
  }

  async function getSession() {
    const client = await getClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session) setAccessCookie(data.session.access_token, data.session.expires_at);
    return data.session;
  }

  async function authorizedFetch(input, init = {}) {
    const session = await getSession();
    if (!session) {
      location.replace("/login");
      throw new Error("Sessão não autenticada");
    }
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", `Bearer ${session.access_token}`);
    const response = await fetch(input, { ...init, headers });
    if (response.status === 401 || response.status === 403) location.replace("/login");
    return response;
  }

  async function signOut() {
    const client = await getClient();
    await client.auth.signOut();
    setAccessCookie(null);
    location.replace("/login");
  }

  window.ossoAuth = { getClient, getSession, authorizedFetch, signOut };
})();
