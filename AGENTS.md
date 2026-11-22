# ShopLedger

## Tech stack

- JavaScript using Node.js and CommonJS modules.
- Express 4 serves the HTTP API and static frontend. `body-parser` parses JSON request bodies.
- Frontend: HTML, CSS, and browser JavaScript under `public/`.
- Storage: `data/db.json`, read and written by `lib/store.js`; there is no database server configured in this project.

## Module map

- `server.js` - Express application entry point; serves `public/`, mounts API routers, and serves printable order invoices.
- `config.js` - port, shop details, tax slabs, inventory settings, and coupon configuration.
- `public/index.html` - frontend page structure.
- `public/js/app.js` - browser UI and API requests for orders, products, customers, and reports.
- `public/css/style.css` - frontend styles.
- `routes/products.js` - product and coupon endpoints.
- `routes/orders.js` - order listing, lookup, placement, and cancellation endpoints.
- `routes/customers.js` - customer listing and Khata settlement endpoints.
- `routes/reports.js` - dashboard, GST reconciliation, pricing preview, and admin export endpoints.
- `lib/coupons.js` - coupon lookup, validation, and discount calculation.
- `lib/dates.js` - date formatting and date-key/fiscal-year helpers.
- `lib/inventory.js` - product lookup, stock checks and adjustments, and inventory summary.
- `lib/invoice.js` - invoice calculations and printable HTML rendering.
- `lib/ledger.js` - customer balances, Khata charges/reversals, and settlements.
- `lib/orders.js` - order creation, lookup, cancellation, and filtering.
- `lib/pricing.js` - subtotal, discount, tax, and order total calculations.
- `lib/reports.js` - dashboard summary and GST reconciliation calculations.
- `lib/store.js` - JSON data file reads/writes and audit-log updates.
- `lib/tax.js` - GST rate resolution and CGST/SGST split.
- `data/db.json` - persisted products, orders, customers, settlements, counters, and audit log.
- `docs/shopledger-architecture.svg` - application architecture and order placement diagram.

## Commands

- Install dependencies: `npm install`
- Start the application: `npm start` (runs `node server.js`; default port is 3000 and can be overridden with `PORT`).
- Tests: no test suite is present. The current `npm test` script is a placeholder that exits with an error.

## Project rules

- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never read from or write to `data/db.json`; use isolated test data instead.
- Add no dependencies.
