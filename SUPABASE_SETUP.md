# MUTUMA Supabase Setup

## 1. Create the table

In Supabase, open **SQL Editor**, paste the contents of `supabase-schema.sql`, then run it.

## 2. Add Netlify environment variables

In Netlify, go to **Site configuration > Environment variables** and add:

```text
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ADMIN_EMAILS=your-admin-email@example.com
```

Keep `SUPABASE_SERVICE_ROLE_KEY` private. Do not put it in browser JavaScript.

## 3. Redeploy

Trigger a new Netlify deploy after adding the environment variables.

## What is connected

- Newsletter/drop-list signup saves to Supabase.
- Stripe checkout customer emails save to the same Supabase table after successful payment.
- Customers can create accounts and sign in with Supabase Auth.
- Admins listed in `ADMIN_EMAILS` can view subscribers, synced orders and product counts at `admin.html`.
- Netlify Forms remains as a fallback if Supabase is unavailable.
