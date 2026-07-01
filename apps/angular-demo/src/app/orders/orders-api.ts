/** HTTP implementation of the orders API: GET /api/orders?page&pageSize&q&sort&status&location. */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { OrderApi, ORDERS, type OrderQuery, type OrderPage } from './orders.types';

export function buildParams(query: OrderQuery): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params = params.set(key, String(value));
  }
  return params;
}

@Injectable()
export class HttpOrderApi extends OrderApi {
  constructor(private readonly http: HttpClient) {
    super();
  }

  list(query: OrderQuery): Observable<OrderPage> {
    return this.http.get<OrderPage>(ORDERS.ENDPOINT, { params: buildParams(query) });
  }
}
