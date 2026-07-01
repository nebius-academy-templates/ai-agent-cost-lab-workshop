import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shell/navbar.component';
import { FooterComponent } from './shell/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  template: `
    <app-navbar />
    <main class="pl-main"><router-outlet /></main>
    <app-footer />
  `,
})
export class AppComponent {}
