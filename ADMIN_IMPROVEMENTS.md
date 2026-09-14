# Admin audit and improvement pass

## Audit and priority

| Section | Existing strengths | Friction / risk | Priority |
| --- | --- | --- | --- |
| Overview | KPIs, recent orders, alerts, sources, trends | Refresh can discard edits; loaded data has limits | Daily / high |
| Orders | Images, item snapshots, addresses, history, tracking, email retry | Analytics filters hide queue entries; no pagination/status filter; keyboard rows do not open; financial status edit is not a real refund | Daily / high |
| Products | Add form, categories, price and image URL, performance | First 80 only; no existing-product editor, upload or variant editor; no publish confirmation | Daily / high |
| Customers | Orders, spending, subscribers | First 50 only; no search or individual history view; spending is range-limited, not lifetime | Daily / medium |
| Inventory | Tracked and low-stock counts | Stock table omits actual stock; no restock editor; threshold fixed at 3 | Daily / high |
| Promotions | Storewide offer, schedule inputs | Existing dates are blank and can be erased on save; no confirmation | Occasional / high |
| Analytics | GBP KPIs, funnel, rankings, quality, exports | Latest 500 orders and capped events; not exhaustive reporting; refresh errors hide existing view | Visibility / high |
| Abandoned carts | Aggregate funnel and product demand | No recoverable customer-specific carts; not an email recovery workflow | Visibility / medium |
| Settings | Security and integration summary, health checks | Configuration is largely external; summary is not proof integrations work | Setup / medium |
| Permissions | Server-side Supabase identity plus admin-email allowlist | No granular staff roles; everyone allowed has full admin rights | Setup / high before adding staff |

## Implemented in this pass

1. Orders: separate management queue from analytics filters (latest 500, explicitly labelled); search name/email/order/product/SKU/tracking; status filter; 25-row pages; keyboard activation; status-change confirmation.
2. Products / inventory: searchable catalogue pages; stock numbers shown; publish confirmation. No product, price or inventory changes are performed automatically.
3. Customers: searchable pages instead of silently hiding all but the first 50; clarify selected-range spending.
4. Editing and reporting: pause refresh while edits or saves are pending; preserve selected order; retain last successful data on refresh failure; discard confirmation; visible data timestamp.
5. Promotions: preserve existing schedule values, use 20% default only for new offers, confirm saves and reject reversed dates.

## Boundaries / next decisions

No migrations, new dependencies, storefront edits or payment-processing changes. The admin-data response adds a read-only managementOrders field; existing analytics still uses its selected range. The 500-order loading limit remains; true server-side search/pagination and exhaustive reporting need a separate endpoint/query pass.

Bulk financial edits and bulk fulfilment are deferred: there is no atomic bulk endpoint or conflict/version check. Building buttons on serial updates would risk partially completed operations. Product updates/restocking likewise need an authenticated update contract before adding controls. Confirm per-product versus storewide low-stock thresholds and staff roles before that work.

The existing admin status endpoint records refunded/payment_failed but does not issue a provider refund. This pass makes that explicit without changing processing. Atomic inventory decrement, concurrent order writes, and recoverable webhook side effects remain separate backend work requiring approval under this request's constraints.

Verification: automated helper regressions and existing project checks; real authenticated browser verification requires an admin session. No live customer records are modified during testing.
