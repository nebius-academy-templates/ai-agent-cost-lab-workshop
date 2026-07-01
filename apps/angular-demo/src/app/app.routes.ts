import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'catalog' },
  { path: 'catalog', loadComponent: () => import('./catalog/catalog.page').then((m) => m.CatalogPageComponent) },
  { path: 'orders', loadComponent: () => import('./orders/orders.page').then((m) => m.OrdersPageComponent) },
  { path: 'finance', loadComponent: () => import('./finance/finance.page').then((m) => m.FinancePageComponent) },
  { path: 'edit/:id', loadComponent: () => import('./edit-card/edit-card.page').then((m) => m.EditCardPageComponent) },
  { path: '**', redirectTo: 'catalog' },
];
