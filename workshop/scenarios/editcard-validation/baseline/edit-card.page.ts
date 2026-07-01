import { Component, Input, type OnDestroy, type OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { HttpEditCardApi } from './editcard-api';
import { EditCardController } from './editcard.controller';
import { EditCardApi, CATEGORIES, type Category, type EditState } from './editcard.types';

@Component({
  selector: 'app-edit-card-page',
  standalone: true,
  imports: [RouterLink],
  providers: [EditCardController, { provide: EditCardApi, useClass: HttpEditCardApi }],
  template: `
    <header class="pl-page-head">
      <h1>Edit product</h1>
      <p class="pl-lede"><a routerLink="/catalog">← Catalog</a> · editing <code>{{ id }}</code></p>
    </header>

    @switch (state.status) {
      @case ('loading') {
        <p class="pl-state">Loading…</p>
      }
      @case ('error') {
        <p class="pl-state pl-state--error">{{ state.message }}</p>
      }
      @default {
        <form class="pl-card pl-form" (submit)="$event.preventDefault(); controller.save()">
          <label>
            Name
            <input class="pl-input" [value]="controller.draft.name" (input)="onText('name', $event)" />
            @if (controller.errors.name) {
              <span class="pl-field-error">{{ controller.errors.name }}</span>
            }
          </label>

          <label>
            Category
            <select class="pl-select" (change)="onCategory($event)">
              @for (cat of categories; track cat) {
                <option [value]="cat" [selected]="cat === controller.draft.category">{{ cat }}</option>
              }
            </select>
          </label>

          <label>
            Price (MXN)
            <input class="pl-input" type="number" [value]="controller.draft.price" (input)="onNumber('price', $event)" />
            @if (controller.errors.price) {
              <span class="pl-field-error">{{ controller.errors.price }}</span>
            }
          </label>

          <label>
            Description
            <textarea class="pl-input" rows="3" [value]="controller.draft.description" (input)="onText('description', $event)"></textarea>
            @if (controller.errors.description) {
              <span class="pl-field-error">{{ controller.errors.description }}</span>
            }
          </label>

          <label class="pl-check">
            <input type="checkbox" [checked]="controller.draft.available" (change)="onChecked('available', $event)" />
            Available
          </label>

          <div class="pl-form-actions">
            <button class="pl-btn" type="submit" [disabled]="state.status === 'saving'">
              {{ state.status === 'saving' ? 'Saving…' : 'Save' }}
            </button>
            @if (state.status === 'saved') {
              <span class="pl-badge">Saved</span>
            }
          </div>
        </form>

        <section class="pl-card pl-preview">
          <h3>Description preview</h3>
          <div [innerHTML]="controller.safeDescription"></div>
        </section>
      }
    }
  `,
})
export class EditCardPageComponent implements OnInit, OnDestroy {
  /** Bound from the /edit/:id route param via withComponentInputBinding(). */
  @Input() id = '';
  readonly categories = CATEGORIES;

  state: EditState = { status: 'loading' };
  private sub?: Subscription;

  constructor(readonly controller: EditCardController) {}

  ngOnInit(): void {
    this.sub = this.controller.state$.subscribe((s) => (this.state = s));
    this.controller.load(this.id);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onText(key: 'name' | 'description', event: Event): void {
    this.controller.setField(key, (event.target as HTMLInputElement).value);
  }

  onNumber(key: 'price' | 'spicyLevel', event: Event): void {
    this.controller.setField(key, Number((event.target as HTMLInputElement).value));
  }

  onChecked(key: 'available', event: Event): void {
    this.controller.setField(key, (event.target as HTMLInputElement).checked);
  }

  onCategory(event: Event): void {
    this.controller.setField('category', (event.target as HTMLSelectElement).value as Category);
  }
}
