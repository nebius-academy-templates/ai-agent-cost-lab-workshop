/** Top navigation bar — Plata Burrito CRM shell. */
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavLink {
  path: string;
  label: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="pl-navbar">
      <a class="pl-brand" routerLink="/catalog">
        <span class="pl-brand-mark">P</span>
        <span class="pl-brand-text">Plata <strong>Burrito</strong> CRM</span>
      </a>
      <ul class="pl-nav">
        @for (link of links; track link.path) {
          <li><a [routerLink]="link.path" routerLinkActive="is-active">{{ link.label }}</a></li>
        }
      </ul>
    </nav>
  `,
})
export class NavbarComponent {
  readonly links: NavLink[] = [
    { path: '/catalog', label: 'Catalog' },
    { path: '/orders', label: 'Orders' },
    { path: '/finance', label: 'Finance' },
  ];
}
