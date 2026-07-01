/** Site footer — Plata Burrito CRM shell. */
import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  template: `
    <footer class="pl-footer">
      <span>© {{ year }} Plata Burrito CRM</span>
      <span class="pl-footer-note">Internal sales console · workshop build</span>
    </footer>
  `,
})
export class FooterComponent {
  readonly year = 2026;
}
