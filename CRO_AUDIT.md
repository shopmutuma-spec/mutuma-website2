# MUTUMA conversion audit - 14 September 2026

## Evidence and scope

This is a heuristic audit, not proof of revenue uplift. Existing static HTML, vanilla JavaScript, Netlify functions, Supabase and Stripe are retained. This is not a SolidJS project. Product data, pricing rules and policies are unchanged.

Previous single-run live Lighthouse baselines: mobile performance 64, LCP 5.1s, CLS 0.277; desktop performance 81, LCP 1.5s, CLS 0.200. These are lab results, not field percentiles or a controlled experiment. Current browser checks use the local static preview; payment and email services require separate hosted verification.

## Competitor teardown

These are relevant reference stores, not evidence of their conversion rates. Public page content was inspected; no competitor checkout was completed. Authenticated cart, wallet eligibility, post-purchase emails and mobile performance were not verified.

| Stage | Observed reference | MUTUMA gap / implication |
|---|---|---|
| Entry and navigation | Desenio exposes curated art collections and gallery-wall advice in its navigation. | MUTUMA already starts with products and room collections. Preserve that speed; correct tag destinations before adding navigation depth. |
| Category/search | Desenio frames has colour, format and size filters; dimensions are prominent in product names. UO describes suggestions and preview results in its search surface. | MUTUMA has visual header search but a simpler shop query, broken query persistence and mismatched price-filter currency. Fix reliability before adding more filters. |
| PDP / fit confidence | IKEA's rug guide uses room layouts and measurements to explain placement. | MUTUMA lists general size labels without a complete purchasable SKU/size mapping. Verified measurements and real variant selection matter more than decorative badges. |
| Cart | UO states expected backorder dates appear in product details and the shopping bag. | MUTUMA delivery phrasing differs between PDP and cart. Reconcile only after actual dispatch/transit facts are confirmed. |
| Checkout | UO explains verification, authorisation and charging in its help flow. This is documentation, not an observed checkout test. | MUTUMA has server-side Stripe pricing but the live guest/wallet handoff still needs test-mode verification. Do not add wallet promises solely because logos exist. |
| Post-purchase | UO provides order-number plus billing-postcode lookup and describes confirmation/shipping emails. | MUTUMA already has tracking infrastructure; its cart return currently clears on a success URL before verified confirmation. Fix that before adding referral offers. |
| Cross-cutting | No comparable competitor performance test was run. | MUTUMA's measured layout shift and oversized category imagery are actionable without speculative visual imitation. |

