/** Request validation schemas. Invalid requests → 400, which is what makes the bug observable. */
import { z } from 'zod';
import { CATEGORIES } from './data.js';

/**
 * Catalog list query. `page` is REQUIRED and ≥1 — the pagination contract. A client that omits
 * it (the catalog-pagination bug: `page` is undefined and stripped before the request) gets 400.
 */
export const ProductListQuery = z.object({
  page: z.coerce.number().int().min(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
  sort: z.enum(['name', 'price-asc', 'price-desc', 'category']).default('name'),
  category: z.enum(CATEGORIES).optional(),
  q: z.string().trim().max(80).optional(),
});

export const OrderListQuery = z.object({
  page: z.coerce.number().int().min(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(10),
  sort: z.enum(['date-desc', 'date-asc', 'total-desc', 'total-asc']).default('date-desc'),
  location: z.string().min(1).optional(),
  status: z.enum(['paid', 'preparing', 'pending', 'refunded']).optional(),
  q: z.string().trim().max(80).optional(),
});

export const FinanceQuery = z.object({
  location: z.string().min(1).optional(),
  days: z.coerce.number().int().min(1).max(30).default(30),
});

export const ProductUpdateBody = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.enum(CATEGORIES),
  price: z.number().nonnegative().max(100000),
  description: z.string().max(500),
  available: z.boolean(),
  spicyLevel: z.number().int().min(0).max(5),
});

export type ProductListQuery = z.infer<typeof ProductListQuery>;
export type OrderListQuery = z.infer<typeof OrderListQuery>;
export type FinanceQuery = z.infer<typeof FinanceQuery>;
export type ProductUpdateBody = z.infer<typeof ProductUpdateBody>;
