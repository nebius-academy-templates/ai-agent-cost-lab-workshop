/** HTTP implementation of the edit-card API: GET/PUT /api/products/:id. */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { EditCardApi, EDITCARD, type Product, type ProductDraft } from './editcard.types';

@Injectable()
export class HttpEditCardApi extends EditCardApi {
  constructor(private readonly http: HttpClient) {
    super();
  }

  get(id: string): Observable<Product> {
    return this.http.get<Product>(`${EDITCARD.ENDPOINT}/${id}`);
  }

  save(id: string, draft: ProductDraft): Observable<Product> {
    // The backend validates the body and replies 400 { error, issues:[{path,message}] } on bad input.
    return this.http.put<Product>(`${EDITCARD.ENDPOINT}/${id}`, draft);
  }
}
