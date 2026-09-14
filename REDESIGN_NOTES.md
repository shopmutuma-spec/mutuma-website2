# Storefront relaunch preview

Status: local implementation, not deployed or committed. Existing uncommitted fixes were preserved. Do not treat the full mixed working tree as a single redesign commit.

## Changes by template

- Shared system: white surfaces, consistent control sizes, restrained corners, smaller headings, centred mobile wordmark, compact navigation. Clarity; monitor product discovery and navigation errors.
- Homepage: real existing room photograph, direct category shortcuts, shorter content, consistent horizontal product rails. Removed redundant room showcase/about blocks and an unverified limited-drop section; the About page remains accessible. Relevance/focus; monitor product click-through and mobile scroll depth.
- Listing: compact heading and collapsible mobile filters, two-column mobile products with add and save controls; Buy Now remains on product pages and desktop listings. Clarity; monitor filtered-session product clicks and add-to-cart.
- Product: restrained title/gallery sizing, native full-image dialog with Escape dismissal, bundle below purchase controls. Anxiety/focus; monitor add-to-cart and AOV. Existing SKU/product records remain unchanged; no invented selectable sizes were introduced.
- Cart: simpler responsive layout and readable summary, labelled quantity controls retained. Clarity; monitor cart-to-checkout. Checkout amounts and reward rules are unchanged.
- Account: consistent form styling and useful tracking/saved-item links for signed-out visitors. Relevance; monitor tracking access. Authentication unchanged.
- Legal/support/category templates share the new typography/spacing. Legal wording unchanged.

## Verification

Eleven existing test files passed after the structural changes. Production build and JS import/syntax validation passed. Browser checks: desktop homepage and account, 375px homepage/listing, 320px product/cart; native image dialog opens, Escape closes; narrow mobile logo clipping fixed and confirmed; cart page has no horizontal document overflow. Temporary viewport settings reset.

This is not a completed real-device, signed-in, payment or email test. Real iOS/TikTok, hosted Stripe test-mode handoff, verified paid return, authenticated order history and Netlify CDN delivery still require integration QA. No new wallets/providers, review service or variant database model was added. No claims of conversion uplift.

## Release and measurement

Review the preview before publishing. Separate shared styling, homepage, listing behaviour and PDP interaction changes into reviewable commits when reconciling the existing uncommitted fixes; none has been pushed here. Versioned asset URLs invalidate stale browser styles/modules.

Compare consented listing-to-product, PDP add-to-cart and cart-to-checkout rates by device/source; use verified orders for purchase completion. Guard against worse LCP/CLS, checkout errors and lower AOV. Do not call a sequential before/after comparison an A/B test.
