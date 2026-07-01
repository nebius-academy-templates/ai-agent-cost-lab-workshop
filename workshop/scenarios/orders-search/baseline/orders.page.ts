import { Component, type OnDestroy, type OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { HttpOrderApi } from './orders-api';
import { OrdersController } from './orders.controller';
import { OrderApi, ORDER_STATUSES, ORDER_SORTS, type OrderState, type OrderSort, type OrderStatus } from './orders.types';

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [RouterLink],
  providers: [OrdersController, { provide: OrderApi, useClass: HttpOrderApi }],
  template: `
    <header class="pl-page-head">
      <h1>Orders</h1>
      <p class="pl-lede">Search orders across locations.</p>
    </header>

    <div class="pl-toolbar">
      <input class="pl-input" type="search" placeholder="Search by id, customer, or product…" (input)="onSearch($event)" />
      <select class="pl-select" (change)="onStatus($event)">
        <option value="">All statuses</option>
        @for (s of statuses; track s) {
          <option [value]="s" [selected]="s === controller.current.status">{{ s }}</option>
        }
      </select>
      <select class="pl-select" (change)="onSort($event)">
        @for (opt of sorts; track opt) {
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
            @case ('no-orders') { No orders yet. }
            @case ('no-match') { No orders match your filters. }
            @case ('out-of-range') { That page is out of range — <a routerLink="/orders">back to page 1</a>. }
          }
        </p>
      }
      @case ('results') {
        @if (state.revalidating) {
          <p class="pl-state">Updating…</p>
        }
        <table class="pl-table">
          <thead><tr><th>Order</th><th>Customer</th><th>Location</th><th>Status</th><th>Total</th></tr></thead>
          <tbody>
            @for (o of state.page.items; track o.id) {
              <tr>
                <td>{{ o.id }}</td><td>{{ o.customer }}</td><td>{{ o.location }}</td>
                <td><span class="pl-badge">{{ o.status }}</span></td><td>{{ '$' + o.total }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
      @default { <p class="pl-state">Type to search orders.</p> }
    }

    <div class="pl-pagination">
      <button class="pl-btn pl-btn--ghost" type="button" [disabled]="page <= 1" (click)="goto(page - 1)">Prev</button>
      <span>Page {{ page }} @if (totalPages > 1) {of {{ totalPages }}}</span>
      <button class="pl-btn pl-btn--ghost" type="button" [disabled]="state.status === 'results' && page >= totalPages" (click)="goto(page + 1)">Next</button>
    </div>
  `,
})
export class OrdersPageComponent implements OnInit, OnDestroy {
  readonly statuses = ORDER_STATUSES;
  readonly sorts = ORDER_SORTS;
  state: OrderState = { status: 'idle' };
  page = 1; totalPages = 1;
  private sub?: Subscription;
  constructor(readonly controller: OrdersController) {}
  ngOnInit(): void {
    this.sub = this.controller.state$.subscribe((s) => { this.state = s; if (s.status === 'results') { this.page = s.page.page; this.totalPages = s.page.totalPages; } });
    this.controller.init();
  }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }
  onSearch(event: Event): void { this.controller.setQuery((event.target as HTMLInputElement).value); }
  onStatus(event: Event): void { const value = (event.target as HTMLSelectElement).value; this.controller.setStatus(value ? (value as OrderStatus) : undefined); }
  onSort(event: Event): void { this.controller.setSort((event.target as HTMLSelectElement).value as OrderSort); }
  goto(page: number): void { if (page < 1) return; this.page = page; this.controller.setPage(page); }
}
