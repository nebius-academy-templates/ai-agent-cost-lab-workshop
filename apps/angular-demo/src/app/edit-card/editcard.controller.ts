/**
 * Edit-card controller — loads a product, edits a draft, validates, and saves it.
 */
import { Injectable } from '@angular/core';
import { BehaviorSubject, type Observable } from 'rxjs';
import { EditCardApi, toDraft, type EditState, type FieldErrors, type ProductDraft } from './editcard.types';

@Injectable()
export class EditCardController {
  private readonly state = new BehaviorSubject<EditState>({ status: 'loading' });
  readonly state$: Observable<EditState> = this.state.asObservable();

  draft: ProductDraft = blankDraft();
  errors: FieldErrors = {};
  initialDraft: ProductDraft = blankDraft();
  private id = '';

  constructor(private readonly api: EditCardApi) {}

  load(id: string): void {
    this.id = id;
    this.state.next({ status: 'loading' });
    this.api.get(id).subscribe({
      next: (product) => {
        this.draft = toDraft(product);
        this.initialDraft = { ...this.draft };
        this.state.next({ status: 'ready' });
      },
      error: (err: unknown) => this.state.next({ status: 'error', message: messageOf(err) }),
    });
  }

  setField<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]): void {
    this.draft = { ...this.draft, [key]: value };
  }

  get isDirty(): boolean {
    return JSON.stringify(this.draft) !== JSON.stringify(this.initialDraft);
  }

  save(): void {
    this.state.next({ status: 'saving' });
    this.api.save(this.id, this.draft).subscribe({
      next: () => {
        this.initialDraft = { ...this.draft };
        this.state.next({ status: 'saved' });
      },
      error: (err: unknown) => this.state.next({ status: 'error', message: messageOf(err) }),
    });
  }

  get safeDescription(): string {
    return this.draft.description;
  }
}

function blankDraft(): ProductDraft {
  return { name: '', category: 'Burritos', price: 0, description: '', available: true, spicyLevel: 0 };
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Failed to save product.';
}
