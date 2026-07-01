/**
 * Plata Burrito CRM — mock REST backend.
 * Express + zod. Every list/update request is validated; invalid requests return 400.
 * In-memory data (see data.ts); mutations live only for the process lifetime.
 */
import express, { type Request, type Response } from 'express';
import type { ZodType } from 'zod';
import { PRODUCTS, ORDERS, FINANCE, LOCATIONS, type Product } from './data.js';
import { ProductListQuery, OrderListQuery, FinanceQuery, ProductUpdateBody } from './schemas.js';

const PORT = Number(process.env.REST_PORT ?? 8080);

const app = express();
app.use(express.json());

// Permissive CORS so the backend also works when hit directly (the Angular dev server proxies
// /api → here, so the browser path is same-origin and never needs this).
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

/** Validate `data` against `schema`; on failure send 400 and return undefined. */
function validate<T>(schema: ZodType<T>, data: unknown, res: Response): T | undefined {
  const result = schema.safeParse(data);
  if (!result.success) {
    res.status(400).json({
      error: 'invalid_request',
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return undefined;
  }
  return result.data;
}

function paginate<T>(rows: T[], page: number, pageSize: number) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), total, totalPages };
}

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'plata-burrito-rest-mock' }));

app.get('/api/locations', (_req, res) => res.json({ items: LOCATIONS }));

// ── Catalog ──────────────────────────────────────────────────────────────
app.get('/api/products', (req: Request, res: Response) => {
  const query = validate(ProductListQuery, req.query, res);
  if (!query) return;

  let rows = [...PRODUCTS];
  if (query.category) rows = rows.filter((p) => p.category === query.category);
  if (query.q) {
    const needle = query.q.toLowerCase();
    rows = rows.filter((p) => p.name.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle));
  }
  rows.sort((a, b) => {
    switch (query.sort) {
      case 'price-asc':
        return a.price - b.price;
      case 'price-desc':
        return b.price - a.price;
      case 'category':
        return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
      default:
        return a.name.localeCompare(b.name);
    }
  });

  const { items, total, totalPages } = paginate(rows, query.page, query.pageSize);
  res.json({ items, page: query.page, pageSize: query.pageSize, total, totalPages, sort: query.sort });
});

app.get('/api/products/:id', (req: Request, res: Response) => {
  const product = PRODUCTS.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'not_found' });
  res.json(product);
});

app.put('/api/products/:id', (req: Request, res: Response) => {
  const product = PRODUCTS.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'not_found' });
  const body = validate(ProductUpdateBody, req.body, res);
  if (!body) return;
  Object.assign<Product, Partial<Product>>(product, body);
  res.json(product);
});

// ── Orders ───────────────────────────────────────────────────────────────
app.get('/api/orders', (req: Request, res: Response) => {
  const query = validate(OrderListQuery, req.query, res);
  if (!query) return;

  const productName = (id: string) => PRODUCTS.find((p) => p.id === id)?.name ?? '';
  let rows = [...ORDERS];
  if (query.location) rows = rows.filter((o) => o.location === query.location);
  if (query.status) rows = rows.filter((o) => o.status === query.status);
  if (query.q) {
    const needle = query.q.toLowerCase();
    rows = rows.filter(
      (o) =>
        o.id.toLowerCase().includes(needle) ||
        o.customer.toLowerCase().includes(needle) ||
        o.items.some((it) => productName(it.productId).toLowerCase().includes(needle)),
    );
  }
  rows.sort((a, b) => {
    switch (query.sort) {
      case 'date-asc':
        return a.createdAt < b.createdAt ? -1 : 1;
      case 'total-desc':
        return b.total - a.total;
      case 'total-asc':
        return a.total - b.total;
      default:
        return a.createdAt < b.createdAt ? 1 : -1;
    }
  });

  const { items, total, totalPages } = paginate(rows, query.page, query.pageSize);
  res.json({ items, page: query.page, pageSize: query.pageSize, total, totalPages, sort: query.sort });
});

// ── Finance ──────────────────────────────────────────────────────────────
app.get('/api/finance', (req: Request, res: Response) => {
  const query = validate(FinanceQuery, req.query, res);
  if (!query) return;

  const cutoff = [...new Set(FINANCE.map((r) => r.date))].sort().slice(-query.days);
  const within = new Set(cutoff);
  let rows = FINANCE.filter((r) => within.has(r.date));
  if (query.location) rows = rows.filter((r) => r.location === query.location);

  const summary = LOCATIONS.map((loc) => {
    const locRows = rows.filter((r) => r.location === loc.id);
    const revenue = locRows.reduce((s, r) => s + r.revenue, 0);
    const orders = locRows.reduce((s, r) => s + r.orders, 0);
    return { location: loc.id, name: loc.name, revenue, orders, avgTicket: orders ? Math.round(revenue / orders) : 0 };
  }).filter((s) => !query.location || s.location === query.location);

  res.json({
    days: query.days,
    rows,
    summary,
    totals: {
      revenue: summary.reduce((s, x) => s + x.revenue, 0),
      orders: summary.reduce((s, x) => s + x.orders, 0),
    },
  });
});

app.listen(PORT, () => {
  console.log(`[rest-mock] Plata Burrito CRM backend on http://localhost:${PORT}`);
});
