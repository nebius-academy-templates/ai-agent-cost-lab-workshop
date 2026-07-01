/** Product catalog — shared types and the data-access boundary. */
import type { Observable } from 'rxjs';

export const CATEGORIES = ['Burritos', 'Bowls', 'Tacos', 'Sides', 'Drinks', 'Salsas'] as const;
export type Category = (typeof CATEGORIES)[number];

export const SORT_OPTIONS = ['name', 'price-asc', 'price-desc', 'category'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export interface Product {
  id: string;
  name: string;
  category: Category;
  price: number;
  description: string;
  available: boolean;
  spicyLevel: number;
  calories: number;
}

/** One page of catalog results, mirroring the REST `GET /api/products` response. */
export interface ProductPage {
  items: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sort: SortOption;
}

export interface CatalogQuery {
  page: number;
  pageSize: number;
  sort: SortOption;
  category?: Category;
  q?: string;
}

/** Why a result set is empty — distinct cases the UI must tell apart. */
export type EmptyReason = 'no-products' | 'no-match' | 'out-of-range';

export type CatalogState =
  | { status: 'idle' }
  | { status: 'loading' }
  /** `revalidating` = showing cached/previous data while a fresh request is in flight (SWR). */
  | { status: 'results'; page: ProductPage; revalidating: boolean }
  | { status: 'empty'; reason: EmptyReason }
  | { status: 'error'; message: string };

export const CATALOG = {
  /** API endpoint: GET /api/products?page&pageSize&sort&category&q — do not change the contract. */
  ENDPOINT: '/api/products',
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 12,
  DEFAULT_SORT: 'name',
} as const;

/** Stable cache/dedup key for a query. */
export function queryKey(query: CatalogQuery): string {
  return `${query.page}|${query.pageSize}|${query.sort}|${query.category ?? ''}|${query.q ?? ''}`;
}

/** Data-access boundary — do not change the API contract. */
export abstract class CatalogApi {
  abstract list(query: CatalogQuery): Observable<ProductPage>;
}
