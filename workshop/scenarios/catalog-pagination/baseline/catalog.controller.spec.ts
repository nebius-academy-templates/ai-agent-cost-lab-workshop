/**
 * Catalog tests. RED on the shipped (buggy) controller — which ignores the URL and re-fetches
 * everything — and GREEN once the grid is URL-driven and cache-backed.
 */
import { of, BehaviorSubject, type Observable } from 'rxjs';
import { convertToParamMap, type ParamMap, type ActivatedRoute, type Router } from '@angular/router';
import { CatalogController } from './catalog.controller';
import { CatalogApi, type CatalogQuery, type Product, type ProductPage } from './catalog.types';

function product(id: string): Product {
  return { id, name: id, category: 'Burritos', price: 100, description: '', available: true, spicyLevel: 0, calories: 200 };
}

function makePage(items: Product[], page: number): ProductPage {
  return { items, page, pageSize: 12, total: 42, totalPages: 5, sort: 'name' };
}

class FakeApi extends CatalogApi {
  readonly calls: CatalogQuery[] = [];
  list(query: CatalogQuery): Observable<ProductPage> {
    this.calls.push({ ...query });
    return of(makePage([product(`p${query.page}`)], query.page));
  }
  get last(): CatalogQuery | undefined {
    return this.calls[this.calls.length - 1];
  }
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

describe('CatalogController data grid', () => {
  it('reads page + sort + category + q from the URL on init', () => {
    const api = new FakeApi();
    const { route } = makeRoute({ page: '3', sort: 'price-desc', category: 'Bowls', q: 'asada' });
    new CatalogController(api, route, router).init();
    expect(api.last).toMatchObject({ page: 3, sort: 'price-desc', category: 'Bowls', q: 'asada' });
  });

  it('reacts to a later route change', () => {
    const api = new FakeApi();
    const { route, emit } = makeRoute();
    new CatalogController(api, route, router).init();
    emit({ page: '2' });
    expect(api.last?.page).toBe(2);
  });

  it('serves a repeated query from cache instead of refetching', () => {
    const api = new FakeApi();
    const { route, emit } = makeRoute({ page: '1' });
    new CatalogController(api, route, router).init();
    emit({ page: '2' });
    emit({ page: '1' });
    expect(api.calls.filter((c) => c.page === 1).length).toBe(1);
  });
});
