/**
 * Order-search tests. RED on the shipped (buggy) controller — which ignores the URL and re-fetches
 * everything — and GREEN once the grid is URL-driven, debounced, and cache-backed.
 */
import { of, BehaviorSubject, type Observable } from 'rxjs';
import { delay } from 'rxjs/operators';
import { convertToParamMap, type ParamMap, type ActivatedRoute, type Router } from '@angular/router';
import { OrdersController } from './orders.controller';
import { OrderApi, type OrderQuery, type Order, type OrderPage } from './orders.types';

function order(id: string): Order {
  return { id, location: 'centro', createdAt: '2026-06-24', status: 'paid', items: [], total: 100, customer: 'Ana' };
}
function makePage(items: Order[], page: number): OrderPage {
  return { items, page, pageSize: 10, total: 42, totalPages: 5, sort: 'date-desc' };
}

class FakeApi extends OrderApi {
  readonly calls: OrderQuery[] = [];
  list(query: OrderQuery): Observable<OrderPage> {
    this.calls.push({ ...query });
    // Async on purpose: responses resolve on a later tick, so switchMap cancels an in-flight
    // request when a newer one starts. A cache that only fills on completion loses the cancelled
    // query's slot — a repeat then refetches. Caching/deduping in flight is what keeps it to one GET.
    return of(makePage([order(`ORD-${query.page}00`), order(`ORD-${query.page}01`)], query.page)).pipe(delay(0));
  }
  get last(): OrderQuery | undefined { return this.calls[this.calls.length - 1]; }
}

function makeRoute(initial: Record<string, string> = {}) {
  const subject = new BehaviorSubject<ParamMap>(convertToParamMap(initial));
  const route = {
    snapshot: { queryParamMap: convertToParamMap(initial) },
    queryParamMap: subject.asObservable(),
  } as unknown as ActivatedRoute;
  return { route, emit: (p: Record<string, string>) => subject.next(convertToParamMap(p)) };
}

const router = { navigate: () => Promise.resolve(true) } as unknown as Router;

describe('OrdersController data grid', () => {
  it('reads page + sort + status + q + location from the URL on init', () => {
    const api = new FakeApi();
    const { route } = makeRoute({ page: '3', sort: 'total-desc', status: 'refunded', q: 'ana', location: 'centro' });
    new OrdersController(api, route, router).init();
    expect(api.last).toMatchObject({ page: 3, sort: 'total-desc', status: 'refunded', q: 'ana', location: 'centro' });
  });

  it('reacts to a later route change', () => {
    const api = new FakeApi();
    const { route, emit } = makeRoute();
    new OrdersController(api, route, router).init();
    emit({ page: '2' });
    expect(api.last?.page).toBe(2);
  });

  it('serves a repeated query from cache instead of refetching', () => {
    const api = new FakeApi();
    const { route, emit } = makeRoute({ page: '1' });
    new OrdersController(api, route, router).init();
    emit({ page: '2' });
    emit({ page: '1' });
    expect(api.calls.filter((c) => c.page === 1).length).toBe(1);
  });
});
