/**
 * Orders controller — drives the order search data grid: query state, paging, filters, and view state.
 */
import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, type Observable } from 'rxjs';
import { OrderApi, ORDERS, type OrderQuery, type OrderSort, type OrderState, type OrderStatus } from './orders.types';

@Injectable()
export class OrdersController {
  private readonly state = new BehaviorSubject<OrderState>({ status: 'idle' });
  readonly state$: Observable<OrderState> = this.state.asObservable();

  /** Current query — read by the component to populate the toolbar controls. */
  current: OrderQuery = { page: ORDERS.DEFAULT_PAGE, pageSize: ORDERS.DEFAULT_PAGE_SIZE, sort: ORDERS.DEFAULT_SORT };

  constructor(
    private readonly api: OrderApi,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  init(): void {
    this.current = { page: ORDERS.DEFAULT_PAGE, pageSize: ORDERS.DEFAULT_PAGE_SIZE, sort: ORDERS.DEFAULT_SORT };
    this.load();
  }

  setQuery(q: string): void {
    this.current = { ...this.current, q: q.trim() || undefined, page: ORDERS.DEFAULT_PAGE };
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: this.current.q, page: 1 }, queryParamsHandling: 'merge' });
    this.load();
  }

  setPage(page: number): void {
    this.current = { ...this.current, page };
    void this.router.navigate([], { relativeTo: this.route, queryParams: { page }, queryParamsHandling: 'merge' });
    this.load();
  }

  setStatus(status: OrderStatus | undefined): void {
    this.current = { ...this.current, status, page: ORDERS.DEFAULT_PAGE };
    this.load();
  }

  setSort(sort: OrderSort): void {
    this.current = { ...this.current, sort };
    this.load();
  }

  private load(): void {
    this.state.next({ status: 'loading' });
    this.api.list(this.current).subscribe({
      next: (page) =>
        this.state.next(page.items.length ? { status: 'results', page, revalidating: false } : { status: 'empty', reason: 'no-match' }),
      error: (err: unknown) => this.state.next({ status: 'error', message: messageOf(err) }),
    });
  }
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Failed to load orders.';
}
