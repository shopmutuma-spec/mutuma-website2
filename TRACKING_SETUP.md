# Purchase-to-tracking connection

Stripe verified checkout events save the paid order and request a Resend email linking to /tracking.html. The link prefills the order number and email. New links use a fragment instead of a query string to reduce server-log/referrer exposure. These links still contain personal information: treat them as private. Lookup requires both order number and email and returns only public tracking fields.

## Deployment configuration

- Keep SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET configured on Netlify.
- Set PUBLIC_SITE_URL=https://mutumas.com and SUPPORT_EMAIL=shopmutuma@gmail.com.
- Configure RESEND_API_KEY and RESEND_FROM_EMAIL using a Resend-verified sending domain. Gmail is the support recipient/reply address, not the verified sender.
- Run scripts/email-notification-migration.sql if not already applied.
- Stripe webhook URL: https://mutumas.com/.netlify/functions/stripe-webhook
- Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, payment_intent.payment_failed and charge.refunded. Use the signing secret belonging to this endpoint and environment.

## Fulfilment workflow

After payment, the customer can see the initial order status before a tracking number exists. In existing admin order details, add courier, tracking number and an HTTPS carrier tracking URL, select shipped, and save. A shipped email is attempted on the status transition. Delivered is also updated in admin and triggers an email. Saving tracking details without a status change updates the tracking page but does not send another email. Failed sends can be retried from order details.

Supplier dispatch and carrier delivery scans are NOT automatically imported. A supplier/carrier integration is a separate step requiring an actual provider account and order mapping. No fake delivery progress is generated.

## Verification

Use a separate Stripe test-mode deployment with its own signing secret and test database. Complete a test checkout using your own email. Verify the order exists and the email arrives, open its link, add test tracking details in admin, and verify the page and shipped email. Never use test card numbers in the live store. No live order was placed during this local update.

Run node tests/tracking.test.mjs, node tests/order-sync.test.mjs and node tests/email-workflows.test.mjs locally. These mock external services; they do not prove inbox delivery. The previous live Resend/contact attempt failed and must be fixed and retested. A consented live email test is still needed after configuration.

Remaining hardening: rate limiting for public lookup, stronger signed tracking links, durable email retries and webhook concurrency/recovery review. Current email failures remain visible in admin, not automatically retried on a schedule.
