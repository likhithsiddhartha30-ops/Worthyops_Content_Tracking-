// Supabase Edge Function: create-client
// Lets a signed-in admin create a new client AND that client's login.
// Creating logins needs the secret (service role) key, which must never be
// in the website, so this runs on Supabase's servers instead.
//
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided
// to Edge Functions automatically; you don't need to paste any keys here.

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1. The caller must be a signed-in admin.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
  });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json({ error: 'You are not signed in.' }, 401);

  const { data: profile } = await caller.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return json({ error: 'Only admins can add clients.' }, 403);

  // 2. Validate input.
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  if (!name) return json({ error: 'Enter a client name.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid login email.' }, 400);
  if (password.length < 6) return json({ error: 'Password must be at least 6 characters.' }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 3. Create the client.
  const { data: client, error: clientError } = await admin
    .from('clients').insert({ name }).select().single();
  if (clientError) {
    const msg = clientError.code === '23505' ? 'A client with this name already exists.' : clientError.message;
    return json({ error: msg }, 400);
  }

  // 4. Create the client's login. The database trigger turns app_metadata
  //    into a 'client' profile linked to this client.
  const { error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
    app_metadata: { role: 'client', client_id: client.id }
  });
  if (userError) {
    await admin.from('clients').delete().eq('id', client.id); // undo step 3
    const msg = /already/i.test(userError.message) ? 'This email is already used by another login.' : userError.message;
    return json({ error: msg }, 400);
  }

  return json({ client });
});
