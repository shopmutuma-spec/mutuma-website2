# Local update batch: email and product information

These changes have not been pushed or deployed.

## Required configuration

Run scripts/email-notification-migration.sql in Supabase SQL Editor once. The same additive, rerunnable change is included in supabase-schema.sql. It adds the latest email notification state to each order without changing customer authentication.

Add server-side Netlify environment variables:

- RESEND_API_KEY
- RESEND_FROM_EMAIL: a monitored address on a domain verified in Resend
- SUPPORT_EMAIL: the inbox to receive contact enquiries
- PUBLIC_SITE_URL: https://mutumas.com
- MAILERLITE_API_KEY
- MAILERLITE_GROUP_ID: the marketing newsletter group

Keep the existing Supabase and Stripe variables. Remove the old MailerLite tracking-group automation to avoid sending obsolete messages. Supabase custom SMTP is a separate account configuration, not part of this code change.

## Verification after deployment

1. Subscribe with a test email. Check Supabase and the MailerLite newsletter group. API syncing does not force an unsubscribed contact to become active.
2. Complete a Stripe test purchase in a test environment. Open order details in admin and check Customer email. Accepted means Resend accepted the message, not that the recipient received it; check Resend delivery activity and inbox too.
3. Change an order to shipped and then delivered. Check one email for each change. On failure, check configuration and use Retry customer email. This retry uses the current stored order status and recipient, not a browser-supplied email.
4. Send a contact enquiry. Check SUPPORT_EMAIL and reply to the sender. On errors, the form preserves the message.
5. Check product shipping prices in multiple currencies against checkout. Delivery remains an estimate of 5-8 business days after dispatch.

## Limits

Resend deduplicates identical requests using an idempotency key for 24 hours. Accepted emails are not sent again for the same last recorded status. There is no scheduled background retry queue or delivery webhook yet. A failure to persist email status after provider acceptance can require checking Resend before a later retry. Notification failures do not undo paid orders.

Existing subscriber rows are not mass-imported automatically: some were created by checkout, which does not establish marketing consent. Import only consented contacts.

The public contact endpoint validates lengths and addresses and includes a honeypot. Monitor abuse; platform rate limiting or a verified challenge should be added if needed.

Product facts use existing sizes and optional material, dimensions and framed fields. Generic size labels still need supplier-confirmed dimensions. No materials, contents, frame inclusion or processing times have been invented.
