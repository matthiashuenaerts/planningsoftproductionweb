import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK_CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID");
const FALLBACK_CLIENT_SECRET = Deno.env.get("MICROSOFT_CLIENT_SECRET");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "get-auth-url") {
      const { redirectUri, state, codeChallenge, clientId } = await req.json();
      
      const microsoftClientId = clientId || FALLBACK_CLIENT_ID;
      if (!microsoftClientId) {
        return new Response(
          JSON.stringify({ error: "Microsoft Client ID not configured for this tenant" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const authUrl = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
      authUrl.searchParams.set("client_id", microsoftClientId);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", "Files.Read Files.Read.All Files.ReadWrite Files.ReadWrite.All offline_access");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("response_mode", "query");
      authUrl.searchParams.set("code_challenge_method", "S256");
      authUrl.searchParams.set("code_challenge", codeChallenge);

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "exchange-code") {
      const { code, redirectUri, codeVerifier, clientId, clientSecret } = await req.json();
      
      const microsoftClientId = clientId || FALLBACK_CLIENT_ID;
      const microsoftClientSecret = clientSecret || FALLBACK_CLIENT_SECRET;
      
      console.log("exchange-code called", { redirectUri, hasCode: !!code, hasCodeVerifier: !!codeVerifier, hasClientId: !!microsoftClientId, hasClientSecret: !!microsoftClientSecret });

      if (!microsoftClientId) {
        return new Response(
          JSON.stringify({ error: "Microsoft Client ID not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body: Record<string, string> = {
        client_id: microsoftClientId,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      };

      // Add client_secret if available (confidential client)
      if (microsoftClientSecret) {
        body.client_secret = microsoftClientSecret;
      }

      const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body),
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        console.error("Microsoft token exchange error:", tokens.error, tokens.error_description);
        return new Response(
          JSON.stringify({ error: tokens.error_description || tokens.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Token exchange successful");
      return new Response(
        JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "refresh-token") {
      const { refreshToken, clientId, clientSecret } = await req.json();
      
      const microsoftClientId = clientId || FALLBACK_CLIENT_ID;
      const microsoftClientSecret = clientSecret || FALLBACK_CLIENT_SECRET;
      
      if (!microsoftClientId) {
        return new Response(
          JSON.stringify({ error: "Microsoft Client ID not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body: Record<string, string> = {
        client_id: microsoftClientId,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      };

      if (microsoftClientSecret) {
        body.client_secret = microsoftClientSecret;
      }

      const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body),
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        console.error("Token refresh error:", tokens.error, tokens.error_description);
        return new Response(
          JSON.stringify({ error: tokens.error_description || tokens.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || refreshToken,
          expires_in: tokens.expires_in,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
