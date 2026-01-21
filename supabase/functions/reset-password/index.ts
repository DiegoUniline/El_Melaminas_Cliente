import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Create a client with the user's token to verify they are admin
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get the current user
    const { data: { user: currentUser }, error: userError } = await userClient.auth.getUser()
    if (userError || !currentUser) {
      throw new Error('Not authenticated')
    }

    // Check if the current user is an admin
    const { data: isAdminResult } = await userClient.rpc('is_admin', { _user_id: currentUser.id })
    if (!isAdminResult) {
      throw new Error('Only admins can reset passwords')
    }

    // Parse the request body
    const { user_id, new_password } = await req.json()

    if (!user_id || !new_password) {
      throw new Error('Missing required fields: user_id, new_password')
    }

    if (new_password.length < 6) {
      throw new Error('Password must be at least 6 characters')
    }

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Update the user's password
    const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
      user_id,
      { password: new_password }
    )

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({ success: true, user: updatedUser.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
