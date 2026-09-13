# Website review updates - 13 September 2026

## Existing structure preserved

This checkout is static HTML with vanilla JavaScript modules, not SolidJS. Pages live in the repository root; shared UI, cart state, catalog, currency and analytics live in js/; styling is in css/style.css. Netlify serves the pages and netlify/functions handles server requests. Supabase stores records and Stripe handles checkout. No Solid router, Vite, TypeScript, new dependency, database migration or admin redesign was introduced.

## Changes

1. Remote catalog records override embedded records with the same ID. Unpublished IDs are excluded and stock zero stays zero. Concurrent browser catalog requests share one promise, and storage failures do not discard a successful response.
2. Product text and image attributes are escaped in product cards, search, product details and cart rendering. Image URLs are restricted to supported paths/protocols.
3. Stripe event handling uses the existing event ID and updated_at columns for an owned processing lease. Already processed events are acknowledged; active processing returns a retryable response; failed or abandoned processing can be reclaimed after five minutes. Conditional completion prevents an older worker from completing a newer claim. Order inserts ignore duplicate session records.
4. Analytics ignores null/non-element click targets and checks outbound URL origins correctly.
5. Optional store analytics starts only after permission. Visitors can reject it, change their choice in the footer and clear its saved identifiers by rejecting. Privacy wording now reflects this behaviour.
6. Failed product images fall back to the original asset, then a placeholder, without removing the card or its purchase controls.
7. Main navigation is initialized before catalog loading. Homepage, shop, product and cart startup failures display a retry message.
8. Supported local product images use responsive Netlify image sources on the production/Netlify host. Only the first two Trending images receive eager priority; later rails load lazily.
9. Product pages update titles, descriptions, canonical links and Product structured data. Unknown products no longer display the first product. Private pages are noindex; the generated sitemap contains 210 public URLs from the bundled catalog.
10. Quantity buttons have accessible names, mobile purchase labels are larger, and the homepage has a screen-reader heading. Card sizes and visual design are retained.
11. Validation checks JavaScript syntax and relative imports, and the test runner discovers every test file, including tracking. The build regenerates the sitemap. Stylesheet versions were updated to invalidate previously immutable browser caches.

Checkout additionally refuses an unavailable catalog rather than using outdated fallback prices. Missing products, invalid/fractional quantities and quantities over known stock are rejected rather than silently dropping items. Customer-supplied prices are ignored, and unexpected provider errors are not returned verbatim to the browser.

## Verification

- pnpm test: all eight test files passed.
- pnpm run build, pnpm run lint and pnpm run typecheck: passed. The latter two are syntax/import checks, not a full semantic linter or TypeScript checker; the repository has neither configured.
- Browser checks at 390 x 844 and 1440 x 1000: no horizontal page overflow; product controls visible; product images loaded. Mobile Trending-to-collections gap measured about 8px.
- Product title/canonical metadata checked in the browser. Increasing quantity and adding two items updated the local bag count correctly.
- Tests use isolated mocks. No fake orders were inserted into the production database and no live payment was made.

## Deployment checks and remaining limits

Nothing has been pushed or deployed. Existing Supabase and Stripe server variables remain required. No new environment variables or SQL are required by this batch. Webhook leases require the existing unique event_id and updated_at trigger in the current schema.

After deploying, test a checkout in a separately configured Stripe test environment, then replay its webhook and verify a single order. Test an image request under /.netlify/images on the deployed host. The local static preview does not run Netlify Functions or its image service and is not a checkout test environment.

The review does not establish that the entire system is flawless. Inventory updates and post-order side effects are not one atomic database transaction; simultaneous stock reservations and recovery of a process interrupted after order insertion still need a separate transactional design. The short server catalog cache is not a stock reservation. Product SEO tags are rendered with JavaScript, so non-JavaScript social preview bots still need server-rendered metadata. Remote-only products are not currently included in the build-time sitemap. Real iOS/TikTok hardware testing, authenticated admin workflows and a full live purchase/refund cycle remain to be verified separately. Consent controls are not a blanket legal-compliance guarantee.
