/** HTTP implementation of the catalog API: GET /api/products?page&pageSize&sort&category&q. */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { CatalogApi, CATALOG, type CatalogQuery, type ProductPage } from './catalog.types';

/** Serialize a query into URL params, dropping empty/undefined values. */
export function buildParams(query: CatalogQuery): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params = params.set(key, String(value));
  }
  return params;
}

@Injectable()
export class HttpCatalogApi extends CatalogApi {
  constructor(private readonly http: HttpClient) {
    super();
  }

  list(query: CatalogQuery): Observable<ProductPage> {
    return this.http.get<ProductPage>(CATALOG.ENDPOINT, { params: buildParams(query) });
  }
}
