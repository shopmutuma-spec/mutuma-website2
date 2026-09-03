# Cloudflare Pages setup

## Deploy

Connect the repository to Cloudflare Pages and use these settings:

- Framework preset: None
- Build command: `npm run build`
- Build output directory: `.`
- Root directory: the folder containing this file
- Node.js compatibility: enabled by `wrangler.toml`

Deploy through Cloudflare's Git integration or Wrangler. Dashboard drag-and-drop deployment does not compile Pages Functions.

## Variables and secrets

In Workers & Pages, open the project, then go to Settings > Variables and Secrets. Add the same production values used on Netlify:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` as a secret
- `ADMIN_EMAILS`
- `MAILERLITE_API_KEY` as a secret
- `MAILERLITE_GROUP_ID`
- `MAILERLITE_TRACKING_GROUP_ID`
- `PUBLIC_SITE_URL`
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` only while Stripe remains configured

Add variables separately for Preview if preview deployments need working authentication and data.

## Verify

After deployment, check:

- `/currency-location`
- `/.netlify/functions/supabase-health`
- `/.netlify/functions/store-catalog`
- `/admin.html`

The old Netlify function URLs are intentionally preserved, so the browser code does not need different production URLs.
