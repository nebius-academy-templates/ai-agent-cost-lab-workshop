/**
 * MANDATORY reference suite — orders-search quality gate. The agent never sees this.
 *
 * The orders grid must load on init and be driven by URL params: page 1 by default,
 * the deep-linked page when present, page 1 for absent/invalid values, and react to
 * route changes. Every request must carry an integer page >= 1. Stale responses must
 * never overwrite newer ones, repeated queries served from cache, empty results classified.
 */
import { of, throwError, BehaviorSubject, type Observable } from 'rxjs';
import { delay } from 'rxjs/operators';
import { convertToParamMap, type ParamMap, type ActivatedRoute, type Router } from '@angular/router';
import { OrdersController } from '../../../apps/angular-demo/src/app/orders/orders.controller';
import { OrderApi, type OrderQuery, type Order, type OrderPage, type OrderState } from '../../../apps/angular-demo/src/app/orders/orders.types';

function order(id: string): Order {
  return { id, location: 'centro', createdAt: '2026-06-24', status: 'paid', items: [], total: 100, customer: 'Ana' };
}
function makePage(items: Order[], page: number): OrderPage {
  return { items, page, pageSize: 10, total: items.length, totalPages: 5, sort: 'date-desc' };
}

class FakeApi extends OrderApi {
  readonly calls: OrderQuery[] = [];
  readonly delays = new Map<string, number>();
  empty = false; fail = false;
  list(query: OrderQuery): Observable<OrderPage> {
    this.calls.push({ ...query });
    if (this.fail) return throwError(() => new Error('boom'));
    const items = this.empty ? [] : [order(query.q ?? 'init')];
    return of(makePage(items, query.page)).pipe(delay(this.delays.get(query.q ?? '') ?? 0));
  }
  get last(): OrderQuery | undefined { return this.calls[this.calls.length - 1]; }
}

function routeWith(params: Record<string, string> = {}) {
  const subject = new BehaviorSubject<ParamMap>(convertToParamMap(params));
  return {
    route: { snapshot: { queryParamMap: convertToParamMap(params) }, queryParamMap: subject.asObservable() } as unknown as ActivatedRoute,
    emit: (p: Record<string, string>) => subject.next(convertToParamMap(p)),
  };
}
const router = { navigate: () => Promise.resolve(true) } as unknown as Router;

function latest(ctrl: OrdersController): OrderState {
  let s: OrderState = { status: 'idle' };
  ctrl.state$.subscribe((v) => (s = v));
  return s;
}

describe('orders search (mandatory)', () => {
  it('loads page 1 by default with no URL params', () => {
    const api = new FakeApi();
    const { route } = routeWith();
    new OrdersController(api, route, router).init();
    expect(api.last?.page).toBe(1);
  });

  it('reads deep-linked page + sort + status + q + location from URL', () => {
    const api = new FakeApi();
    const { route } = routeWith({ page: '3', sort: 'total-desc', status: 'refunded', q: 'ana', location: 'centro' });
    new OrdersController(api, route, router).init();
    expect(api.last).toMatchObject({ page: 3, sort: 'total-desc', status: 'refunded', q: 'ana', location: 'centro' });
  });

  it('defaults to page 1 for absent/invalid page param', () => {
    for (const p of ['', '0', '-1', 'NaN', 'abc']) {
      const api = new FakeApi();
      const { route } = routeWith({ page: p });
      new OrdersController(api, route, router).init();
      expect(api.last?.page).toBe(1);
    }
  });

  it('reacts to route changes', () => {
    const api = new FakeApi();
    const { route, emit } = routeWith({ page: '1' });
    new OrdersController(api, route, router).init();
    emit({ page: '3', sort: 'total-asc' });
    expect(api.last).toMatchObject({ page: 3, sort: 'total-asc' });
  });

  it('never lets a stale response overwrite a newer one', () => {
    const api = new FakeApi();
    api.delays.set('slow', 50); api.delays.set('fast', 10);
    const { route, emit } = routeWith({ page: '1' });
    const ctrl = new OrdersController(api, route, router);
    ctrl.init();
    emit({ page: '2', q: 'slow' });
    emit({ page: '3', q: 'fast' });
    // Wait for all async
    return new Promise<void>((resolve) => setTimeout(() => {
      const state = latest(ctrl);
      expect(state.status).toBe('results');
      if (state.status === 'results') expect(state.page.page).toBe(3);
      resolve();
    }, 200));
  });

  it('serves repeated queries from cache', () => {
    const api = new FakeApi();
    const { route, emit } = routeWith({ page: '1' });
    new OrdersController(api, route, router).init();
    emit({ page: '2' });
    emit({ page: '1' });
    expect(api.calls.filter((c) => c.page === 1).length).toBe(1);
  });

  it('classifies empty results', () => {
    const api = new FakeApi();
    api.empty = true;
    const { route } = routeWith({ page: '1' });
    const ctrl = new OrdersController(api, route, router);
    ctrl.init();
    return new Promise<void>((resolve) => setTimeout(() => {
      const s = latest(ctrl);
      expect(s.status).toBe('empty');
      if (s.status === 'empty') expect(s.reason).toBeDefined();
      resolve();
    }, 50));
  });

  it('surfaces an error state when the API fails', () => {
    const api = new FakeApi();
    api.fail = true;
    const { route } = routeWith();
    const ctrl = new OrdersController(api, route, router);
    ctrl.init();
    return new Promise<void>((resolve) => setTimeout(() => {
      expect(latest(ctrl).status).toBe('error');
      resolve();
    }, 50));
  });
});
