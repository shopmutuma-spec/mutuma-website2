# MUTUMA Admin Analytics Audit

Date: 2026-08-06

## 1. Current Architecture

MUTUMA uses static storefront pages, shared JavaScript modules, Netlify Functions, Supabase tables and Stripe checkout. The admin dashboard is rendered from `admin.html`, `js/admin.js` and `netlify/functions/admin-data.js`.

## 2. Existing Reliable Data Sources

- Orders: `public.orders`, populated from Stripe checkout sync.
- Subscribers: `public.subscribers`.
- Behaviour events: `public.analytics_events`.
- Product catalogue: `js/products.js` and optional `public.catalog_products`.
- Offers: `public.store_offers`.
- Business goals: `public.business_goals`.
- Product costs: `public.product_costs`, available in schema but only useful when populated for sold products.

## 3. Existing Features Found

- Admin login through Supabase auth.
- Revenue, orders, visitors, sessions and product analytics.
- Date range, comparison, country, device, source, category and product filters.
- CSV exports for emails and product analytics.
- Offer controls and product management panels.
- Funnel, traffic source, product ranking, search and diagnostic sections.

## 4. Metrics That Can Be Trusted Now

- Gross revenue from synced order totals.
- Order count from synced orders.
- Items sold from synced order line items.
- Subscribers and customer emails from Supabase and Stripe checkout.
- Product views, searches, add-to-cart events and checkout starts when tracking events are collected.
- Product ranking by views, revenue and purchases.
- Conversion rate using tracked visitors and synced orders.

## 5. Metrics That Were Risky

Profit, Stripe fees, fulfilment costs and shipping costs were previously estimated from fixed assumptions. Those values should not be treated as business truth because they were not connected to real supplier, fulfilment, shipping or Stripe fee data.

## 6. Missing Connections For Full Analytics

- Stripe webhooks for payment success, refund, dispute and fee reconciliation.
- Stripe balance transaction data for actual processing fees.
- Shipping or fulfilment cost source.
- Complete product cost rows for every sellable product.
- Ad platform spend for ROAS, CAC and paid-channel profitability.
- Inventory source if stock should be operationally accurate.

## 7. Data Quality Rules

Every metric should show whether it is complete, partial, estimated, delayed or unavailable. Profit must remain unavailable unless real costs exist. Net profit must stay unavailable until product costs, shipping costs, payment fees and refund data are all connected.

## 8. Privacy And Security

Supabase row-level security is enabled for sensitive tables. Admin data is accessed through protected Netlify Functions. The site should avoid collecting unnecessary personal data and should not add city-level analytics unless privacy requirements are handled.

## 9. Immediate Fixes Recommended

- Remove silent profit assumptions.
- Add visible metric source/status information.
- Show data quality health inside the admin dashboard.
- Keep unavailable metrics visible but clearly marked as requiring more backend data.
- Preserve existing sales and behaviour analytics because those already come from real tables.

## 10. Next High-Value Upgrades

- Connect Stripe webhooks and balance transactions.
- Add cost editing/import tools for every product.
- Add ad spend imports or API connections.
- Add cohort retention and customer lifetime value once enough real orders exist.
- Add alerting for checkout drop-offs, missing product images and products with high views but low cart rate.
