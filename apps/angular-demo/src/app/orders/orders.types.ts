/** Order search — shared types and the data-access boundary. */
import type { Observable } from 'rxjs';

export const ORDER_STATUSES = ['paid', 'preparing', 'pending', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_SORTS = ['date-desc', 'date-asc', 'total-desc', 'total-asc'] as const;
export type OrderSort = (typeof ORDER_SORTS)[number];

export interface OrderItem {
  productId: string;
  qty: number;
}

export interface Order {
  id: string;
  location: string;
  createdAt: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  customer: string;
}

export interface OrderPage {
  items: Order[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  sort: OrderSort;
}

export interface OrderQuery {
  page: number;
  pageSize: number;
  sort: OrderSort;
  q?: string;
  status?: OrderStatus;
  location?: string;
}

/** Why a result set is empty — distinct cases the UI must tell apart. */
export type EmptyReason = 'no-orders' | 'no-match' | 'out-of-range';

export type OrderState =
  | { status: 'idle' }
  | { status: 'loading' }
  /** `revalidating` = showing cached/previous data while a fresh request is in flight (SWR). */
  | { status: 'results'; page: OrderPage; revalidating: boolean }
  | { status: 'empty'; reason: EmptyReason }
  | { status: 'error'; message: string };

export const ORDERS = {
  /** API endpoint: GET /api/orders?page&pageSize&q&sort&status&location — do not change. */
  ENDPOINT: '/api/orders',
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 10,
  DEFAULT_SORT: 'date-desc',
  DEBOUNCE_MS: 300,
} as const;

/** Stable cache/dedup key for a query. */
export function queryKey(query: OrderQuery): string {
  return `${query.page}|${query.pageSize}|${query.sort}|${query.status ?? ''}|${query.q ?? ''}|${query.location ?? ''}`;
}

/** Data-access boundary — do not change the API contract. */
export abstract class OrderApi {
  abstract list(query: OrderQuery): Observable<OrderPage>;
}
