import { Component } from '@angular/core';

@Component({
  selector: 'app-finance-page',
  standalone: true,
  template: `
    <header class="pl-page-head">
      <h1>Finance</h1>
      <p class="pl-lede">30-day sales by location.</p>
    </header>
    <div class="pl-placeholder">Finance dashboard is wired to the REST backend in a later phase.</div>
  `,
})
export class FinancePageComponent {}
