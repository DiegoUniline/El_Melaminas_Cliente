import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClientBilling {
  id: string;
  client_id: string;
  billing_day: number;
  monthly_fee: number;
  balance: number;
}

interface Client {
  id: string;
  first_name: string;
  last_name_paterno: string;
  status: string;
  client_billing: ClientBilling[];
}

interface ExistingCharge {
  client_id: string;
  description: string;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();
    const monthName = MONTH_NAMES[now.getMonth()];
    
    // Calculate billing day (default 10) - generate charges after this day
    const currentDay = now.getDate();
    
    console.log(`Ejecutando generación de mensualidades: ${monthName} ${currentYear}`);

    // 1. Get all active clients with their billing info
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select(`
        id,
        first_name,
        last_name_paterno,
        status,
        client_billing (
          id,
          client_id,
          billing_day,
          monthly_fee,
          balance
        )
      `)
      .eq('status', 'active');

    if (clientsError) {
      throw new Error(`Error fetching clients: ${clientsError.message}`);
    }

    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No hay clientes activos',
        generated: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Get existing charges for current month
    const chargeDescription = `Mensualidad ${monthName} ${currentYear}`;
    const { data: existingCharges, error: chargesError } = await supabase
      .from('client_charges')
      .select('client_id, description')
      .eq('description', chargeDescription);

    if (chargesError) {
      throw new Error(`Error fetching charges: ${chargesError.message}`);
    }

    const clientsWithCharges = new Set(
      (existingCharges as ExistingCharge[] || []).map((c) => c.client_id)
    );

    // 3. Find clients missing charges for current month
    const clientsNeedingCharges = (clients as Client[]).filter((client) => {
      const billing = client.client_billing?.[0];
      if (!billing || !billing.monthly_fee) return false;
      if (clientsWithCharges.has(client.id)) return false;
      return true;
    });

    if (clientsNeedingCharges.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: `Todos los cargos de ${monthName} ${currentYear} ya están generados`,
        generated: 0,
        total_clients: clients.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Create charges for clients that need them
    const newCharges = clientsNeedingCharges.map((client) => {
      const billing = client.client_billing[0];
      const billingDay = billing.billing_day || 10;
      const dueDate = new Date(currentYear, currentMonth - 1, billingDay);
      
      return {
        client_id: client.id,
        description: chargeDescription,
        amount: billing.monthly_fee,
        status: 'pending',
        due_date: dueDate.toISOString().split('T')[0],
      };
    });

    const { error: insertError } = await supabase
      .from('client_charges')
      .insert(newCharges);

    if (insertError) {
      throw new Error(`Error inserting charges: ${insertError.message}`);
    }

    // 5. Update balances for each client
    let balanceUpdates = 0;
    for (const client of clientsNeedingCharges) {
      const billing = client.client_billing[0];
      const newBalance = (billing.balance || 0) + billing.monthly_fee;
      
      const { error: updateError } = await supabase
        .from('client_billing')
        .update({ balance: newBalance })
        .eq('id', billing.id);
      
      if (!updateError) {
        balanceUpdates++;
      } else {
        console.error(`Error updating balance for client ${client.id}: ${updateError.message}`);
      }
    }

    console.log(`Generados ${newCharges.length} cargos de mensualidad para ${monthName} ${currentYear}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Cargos generados exitosamente`,
      generated: newCharges.length,
      balance_updates: balanceUpdates,
      month: monthName,
      year: currentYear,
      total_clients: clients.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error en generate-monthly-charges:', errorMessage);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
