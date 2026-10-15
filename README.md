# StockPilot

StockPilot is a live inventory and order management workspace for small businesses. Track product quantities, suppliers, purchase receipts, sales, and every stock movement from one dashboard.

## What it does

- Inventory catalog with SKU/barcode field, category, cost and selling prices, supplier, quantity, and reorder threshold
- Live low-stock alerts and inventory valuation at cost
- Stock-in/stock-out adjustments with reference, reason, before/after quantities, and an auditable movement ledger
- Supplier directory with product relationships and safe archive rules
- Purchase orders with expected delivery dates; receiving an order updates the matching stock and cost in one transaction
- Sales orders that calculate order totals and deduct stock atomically; overselling and duplicate line items are rejected
- Dashboard for stock value, reorder alerts, monthly sales, open purchases, today's orders, and recent movement
- Owner, Manager, and Viewer roles
- Server-Sent Events refresh inventory data immediately after changes without page reloads
- Responsive React/TypeScript interface

## Technology

- React 19, TypeScript, and Vite
- Node.js 20+, Express 5, Zod validation, and HTTP-only JWT session cookies
- PostgreSQL-compatible PGlite for local development. Its database persists under `server/data/` and is excluded from Git.

## Start the app

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open the Vite URL printed in the terminal (usually <http://localhost:5173>). The API defaults to <http://127.0.0.1:4002>. If Vite's default port is busy, it chooses the next free port automatically.

For macOS/Linux, use `cp .env.example .env` instead of `Copy-Item`.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Owner | `owner@stockpilot.local` | `StockPilot!2026` |
| Manager | `manager@stockpilot.local` | `StockPilot!2026` |
| Viewer | `viewer@stockpilot.local` | `StockPilot!2026` |

Demo suppliers and products are seeded automatically at first launch. Replace the demo credentials before exposing an installation to a team.

## Build and test

```bash
npm run build
npm run test:api
```

The API smoke suite checks authentication and role permissions, supplier/product updates, live event delivery, stock adjustments, low-stock protections, purchase-order receipt, sale totals and stock deduction, overselling protection, movement history, and cleanup of temporary test records.

## API overview

All endpoints are prefixed by `/api`. Health and login are public; other routes require the session cookie.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Database/API health |
| POST / GET | `/auth/login`, `/auth/me` | Sign in and current identity |
| GET / POST | `/products` | Search/list and create products |
| PATCH / DELETE | `/products/:id` | Update/archive catalog item |
| POST | `/products/:id/adjust` | Audited stock adjustment |
| GET / POST | `/suppliers` | List/create suppliers |
| PATCH / DELETE | `/suppliers/:id` | Update/archive supplier |
| GET / POST | `/purchase-orders` | List/create purchase orders |
| POST | `/purchase-orders/:id/receive` | Receive stock exactly once |
| GET / POST | `/sales-orders` | List/complete sales orders |
| GET | `/movements` | Recent stock movement ledger |
| GET | `/dashboard` | Workspace metrics |
| GET | `/events` | Authenticated live event stream |

## Production setup

Configure `DATABASE_URL` for managed PostgreSQL, set a unique random `JWT_SECRET` of at least 32 characters, and use `COOKIE_SECURE=true` behind HTTPS. This starter has no external barcode scanner, email, or accounting-system integration; SKUs can be scanned with a USB scanner that types into the SKU field.
