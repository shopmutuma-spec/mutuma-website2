# MUTUMA Analytics Command Centre

## What Was Added

The admin dashboard now uses the existing Supabase, Netlify Functions, Stripe and product data structure to create a richer ecommerce intelligence dashboard. It includes KPI cards, comparison periods, date and channel filters, product performance, conversion funnel, revenue, source-status checks, acquisition reports, live activity, alerts, diagnostics, campaign link generation and CSV exports.

## Architecture

- Frontend tracking lives in `js/analytics.js`.
- Events are sent to `/.netlify/functions/collect-analytics`.
- Admin-only reporting is served by `/.netlify/functions/admin-data`.
- Admin access is enforced by Supabase Auth and `ADMIN_EMAILS`.
- Orders are synced from Stripe through `get-checkout-session.js` after successful checkout.
- Product catalogue data combines `js/products.js` with Supabase `catalog_products`.

## Database Setup

Run `supabase-schema.sql` in the Supabase SQL editor after every schema update. The file creates or updates:

- `subscribers`
- `orders`
- `analytics_events`
- `catalog_products`
- `store_offers`
- `product_costs`
- `business_goals`
- `admin_audit_log`

All public reads and writes stay blocked by RLS. Netlify Functions use the service role key server-side.

## Required Environment Variables

Copy `.env.example` into Netlify environment variables and fill the values there.

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAILS`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PUBLIC_SITE_URL`

Optional:

- `MICROSOFT_CLARITY_PROJECT_ID`

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` in frontend JavaScript.

## Profit Calculation

Profit is not guessed. Gross profit is shown only when every sold line item in the selected period has a real cost row in `product_costs`.

Gross profit =

revenue
- real product costs from `product_costs`

Net profit stays unavailable until real product costs, Stripe fees, shipping costs, fulfilment costs and refund data are connected. The dashboard intentionally marks incomplete cost metrics as unavailable instead of showing fake estimates.

## Stripe Setup

Use Stripe secret keys only in Netlify environment variables. Stripe Checkout is created server-side by `create-checkout-session.js`.

For production-grade payment analytics, add a Stripe webhook endpoint that verifies `STRIPE_WEBHOOK_SECRET` and stores:

- `checkout.session.completed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `charge.dispute.created`
- `payout.created`
- `payout.paid`
- `payout.failed`

Do not trust only client-side success URLs for final payment records.

## UTM Campaign Tracking

Use the admin campaign links and rename `utm_campaign` for each post.

Example:

`https://mutumas.com/shop.html?utm_source=tiktok&utm_medium=social&utm_campaign=spiderman-rug-video-01`

The dashboard uses first-touch and last-touch attribution where the browser allows local storage.

## Real-Time Analytics

Real-time numbers are based on analytics events seen in the last 10 minutes. The admin page refreshes automatically every 60 seconds while visible.

## Privacy and Consent

The tracking system stores anonymous session IDs, page paths, product IDs, safe UTM fields, device category, country from hosting headers, and performance/error data. It does not store card data, passwords, full addresses or sensitive form values.

For stricter UK consent controls, connect the tracking calls to a cookie consent banner before enabling optional marketing analytics or Microsoft Clarity.

## Microsoft Clarity

Clarity is not enabled by default. If you add it, keep it consent-aware and mask sensitive form inputs. Do not record checkout card fields.

## Testing

Manual checks:

1. Visit the site in a normal browser and open a product.
2. Search in the shop.
3. Add a product to cart.
4. Start checkout.
5. Sign in to `admin.html`.
6. Confirm live activity, product views, funnel and traffic source update.
7. Change date range and filters.
8. Export KPI and product CSV files.

Technical checks:

- Run `node --check js/admin.js`.
- Run `node --check js/analytics.js`.
- Run `node --check netlify/functions/admin-data.js`.
- Run `node --check netlify/functions/collect-analytics.js`.

## Deployment

1. Commit the `mutuma-website1` folder to GitHub.
2. Push to the branch connected to Netlify.
3. Add all environment variables in Netlify.
4. Run `supabase-schema.sql` in Supabase.
5. Trigger a Netlify redeploy.
6. Test checkout and admin reporting on the production URL.

## Limitations

- Profit is estimated until product costs are entered.
- Stripe balance, payouts and disputes require Stripe webhook/API reporting that is not yet fully connected.
- City-level geography is not collected to avoid unnecessary privacy risk.
- Forecasting stays conservative until enough real historical data exists.
