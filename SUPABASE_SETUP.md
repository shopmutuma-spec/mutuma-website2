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
MAILERLITE_API_KEY=your-mailerlite-api-key
MAILERLITE_TRACKING_GROUP_ID=your-mailerlite-tracking-automation-group-id
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-signing-secret
PUBLIC_SITE_URL=https://mutumas.com
```

Keep `SUPABASE_SERVICE_ROLE_KEY` private. Do not put it in browser JavaScript.

## 3. Redeploy

Trigger a new Netlify deploy after adding the environment variables.

## What is connected

- Newsletter/drop-list signup saves to Supabase.
- Stripe checkout customer emails save to the same Supabase table after successful payment.
- Stripe webhook payments create reliable admin orders server-side.
- Customers can create accounts and sign in with Supabase Auth.
- Admins listed in `ADMIN_EMAILS` can view subscribers, synced orders and product counts at `admin.html`.
- Stripe checkout success can add customers to a MailerLite tracking-email automation group when `MAILERLITE_API_KEY` and `MAILERLITE_TRACKING_GROUP_ID` are set.
- Netlify Forms remains as a fallback if Supabase is unavailable.

## MailerLite tracking email automation

Create MailerLite custom fields named:

```text
order_number
tracking_url
delivery_estimate
```

Create a MailerLite group for order tracking emails, then set its ID as `MAILERLITE_TRACKING_GROUP_ID` in Netlify.

Create an automation triggered when a subscriber joins that group. The email button should link to the `tracking_url` custom field.

## Stripe webhook

In Stripe, create a webhook endpoint:

```text
https://mutumas.com/.netlify/functions/stripe-webhook
```

Send these events:

```text
checkout.session.completed
checkout.session.async_payment_failed
payment_intent.payment_failed
charge.refunded
```

Copy the webhook signing secret into Netlify as `STRIPE_WEBHOOK_SECRET`, then redeploy.
