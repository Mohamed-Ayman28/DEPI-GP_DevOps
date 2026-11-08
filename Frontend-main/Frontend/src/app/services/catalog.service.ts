import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CatalogService as CatalogListing,
  CreateCatalogService,
  ServiceCategory,
  ServicePackage
} from '../models/catalog.model';

export interface CatalogSearchResponse {
  results: CatalogListing[];
  page: number;
  page_size: number;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly apiUrl = '/catalog-api';

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  getCategories(): Observable<ServiceCategory[]> {
    return this.http.get<ServiceCategory[]>(`${this.apiUrl}/categories`);
  }

  searchServices(filters: {
    q?: string;
    categoryId?: number;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
  }): Observable<CatalogSearchResponse> {
    let params = new HttpParams();
    if (filters.q) params = params.set('q', filters.q);
    if (filters.categoryId) params = params.set('category_id', filters.categoryId);
    if (filters.minPrice !== undefined) params = params.set('min_price', filters.minPrice);
    if (filters.maxPrice !== undefined) params = params.set('max_price', filters.maxPrice);
    if (filters.page) params = params.set('page', filters.page);
    return this.http.get<CatalogSearchResponse>(`${this.apiUrl}/services`, { params });
  }

  getService(id: number): Observable<CatalogListing> {
    return this.http.get<CatalogListing>(`${this.apiUrl}/services/${id}`);
  }

  createService(service: CreateCatalogService): Observable<CatalogListing> {
    return this.http.post<CatalogListing>(`${this.apiUrl}/services`, service, {
      headers: this.headers()
    });
  }

  addPackage(serviceId: number, servicePackage: ServicePackage): Observable<ServicePackage> {
    return this.http.post<ServicePackage>(
      `${this.apiUrl}/services/${serviceId}/packages`,
      servicePackage,
      { headers: this.headers() }
    );
  }
}
