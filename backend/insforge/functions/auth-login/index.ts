import { createClient } from 'npm:@insforge/sdk'
import bcrypt from 'npm:bcryptjs'
import { SignJWT } from 'npm:jose'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const { email, password } = await req.json()
  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Email and password required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL')!,
    anonKey: Deno.env.get('ANON_KEY')!,
  })

  const { data: rows, error } = await client.database
    .from('dispatcher_profiles')
    .select()
    .eq('email', email.toLowerCase())

  if (error || !rows?.length) {
    return new Response(JSON.stringify({ error: 'Invalid email or password' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const dispatcher = rows[0]

  if (!dispatcher.password_hash) {
    return new Response(JSON.stringify({ error: 'Account not configured' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const valid = await bcrypt.compare(password, dispatcher.password_hash)
  if (!valid) {
    return new Response(JSON.stringify({ error: 'Invalid email or password' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const jwtSecret = new TextEncoder().encode(
    Deno.env.get('JWT_SECRET') ?? 'sauron-dev-secret-change-in-prod'
  )

  const token = await new SignJWT({
    dispatcher_id: dispatcher.dispatcher_id,
    name: dispatcher.name,
    email: dispatcher.email,
    fleet_id: dispatcher.fleet_id,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .sign(jwtSecret)

  return new Response(
    JSON.stringify({
      access_token: token,
      token_type: 'bearer',
      dispatcher_id: dispatcher.dispatcher_id,
      name: dispatcher.name,
      email: dispatcher.email,
      fleet_id: dispatcher.fleet_id,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
