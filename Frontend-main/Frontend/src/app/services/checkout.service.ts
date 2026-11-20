import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { API_URL } from '../app.config';

export interface CartItem {
  id: number;
  service_id?: number;
  event_id?: number;
  image_url?: string;
  package_id?: number;
  quantity: number;
  name: string;
  description: string;
  location: string;
  currency: string;
  provider_name?: string;
  unit_price: number;
  package_name?: string;
  category_name?: string;
  event_date?: string;
  event_time?: string;
  guest_count?: number;
  included_services?: string;
  decorations?: string;
  additional_facilities?: string;
  event_theme?: string;
  special_instructions?: string;
}

export interface Cart {
  id: number;
  items: CartItem[];
  subtotal: number;
  count: number;
}

export interface CheckoutItem {
  service_id?: number;
  event_id?: number;
  package_id?: number;
  quantity: number;
  requirements: string;
  service_date: string;
  service_time?: string;
}

export interface OrderItem extends CheckoutItem {
  id: number;
  service_name: string;
  package_name?: string;
  provider_name?: string;
  unit_price: number;
  line_total: number;
}

export interface Order {
  id: number;
  reference: string;
  customer_name: string;
  customer_email: string;
  phone_number: string;
  billing_address: string;
  event_date: string;
  event_location: string;
  guest_count?: number;
  special_instructions?: string;
  status: string;
  payment_status: string;
  payment_method: string;
  subtotal: number;
  discount: number;
  fee: number;
  tax: number;
  total: number;
  created_at: string;
  items: OrderItem[];
  booking_type?: 'service' | 'graduation';
  event_category?: string;
  service_snapshot?: string;
  ticket_quantity?: number;
  ticket_holders?: string;
  faculty?: string;
  department?: string;
  instapay_proof_path?: string;
}

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private readonly cartSubject = new BehaviorSubject<Cart>({ id: 0, items: [], subtotal: 0, count: 0 });
  readonly cart$ = this.cartSubject.asObservable();

  constructor(private http: HttpClient) {}

  getCart(): Observable<Cart> {
    return this.http.get<Cart>(`${API_URL}/checkout/cart`).pipe(tap(cart => this.cartSubject.next(cart)));
  }

  addToCart(serviceId: number, packageId?: number, quantity = 1): Observable<Cart> {
    return this.http.post<Cart>(`${API_URL}/checkout/cart/items`, { service_id: serviceId, package_id: packageId ?? null, quantity })
      .pipe(tap(cart => this.cartSubject.next(cart)));
  }

  addEventToCart(eventId: number, quantity = 1): Observable<Cart> {
    return this.http.post<Cart>(`${API_URL}/checkout/cart/items`, { event_id: eventId, quantity })
      .pipe(tap(cart => this.cartSubject.next(cart)));
  }

  updateItem(item: CartItem, quantity: number): Observable<Cart> {
    return this.http.patch<Cart>(`${API_URL}/checkout/cart/items/${item.id}`, {
      service_id: item.service_id ?? null, event_id: item.event_id ?? null,
      package_id: item.package_id ?? null, quantity
    }).pipe(tap(cart => this.cartSubject.next(cart)));
  }

  removeItem(item: CartItem): Observable<Cart> {
    return this.http.delete<Cart>(`${API_URL}/checkout/cart/items/${item.id}`).pipe(tap(cart => this.cartSubject.next(cart)));
  }

  clearCart(): Observable<Cart> {
    return this.http.delete<Cart>(`${API_URL}/checkout/cart`).pipe(tap(cart => this.cartSubject.next(cart)));
  }

  createOrder(payload: object): Observable<Order> {
    return this.http.post<Order>(`${API_URL}/checkout/orders`, payload).pipe(tap(() => this.getCart().subscribe()));
  }

  getOrders(): Observable<Order[]> { return this.http.get<Order[]>(`${API_URL}/checkout/orders`); }
  getOrder(id: number): Observable<Order> { return this.http.get<Order>(`${API_URL}/checkout/orders/${id}`); }
  cancelOrder(id: number): Observable<Order> { return this.http.patch<Order>(`${API_URL}/checkout/orders/${id}/cancel`, {}); }

  getAdminOrders(filters: { status?: string; payment_status?: string; search?: string } = {}): Observable<Order[]> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params = params.set(key, value); });
    return this.http.get<Order[]>(`${API_URL}/checkout/admin/orders`, { params });
  }

  updateAdminOrder(id: number, status: string): Observable<Order> {
    return this.http.patch<Order>(`${API_URL}/checkout/admin/orders/${id}`, { status });
  }

  updateAdminPayment(id: number, payment_status: string): Observable<Order> {
    return this.http.patch<Order>(`${API_URL}/checkout/admin/orders/${id}/payment`, { payment_status });
  }

  deleteAdminOrder(id: number): Observable<{ deleted: boolean; id: number }> {
    return this.http.delete<{ deleted: boolean; id: number }>(
      `${API_URL}/checkout/admin/orders/${id}`
    );
  }

  resendAdminEmail(id: number): Observable<{ reference: string; email_status: string }> {
    return this.http.post<{ reference: string; email_status: string }>(
      `${API_URL}/checkout/admin/orders/${id}/resend-email`,
      {}
    );
  }

  getReceiptUrl(id: number): string {
    return `${API_URL}/checkout/orders/${id}/receipt.pdf`;
  }

  downloadReceipt(id: number): Observable<Blob> {
    return this.http.get(`${API_URL}/checkout/orders/${id}/receipt.pdf`, { responseType: 'blob' });
  }

  getProviderOrders(): Observable<Order[]> { return this.http.get<Order[]>(`${API_URL}/checkout/provider/orders`); }
  updateProviderOrder(id: number, status: string): Observable<Order> {
    return this.http.patch<Order>(`${API_URL}/checkout/provider/orders/${id}`, { status });
  }
}
