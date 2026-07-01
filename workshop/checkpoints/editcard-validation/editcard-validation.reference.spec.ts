/**
 * MANDATORY reference suite — editcard-validation quality gate. The agent never sees this.
 *
 * The edit form must validate before saving (blocking an invalid submit and surfacing per-field
 * errors), map backend 400 issues back onto fields, escape the description (no HTML injection),
 * track dirty state, and handle save/error/saved transitions correctly.
 */
import { of, throwError } from 'rxjs';
import { EditCardController } from '../../../apps/angular-demo/src/app/edit-card/editcard.controller';
import { EditCardApi, type Product, type ProductDraft, type EditState } from '../../../apps/angular-demo/src/app/edit-card/editcard.types';

function product(): Product {
  return { id: 'BRT-001', name: 'Carne Asada', category: 'Burritos', price: 145, description: 'Grilled steak', available: true, spicyLevel: 1, calories: 600 };
}

class FakeApi extends EditCardApi {
  saveCalls = 0;
  failWith: unknown = null;
  get() { return of(product()); }
  save(_id: string, draft: ProductDraft) {
    this.saveCalls++;
    return this.failWith ? throwError(() => this.failWith) : of({ ...product(), ...draft });
  }
}

function latest(controller: EditCardController): EditState {
  let state: EditState = { status: 'loading' };
  controller.state$.subscribe((s) => (state = s));
  return state;
}

describe('edit-card validation (mandatory)', () => {
  it('blocks save and reports field errors for invalid input', () => {
    const api = new FakeApi();
    const controller = new EditCardController(api);
    controller.load('BRT-001');
    controller.setField('name', '');
    controller.setField('price', -5);
    controller.setField('spicyLevel', 99);
    controller.save();
    expect(api.saveCalls).toBe(0);
    expect(controller.errors.name).toBeTruthy();
    expect(controller.errors.price).toBeTruthy();
    expect(controller.errors.spicyLevel).toBeTruthy();
  });

  it('maps backend 400 issues onto the offending fields', () => {
    const api = new FakeApi();
    api.failWith = { status: 400, error: { error: 'invalid_request', issues: [{ path: 'price', message: 'Price too high.' }] } };
    const controller = new EditCardController(api);
    controller.load('BRT-001');
    controller.setField('price', 999);
    controller.save();
    expect(api.saveCalls).toBe(1);
    expect(controller.errors.price).toBe('Price too high.');
  });

  it('escapes HTML in the description (no XSS)', () => {
    const api = new FakeApi();
    const controller = new EditCardController(api);
    controller.load('BRT-001');
    controller.setField('description', '<img src=x onerror=alert(1)>');
    expect(controller.safeDescription).not.toContain('<img');
    expect(controller.safeDescription).toContain('&lt;img');
  });

  it('saves a valid product and reports saved', () => {
    const api = new FakeApi();
    const controller = new EditCardController(api);
    controller.load('BRT-001');
    controller.setField('name', 'Carnitas');
    controller.save();
    expect(api.saveCalls).toBe(1);
    expect(latest(controller).status).toBe('saved');
  });

  it('detects dirty state after a field change', () => {
    const api = new FakeApi();
    const controller = new EditCardController(api);
    controller.load('BRT-001');
    expect(controller.isDirty).toBe(false);
    controller.setField('name', 'Changed');
    expect(controller.isDirty).toBe(true);
  });

  it('shows error state when API fails', () => {
    const api = new FakeApi();
    api.failWith = new Error('Network down');
    const controller = new EditCardController(api);
    controller.load('BRT-001');
    controller.setField('name', 'Valid Name');
    controller.save();
    expect(latest(controller).status).toBe('error');
  });
});
