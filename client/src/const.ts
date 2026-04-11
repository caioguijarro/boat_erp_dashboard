export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const authMode = (import.meta.env.VITE_AUTH_MODE ?? "").trim().toLowerCase();

  if (authMode === "local") {
    return "/dashboard";
  }

  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  
  if (!oauthPortalUrl || !appId) {
    console.error("Variáveis de ambiente VITE_OAUTH_PORTAL_URL ou VITE_APP_ID não configuradas.");
    return "#error-config";
  }

  try {
    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    const state = btoa(redirectUri);

    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  } catch (e) {
    console.error("Erro ao construir URL de login:", e);
    return "#error-url";
  }
};
