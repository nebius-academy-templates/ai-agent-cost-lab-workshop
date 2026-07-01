/**
 * MANDATORY reference suite — catalog-pagination quality gate. The agent never sees this.
 *
 * The catalog must load on init and be driven by the ?page route param: page 1 by default,
 * the deep-linked page when present, page 1 for absent/invalid values, and it must react to
 * later route changes. Every request must carry an integer page >= 1.
 */
import { of, BehaviorSubject } from 'rxjs';
import { convertToParamMap, type ParamMap, type ActivatedRoute, type Router } from '@angular/router';
import { CatalogController } from '../../../apps/angular-demo/src/app/catalog/catalog.controller';
import { CatalogApi, type CatalogQuery, type Product, type ProductPage } from '../../../apps/angular-demo/src/app/catalog/catalog.types';

function product(id: string): Product {
  return { id, name: id, category: 'Burritos', price: 100, description: '', available: true, spicyLevel: 0, calories: 200 };
}

function makePage(items: Product[], page: number): ProductPage {
  return { items, page, pageSize: 12, total: items.length, totalPages: 5, sort: 'name' };
}

class FakeApi extends CatalogApi {
  readonly calls: CatalogQuery[] = [];
  list(query: CatalogQuery) {
    this.calls.push({ ...query });
    return of(makePage([product('BRT-001')], query.page));
  }
  get last(): CatalogQuery | undefined {
    return this.calls[this.calls.length - 1];
  }
}

function routeWith(params: Record<string, string> = {}) {
  const subject = new BehaviorSubject<ParamMap>(convertToParamMap(params));
  const route = {
    snapshot: { queryParamMap: convertToParamMap(params) },
    queryParamMap: subject.asObservable(),
  } as unknown as ActivatedRoute;
  return { route, emit: (p: Record<string, string>) => subject.next(convertToParamMap(p)) };
}

const router = { navigate: () => Promise.resolve(true) } as unknown as Router;

function makeController(params: Record<string, string> = {}) {
  const api = new FakeApi();
  const { route, emit } = routeWith(params);
  const controller = new CatalogController(api, route, router);
  return { api, controller, emit };
}

describe('catalog pagination (mandatory)', () => {
  it('requests page 1 on init without user interaction', () => {
    const { api, controller } = makeController();
    controller.init();
    expect(api.calls.length).toBeGreaterThan(0);
    expect(api.last?.page).toBe(1);
  });

  it('opens a deep-linked ?page=3 on init', () => {
    const { api, controller } = makeController({ page: '3' });
    controller.init();
    expect(api.last?.page).toBe(3);
  });

  it('defaults an absent or invalid page to 1', () => {
    for (const bad of [{}, { page: 'abc' }, { page: '0' }, { page: '-2' }, { page: '1.5' }]) {
      const { api, controller } = makeController(bad);
      controller.init();
      expect(api.last?.page).toBe(1);
    }
  });

  it('reacts to a later route change (deep-link / back-forward navigation)', () => {
    const { api, controller, emit } = makeController();
    controller.init();
    emit({ page: '2' });
    expect(api.last?.page).toBe(2);
  });

  it('always sends an integer page >= 1', () => {
    const { api, controller, emit } = makeController();
    controller.init();
    emit({ page: 'xyz' });
    emit({ page: '4' });
    expect(api.calls.length).toBeGreaterThan(0);
    for (const call of api.calls) {
      expect(Number.isInteger(call.page)).toBe(true);
      expect(call.page).toBeGreaterThanOrEqual(1);
    }
  });
});
