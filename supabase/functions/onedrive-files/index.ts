import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken, folderId, driveId } = await req.json();

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Access token required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the Graph API URL
    let graphUrl: string;
    if (driveId && folderId) {
      graphUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}/children`;
    } else if (folderId) {
      graphUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`;
    } else {
      graphUrl = `https://graph.microsoft.com/v1.0/me/drive/root/children`;
    }

    const response = await fetch(graphUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Graph API error:", error);
      return new Response(
        JSON.stringify({ error: error.error?.message || "Failed to fetch files" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Transform the response to include only necessary fields
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
