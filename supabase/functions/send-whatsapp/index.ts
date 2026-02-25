import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const { phone, message, templateId, module } = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: "Phone and message are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get WhatsApp settings using service role to bypass RLS for reading config
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: settings, error: settingsError } = await adminClient
      .from("whatsapp_settings")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({
          error: "WhatsApp no está configurado. Configura el token en Ajustes.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!settings.api_token) {
      return new Response(
        JSON.stringify({
          error:
            "El token de WhatsAPI no está configurado. Ve a Configuración → WhatsApp.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Format phone - ensure it has country code
    let formattedPhone = phone.replace(/\D/g, "");
    if (formattedPhone.length === 10) {
      formattedPhone = "52" + formattedPhone; // Default to Mexico
    }
    if (!formattedPhone.startsWith("521")) {
      // Add WhatsApp mobile prefix for Mexico
      if (formattedPhone.startsWith("52") && formattedPhone.length === 12) {
        formattedPhone = "521" + formattedPhone.substring(2);
      }
    }

    // Send via WhatsAPI
    const response = await fetch(settings.api_url, {
      method: "POST",
      headers: {
        "x-api-token": settings.api_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "send-text",
        phone: formattedPhone,
        message: message,
      }),
    });

    const responseData = await response.json();

    // Log the message
    await adminClient.from("whatsapp_log").insert({
      template_id: templateId || null,
      module: module || "general",
      phone: formattedPhone,
      message: message,
      status: response.ok ? "sent" : "error",
      response_data: responseData,
      sent_by: userId,
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: `Error al enviar: ${JSON.stringify(responseData)}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: responseData }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error sending WhatsApp:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
