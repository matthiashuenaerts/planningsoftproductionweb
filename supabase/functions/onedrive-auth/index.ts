import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MICROSOFT_CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (!MICROSOFT_CLIENT_ID) {
      return new Response(
        JSON.stringify({ error: "Microsoft Client ID not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate auth URL for OAuth PKCE flow (public client, no secret needed)
    if (action === "get-auth-url") {
      const { redirectUri, state, codeChallenge } = await req.json();
      
      const authUrl = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
      authUrl.searchParams.set("client_id", MICROSOFT_CLIENT_ID);
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

    // Exchange code for tokens (PKCE flow - no client_secret)
    if (action === "exchange-code") {
      const { code, redirectUri, codeVerifier } = await req.json();

      const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: MICROSOFT_CLIENT_ID,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          code_verifier: codeVerifier,
        }),
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        return new Response(
          JSON.stringify({ error: tokens.error_description || tokens.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh access token (PKCE flow - no client_secret)
    if (action === "refresh-token") {
      const { refreshToken } = await req.json();

      const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: MICROSOFT_CLIENT_ID,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
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
