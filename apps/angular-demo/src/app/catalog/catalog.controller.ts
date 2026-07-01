/**
 * Catalog controller — drives the catalog data grid: query state, paging, filters, and view state.
 */
import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, type Observable } from 'rxjs';
import { CatalogApi, CATALOG, type Category, type CatalogQuery, type CatalogState, type SortOption } from './catalog.types';

@Injectable()
export class CatalogController {
  private readonly state = new BehaviorSubject<CatalogState>({ status: 'idle' });
  readonly state$: Observable<CatalogState> = this.state.asObservable();

  /** Current query — read by the component to populate the toolbar controls. */
  current: CatalogQuery = { page: CATALOG.DEFAULT_PAGE, pageSize: CATALOG.DEFAULT_PAGE_SIZE, sort: CATALOG.DEFAULT_SORT };

  constructor(
    private readonly api: CatalogApi,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  init(): void {
    this.current = { page: CATALOG.DEFAULT_PAGE, pageSize: CATALOG.DEFAULT_PAGE_SIZE, sort: CATALOG.DEFAULT_SORT };
    this.load();
  }

  setPage(page: number): void {
    this.current = { ...this.current, page };
    void this.router.navigate([], { relativeTo: this.route, queryParams: { page }, queryParamsHandling: 'merge' });
    this.load();
  }

  setSort(sort: SortOption): void {
    this.current = { ...this.current, sort };
    this.load();
  }

  setCategory(category: Category | undefined): void {
    this.current = { ...this.current, category };
    this.load();
  }

  setQuery(q: string): void {
    this.current = { ...this.current, q: q.trim() || undefined };
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
  return 'Failed to load catalog.';
}
