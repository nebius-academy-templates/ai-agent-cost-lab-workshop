/** Product edit card — shared types and the data-access boundary. */
import type { Observable } from 'rxjs';

export const CATEGORIES = ['Burritos', 'Bowls', 'Tacos', 'Sides', 'Drinks', 'Salsas'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Product {
  id: string;
  name: string;
  category: Category;
  price: number;
  description: string;
  available: boolean;
  spicyLevel: number;
  calories: number;
}

/** The editable subset of a product (mirrors the PUT /api/products/:id body). */
export interface ProductDraft {
  name: string;
  category: Category;
  price: number;
  description: string;
  available: boolean;
  spicyLevel: number;
}

export type FieldErrors = Partial<Record<keyof ProductDraft, string>>;

export type EditState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'saving' }
  | { status: 'saved' }
  | { status: 'error'; message: string };

export const EDITCARD = {
  ENDPOINT: '/api/products',
  NAME_MAX: 80,
  DESC_MAX: 500,
  PRICE_MAX: 100000,
  SPICY_MAX: 5,
} as const;

/** Data-access boundary — do not change the API contract. */
export abstract class EditCardApi {
  abstract get(id: string): Observable<Product>;
  abstract save(id: string, draft: ProductDraft): Observable<Product>;
}

export function toDraft(product: Product): ProductDraft {
  const { name, category, price, description, available, spicyLevel } = product;
  return { name, category, price, description, available, spicyLevel };
}

/** Client-side validation — returns a FieldErrors map. Empty = valid. */
export function validate(draft: ProductDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.name || draft.name.trim().length === 0) errors.name = 'Name is required.';
  else if (draft.name.length > EDITCARD.NAME_MAX) errors.name = `Name must be ≤ ${EDITCARD.NAME_MAX} characters.`;
  if (draft.price < 0) errors.price = 'Price cannot be negative.';
  else if (draft.price > EDITCARD.PRICE_MAX) errors.price = `Price must be ≤ ${EDITCARD.PRICE_MAX}.`;
  if (draft.description.length > EDITCARD.DESC_MAX) errors.description = `Description must be ≤ ${EDITCARD.DESC_MAX} characters.`;
  if (draft.spicyLevel < 0 || draft.spicyLevel > EDITCARD.SPICY_MAX) errors.spicyLevel = `Spicy level must be 0–${EDITCARD.SPICY_MAX}.`;
  return errors;
}
