// Supabase connection. Both values are public by design; the database's
// Row Level Security rules decide what each signed-in user can see.
// Never put the secret (service_role) key in this file.
const SUPABASE_URL = 'https://rxxxvrntycrswxzqaalr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vhn1k74a4scoEZkvrsT1kQ__kj37EOU';

// Slug of the Edge Function that creates clients (the last part of its URL:
// .../functions/v1/<slug>). Renaming a function in Supabase doesn't change it.
const CREATE_CLIENT_FUNCTION = 'clever-endpoint';