Sources, reviewed 14 September 2026:
- [IKEA rug sizing](https://www.ikea.com/gb/en/rooms/living-room/how-to/choosing-the-right-size-rug-for-your-space-pub4eafcf30/)
- [Desenio frames](https://desenio.co.uk/frames/)
- [Urban Outfitters orders and payments](https://www.urbanoutfitters.com/help/ordering-payment)

## LIFT scorecard before this round

Scores are diagnostic judgments, 1-5, higher is better. Anxiety and Distraction score how well these are reduced, not how much exists. Urgency means verified reasons to act, not manufactured pressure. No target requires increasing urgency artificially.

| Stage | Value | Relevance | Clarity | Anxiety reduction | Distraction reduction | Honest urgency |
|---|---:|---:|---:|---:|---:|---:|
| Homepage | 3 | 4 | 3 | 2 | 3 | 2 |
| Category/search | 3 | 2 | 2 | 2 | 2 | 2 |
| PDP | 3 | 3 | 2 | 2 | 2 | 2 |
| Cart | 3 | 4 | 3 | 2 | 2 | 2 |
| Checkout handoff | 3 | 4 | 3 | 3 | 4 | 2 |
| Confirmation/tracking | 2 | 3 | 2 | 2 | 3 | 1 |
| Cross-cutting | 3 | 3 | 2 | 2 | 3 | 2 |

Checkout score concerns local code/handoff only, not a completed hosted payment. Global sale messaging exists, but a verified end date was not supplied.

## Funnel diagnosis

| Stage / primary action | Competition and friction | What the hesitant customer needs |
|---|---|---|
| Homepage: open a product | Repeated sections and shifting collection position interrupt scanning. | Stable cards, accurate image previews and obvious destinations. |
| Category/search: choose a product | Eight simultaneous filters, generic introduction, query persistence and price-band errors; dark banner text has poor contrast in the white theme. | Consistent filters, readable headings, forgiving search and clear recovery from zero results. |
| PDP: choose the right item and add | Size labels are not complete variant selection; bundles compete with buying; limited image depth. | Exact available dimensions/options, real images, delivery/return facts near the action. |
| Cart: start checkout | Reward and cross-sell messages compete with checkout; delivery wording differs. | Editable quantities, trustworthy payable breakdown and recovery from failed checkout. |
| Checkout: complete payment | Handoff failures can strand users; billing address is required; wallet availability unverified. | Reliable retry, guest access and verified eligible payment methods. Do not remove required fields without provider review. |
| Confirmation: understand the order | Success query can trigger premature cart clearing; optional email work can obscure confirmation. | Server-confirmed payment/order, durable cart while pending, tracking access independent of email success. |
| Exit/recovery: resume voluntarily | Recovery infrastructure and suppression need end-to-end verification. | Consent-respecting recovery, no emails after purchase/unsubscribe, no interruptive exit overlay by default. |

## PIE backlog

Scores 1-10, equal-weight average. Estimates, not measured impacts. Safety-critical correctness is not delayed to run an A/B test.

| Rank | Change / page | LIFT | P | I | E | Average | Track |
|---|---|---|---:|---:|---:|---:|---|
| 1 | Restore PDP quantity/retry controls | Clarity, anxiety | 9 | 10 | 9 | 9.3 | Quick; Round 1 local |
| 2 | Verify confirmation before cart clearing | Anxiety | 10 | 10 | 7 | 9.0 | Quick; ship first |
| 3 | Reliable search links and currency filters | Relevance, clarity | 8 | 9 | 9 | 8.7 | Quick; Round 2 local |
| 4 | Remove homepage loading shift | Clarity | 8 | 9 | 8 | 8.3 | Quick; ship first |
| 5 | Responsive category images | Clarity | 8 | 9 | 8 | 8.3 | Quick; ship first |
| 6 | Banner/price contrast and keyboard focus | Clarity | 7 | 8 | 9 | 8.0 | Quick |
| 7 | Verify review, stock and delivery claims | Anxiety | 8 | 9 | 6 | 7.7 | Quick; needs verified facts |
| 8 | Full SKU-aware PDP and size confidence | Relevance, anxiety | 10 | 10 | 3 | 7.7 | Bold bet 1 |
| 9 | Transactional inventory and retryable order work | Anxiety | 9 | 10 | 3 | 7.3 | Bold bet 2 |
| 10 | Progressive mobile filters and one clear purchase action | Distraction, clarity | 8 | 8 | 5 | 7.0 | Bold bet 3 |
| 11 | Consent-aware recovery and repeat ordering | Value, relevance | 6 | 7 | 4 | 5.7 | Staged follow-up |

Top five are the ship-first sequence. Bold bet 1 needs authoritative variant data; do not invent dimensions. Bold bet 2 requires staged database changes, duplicate/concurrency tests and rollback planning. Bold bet 3 should be A/B tested; monitor AOV alongside purchase rate. No experimentation platform was identified; do not describe sequential deployments as randomized tests.

## Round 2: product discovery reliability

Status: implemented locally; not pushed or deployed. Separate from Round 1 purchase-control changes.

- Preserve search text on reload and accept old query URLs.
- Map Trending/Best Seller tag links to actual collection filters.
- Validate filter/sort URL values and escape rendered filter labels.
- Use stable price-band keys, with labels formatted using the same currency converter as cards; retain the underlying USD cutoffs and catalog prices. Existing GBP-labelled links are migrated to their previous underlying bands.
- Refresh labels on currency changes and correctly reset a removed sort chip.

Principle: reduce cognitive load and preserve recognition. LIFT: relevance and clarity.

Hypothesis: because shared searches previously lost their text and price ranges did not match displayed currency, correcting these should improve listing-to-product click-through and reduce filter abandonment. No numerical uplift is promised.

Monitor existing consent-gated filter_applied, search_performed and product-view events by device, source and currency for 1-2 weeks after this round alone is released. Analytics already exists; verify event delivery in the production dashboard before attributing results. Current search events are per keystroke, so do not use raw event count as the search-session denominator. Use unique consenting listing sessions; label this a consented subset, not all customers. Use server-verified orders for completed-purchase metrics, not browser success events.

Verification: ten test files pass; production build and syntax/import validation pass. Local browser preserved the query and Trending collection after refresh, returning 18 matching products, and rendered GBP-converted price bands. No real payment was made. Real iOS/TikTok and hosted checkout remain unverified in this round.

Next isolated change: verified confirmation before clearing the cart. Hold off on unrelated visual redesign until each correctness release is checked. No dependencies, environment variables or migrations needed for Round 2.
