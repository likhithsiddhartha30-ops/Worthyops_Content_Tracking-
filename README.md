# Worthyops_Content_Tracking-

WorthyOps Content Tracking: a simple dashboard to plan content and track performance across LinkedIn, Instagram, Twitter and YouTube, backed by Supabase.

## Pages

- `index.html` (login for the Client portal and Admin)
- `dashboard.html` (performance overview with charts, for clients and admins)
- `content.html` (admin: add, edit and log metrics for posts)
- `planner.html` (admin: upcoming planned and scheduled content)

## Supabase setup

1. Run `supabase/schema.sql` in the Supabase SQL Editor.
2. Authentication > Sign In / Providers > Email: turn off "Allow new users to sign up".
3. Create your admin user (Authentication > Users > Add user), then run:
   ```sql
   update public.profiles set role = 'admin', client_id = null where email = 'you@yourdomain.com';
   ```
4. Deploy the Edge Function in `supabase/functions/create-client` with the name `create-client` (this powers the "+" Add client button).
5. Put your Project URL and publishable key in `js/config.js`. Never put the secret / service_role key in the website.

## Run

Open `index.html` in a browser, or host the folder on any static host. No build step is needed.

Admins sign in on the Admin tab and add clients with the **+** button next to the client switcher. Each client signs in on the Client portal tab and sees only their own dashboard.
