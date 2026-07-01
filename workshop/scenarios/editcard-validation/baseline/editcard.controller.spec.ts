/**
 * Edit-card tests. RED on the shipped (buggy) controller and GREEN once the form validates before
 * saving and the description is escaped.
 */
import { of, throwError } from 'rxjs';
import { EditCardController } from './editcard.controller';
import { EditCardApi, type Product, type ProductDraft } from './editcard.types';

function product(): Product {
  return { id: 'BRT-001', name: 'Carne Asada', category: 'Burritos', price: 145, description: 'Grilled steak', available: true, spicyLevel: 1, calories: 600 };
}

class FakeApi extends EditCardApi {
  saveCalls = 0;
  failWith: unknown = null;
  get() {
    return of(product());
  }
  save(_id: string, draft: ProductDraft) {
    this.saveCalls++;
    return this.failWith ? throwError(() => this.failWith) : of({ ...product(), ...draft });
  }
}

describe('EditCardController', () => {
  it('blocks save and reports field errors for invalid input', () => {
    const api = new FakeApi();
    const controller = new EditCardController(api);
    controller.load('BRT-001');
    controller.setField('name', '');
    controller.setField('price', -5);
    controller.save();
    expect(api.saveCalls).toBe(0);
    expect(controller.errors.name).toBeTruthy();
    expect(controller.errors.price).toBeTruthy();
  });

  it('escapes HTML in the description (no XSS)', () => {
    const api = new FakeApi();
    const controller = new EditCardController(api);
    controller.load('BRT-001');
    controller.setField('description', '<img src=x onerror=alert(1)>');
    expect(controller.safeDescription).not.toContain('<img');
    expect(controller.safeDescription).toContain('&lt;img');
  });
});
