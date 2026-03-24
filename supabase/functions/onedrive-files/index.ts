import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, folderId, driveId, employeeId, folderName, parentFolderId, shareUrl } = await req.json();

    if (!employeeId) {
      return new Response(
        JSON.stringify({ error: "Employee ID required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch stored tokens for this employee
    const { data: tokenRow, error: tokenError } = await supabase
      .from("employee_onedrive_tokens")
      .select("*")
      .eq("employee_id", employeeId)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return new Response(
        JSON.stringify({ error: "No OneDrive tokens found. Please authenticate first." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accessToken = tokenRow.access_token;
    const expiresAt = tokenRow.expires_at;

    // Get tenant client ID for refresh
    const { data: tenantSettings } = await supabase
      .from("tenant_onedrive_settings")
      .select("microsoft_client_id")
      .eq("tenant_id", tokenRow.tenant_id)
      .maybeSingle();

    const clientId = tenantSettings?.microsoft_client_id || Deno.env.get("MICROSOFT_CLIENT_ID");
    const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");

    // Auto-refresh if token expired or expiring in 2 minutes
    if (Date.now() > expiresAt - 120000) {
      console.log("Token expired, refreshing...");
      const refreshBody: Record<string, string> = {
        client_id: clientId || "",
        refresh_token: tokenRow.refresh_token,
        grant_type: "refresh_token",
      };
      if (clientSecret) {
        refreshBody.client_secret = clientSecret;
      }
      const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(refreshBody),
      });

      const tokens = await tokenResponse.json();
      if (tokens.error) {
        console.error("Token refresh failed:", tokens.error_description);
        // Clear invalid tokens
        await supabase.from("employee_onedrive_tokens").delete().eq("employee_id", employeeId);
        return new Response(
          JSON.stringify({ error: "Token refresh failed. Please re-authenticate.", needsReauth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      accessToken = tokens.access_token;
      // Update stored tokens
      await supabase.from("employee_onedrive_tokens").update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || tokenRow.refresh_token,
        expires_at: Date.now() + (tokens.expires_in * 1000),
      }).eq("employee_id", employeeId);
    }

    // Handle resolve-share-link action (SharePoint sharing URLs)
    if (action === "resolve-share-link") {
      if (!shareUrl) {
        return new Response(
          JSON.stringify({ error: "shareUrl is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Encode the share URL for Graph API: base64url encode the URL prefixed with "u!"
      const base64Url = btoa(shareUrl)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const shareToken = `u!${base64Url}`;

      const resolveResponse = await fetch(
        `https://graph.microsoft.com/v1.0/shares/${shareToken}/driveItem?$expand=children`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!resolveResponse.ok) {
        const err = await resolveResponse.json();
        console.error("Resolve share link error:", err);
        if (resolveResponse.status === 401) {
          await supabase.from("employee_onedrive_tokens").delete().eq("employee_id", employeeId);
          return new Response(
            JSON.stringify({ error: "Authentication expired. Please re-authenticate.", needsReauth: true }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: err.error?.message || "Failed to resolve share link" }),
          { status: resolveResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const item = await resolveResponse.json();
      return new Response(
        JSON.stringify({
          resolved: {
            id: item.id,
            name: item.name,
            webUrl: item.webUrl,
            driveId: item.parentReference?.driveId,
            isFolder: !!item.folder,
            childCount: item.folder?.childCount,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle create-folder action
    if (action === "create-folder") {
      if (!folderName) {
        return new Response(
          JSON.stringify({ error: "Folder name required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create folder in root or specified parent
      let createUrl: string;
      if (driveId && parentFolderId) {
        createUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${parentFolderId}/children`;
      } else if (parentFolderId) {
        createUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${parentFolderId}/children`;
      } else {
        createUrl = `https://graph.microsoft.com/v1.0/me/drive/root/children`;
      }

      const createResponse = await fetch(createUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: folderName,
          folder: {},
          "@microsoft.graph.conflictBehavior": "rename",
        }),
      });

      if (!createResponse.ok) {
        const err = await createResponse.json();
        console.error("Create folder error:", err);
        return new Response(
          JSON.stringify({ error: err.error?.message || "Failed to create folder" }),
          { status: createResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newFolder = await createResponse.json();
      return new Response(
        JSON.stringify({
          folder: {
            id: newFolder.id,
            name: newFolder.name,
            webUrl: newFolder.webUrl,
            driveId: newFolder.parentReference?.driveId,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: list files
    let graphUrl: string;
    if (driveId && folderId) {
      graphUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}/children`;
    } else if (folderId) {
      graphUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`;
    } else {
      graphUrl = `https://graph.microsoft.com/v1.0/me/drive/root/children`;
    }

    // Add query params for shared files support
    graphUrl += "?$top=200&$orderby=name";

    const response = await fetch(graphUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Graph API error:", error);
      
      if (response.status === 401) {
        await supabase.from("employee_onedrive_tokens").delete().eq("employee_id", employeeId);
        return new Response(
          JSON.stringify({ error: "Authentication expired. Please re-authenticate.", needsReauth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: error.error?.message || "Failed to fetch files" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    const files = data.value.map((item: any) => ({
      id: item.id,
      name: item.name,
      size: item.size,
      webUrl: item.webUrl,
      createdDateTime: item.createdDateTime,
      lastModifiedDateTime: item.lastModifiedDateTime,
      isFolder: !!item.folder,
      childCount: item.folder?.childCount,
      mimeType: item.file?.mimeType,
      thumbnailUrl: item.thumbnails?.[0]?.medium?.url,
      driveId: item.parentReference?.driveId,
    }));

    return new Response(
      JSON.stringify({ files }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
