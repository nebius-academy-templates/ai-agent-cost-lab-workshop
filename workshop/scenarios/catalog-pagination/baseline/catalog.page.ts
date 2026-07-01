import { Component, type OnDestroy, type OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { HttpCatalogApi } from './catalog-api';
import { CatalogController } from './catalog.controller';
import { CatalogApi, CATEGORIES, SORT_OPTIONS, type CatalogState, type Category, type SortOption } from './catalog.types';

@Component({
  selector: 'app-catalog-page',
  standalone: true,
  imports: [RouterLink],
  providers: [CatalogController, { provide: CatalogApi, useClass: HttpCatalogApi }],
  template: `
    <header class="pl-page-head">
      <h1>Catalog</h1>
      <p class="pl-lede">Burrito product catalog — filter, sort, and page through the menu.</p>
    </header>

    <div class="pl-toolbar">
      <input class="pl-input" type="search" placeholder="Search products…" (input)="onSearch($event)" />
      <select class="pl-select" (change)="onCategory($event)">
        <option value="">All categories</option>
        @for (cat of categories; track cat) {
          <option [value]="cat" [selected]="cat === controller.current.category">{{ cat }}</option>
        }
      </select>
      <select class="pl-select" (change)="onSort($event)">
        @for (opt of sortOptions; track opt) {
          <option [value]="opt" [selected]="opt === controller.current.sort">{{ opt }}</option>
        }
      </select>
    </div>

    @switch (state.status) {
      @case ('loading') {
        <p class="pl-state">Loading…</p>
      }
      @case ('error') {
        <p class="pl-state pl-state--error">{{ state.message }}</p>
      }
      @case ('empty') {
        <p class="pl-state">
          @switch (state.reason) {
            @case ('no-products') {
              No products yet.
            }
            @case ('no-match') {
              No products match your filters.
            }
            @case ('out-of-range') {
              That page is out of range — <a routerLink="/catalog">back to page 1</a>.
            }
          }
        </p>
      }
      @case ('results') {
        @if (state.revalidating) {
          <p class="pl-state">Updating…</p>
        }
        <table class="pl-table">
          <thead>
            <tr><th>Product</th><th>Category</th><th>Price</th><th></th></tr>
          </thead>
          <tbody>
            @for (p of state.page.items; track p.id) {
              <tr>
                <td>{{ p.name }}</td>
                <td><span class="pl-badge">{{ p.category }}</span></td>
                <td>{{ '$' + p.price }}</td>
                <td><a [routerLink]="['/edit', p.id]">Edit</a></td>
              </tr>
            }
          </tbody>
        </table>
      }
      @default {
        <p class="pl-state">Catalog is empty.</p>
      }
    }

    <div class="pl-pagination">
      <button class="pl-btn pl-btn--ghost" type="button" [disabled]="page <= 1" (click)="goto(page - 1)">Prev</button>
      <span>Page {{ page }} @if (totalPages > 1) {of {{ totalPages }}}</span>
      <button
        class="pl-btn pl-btn--ghost"
        type="button"
        [disabled]="state.status === 'results' && page >= totalPages"
        (click)="goto(page + 1)"
      >
        Next
      </button>
    </div>
  `,
})
export class CatalogPageComponent implements OnInit, OnDestroy {
  readonly categories = CATEGORIES;
  readonly sortOptions = SORT_OPTIONS;

  state: CatalogState = { status: 'idle' };
  page = 1;
  totalPages = 1;

  private sub?: Subscription;

  constructor(readonly controller: CatalogController) {}

  ngOnInit(): void {
    this.sub = this.controller.state$.subscribe((s) => {
      this.state = s;
      if (s.status === 'results') {
        this.page = s.page.page;
        this.totalPages = s.page.totalPages;
      }
    });
    this.controller.init();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onSearch(event: Event): void {
    this.controller.setQuery((event.target as HTMLInputElement).value);
  }

  onCategory(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.controller.setCategory(value ? (value as Category) : undefined);
  }

  onSort(event: Event): void {
    this.controller.setSort((event.target as HTMLSelectElement).value as SortOption);
  }

  goto(page: number): void {
    if (page < 1) return;
    this.page = page;
    this.controller.setPage(page);
  }
}
