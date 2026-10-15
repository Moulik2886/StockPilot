CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'INR', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','manager','viewer')), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', company TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '', active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,name)
);
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sku TEXT NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'General', unit TEXT NOT NULL DEFAULT 'unit',
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(cost_price>=0), sale_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(sale_price>=0),
  stock_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(stock_qty>=0), reorder_level NUMERIC(12,2) NOT NULL DEFAULT 5 CHECK(reorder_level>=0),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL, active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(workspace_id,sku)
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id), user_id UUID REFERENCES users(id), kind TEXT NOT NULL CHECK(kind IN ('opening','purchase','sale','adjustment','return')),
  quantity NUMERIC(12,2) NOT NULL, before_qty NUMERIC(12,2) NOT NULL, after_qty NUMERIC(12,2) NOT NULL,
  reference TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id), po_number TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','Received','Cancelled')),
  total NUMERIC(12,2) NOT NULL DEFAULT 0, expected_date DATE, created_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,po_number)
);
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id), quantity NUMERIC(12,2) NOT NULL CHECK(quantity>0), unit_cost NUMERIC(12,2) NOT NULL CHECK(unit_cost>=0)
);
CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL, customer_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Completed' CHECK(status IN ('Completed','Cancelled')),
  total NUMERIC(12,2) NOT NULL DEFAULT 0, created_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(workspace_id,order_number)
);
CREATE TABLE IF NOT EXISTS sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id), quantity NUMERIC(12,2) NOT NULL CHECK(quantity>0), unit_price NUMERIC(12,2) NOT NULL CHECK(unit_price>=0), line_total NUMERIC(12,2) NOT NULL
);
CREATE TABLE IF NOT EXISTS document_counters (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, year INTEGER NOT NULL, po_number INTEGER NOT NULL DEFAULT 0, order_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(workspace_id,year)
);
CREATE INDEX IF NOT EXISTS products_workspace_name_idx ON products(workspace_id,name);
CREATE INDEX IF NOT EXISTS movements_workspace_created_idx ON stock_movements(workspace_id,created_at DESC);
CREATE INDEX IF NOT EXISTS purchase_workspace_created_idx ON purchase_orders(workspace_id,created_at DESC);
CREATE INDEX IF NOT EXISTS sales_workspace_created_idx ON sales_orders(workspace_id,created_at DESC);
