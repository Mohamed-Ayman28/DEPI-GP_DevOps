import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../app.config';

export interface AdminStats {
  total_users: number;
  total_events: number;
  total_vendors: number;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone_number: string;
  role: string;
  created_at: string;
}

export interface AdminEvent {
  id: number;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  organizer_name?: string;
  category_id?: number;
  category_name?: string;
  cover_image?: string;
  event_type: 'Public' | 'Private';
  ticket_price: number;
  max_attendees?: number;
  registration_deadline?: string;
  duration?: string;
  status: 'Draft' | 'Published' | 'Cancelled';
  featured: boolean;
  tags?: string;
  attendees?: number;
}

export interface AdminCategory { id: number; name: string; is_active: boolean; created_at?: string; }
export interface EventStats { total_events: number; published_events: number; draft_events: number; upcoming_events: number; }

export interface AdminBooking {
  id: number;
  event_title: string;
  customer_name: string;
  customer_email: string;
  status: string;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private http: HttpClient) {}

  getStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${API_URL}/admin/stats`);
  }

  getUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(`${API_URL}/admin/users`);
  }

  getEvents(): Observable<AdminEvent[]> {
    return this.http.get<AdminEvent[]>(`${API_URL}/admin/events`);
  }

  createEvent(event: Omit<AdminEvent, 'id' | 'organizer_name'>): Observable<AdminEvent> {
    return this.http.post<AdminEvent>(`${API_URL}/admin/events`, event);
  }

  updateEvent(id: number, event: Partial<AdminEvent>): Observable<AdminEvent> { return this.http.put<AdminEvent>(`${API_URL}/admin/events/${id}`, event); }
  getEventStats(): Observable<EventStats> { return this.http.get<EventStats>(`${API_URL}/admin/event-stats`); }
  setEventStatus(id: number, status: string): Observable<AdminEvent> { return this.http.patch<AdminEvent>(`${API_URL}/admin/events/${id}/status`, { status }); }
  uploadEventImage(id: number, file: File): Observable<{ cover_image: string }> {
    const form = new FormData(); form.append('image', file); return this.http.post<{ cover_image: string }>(`${API_URL}/admin/events/${id}/image`, form);
  }
  getEventCategories(): Observable<AdminCategory[]> { return this.http.get<AdminCategory[]>(`${API_URL}/admin/event-categories`); }
  createEventCategory(category: Partial<AdminCategory>): Observable<AdminCategory> { return this.http.post<AdminCategory>(`${API_URL}/admin/event-categories`, category); }
  updateEventCategory(id: number, category: Partial<AdminCategory>): Observable<AdminCategory> { return this.http.put<AdminCategory>(`${API_URL}/admin/event-categories/${id}`, category); }
  deleteEventCategory(id: number): Observable<void> { return this.http.delete<void>(`${API_URL}/admin/event-categories/${id}`); }
  getServiceCategories(): Observable<AdminCategory[]> { return this.http.get<AdminCategory[]>(`${API_URL}/admin/service-categories`); }
  createServiceCategory(category: Partial<AdminCategory>): Observable<AdminCategory> { return this.http.post<AdminCategory>(`${API_URL}/admin/service-categories`, category); }
  updateServiceCategory(id: number, category: Partial<AdminCategory>): Observable<AdminCategory> { return this.http.put<AdminCategory>(`${API_URL}/admin/service-categories/${id}`, category); }
  deleteServiceCategory(id: number): Observable<void> { return this.http.delete<void>(`${API_URL}/admin/service-categories/${id}`); }

  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/admin/events/${id}`);
  }

  getBookings(): Observable<AdminBooking[]> {
    return this.http.get<AdminBooking[]>(`${API_URL}/admin/bookings`);
  }

  updateBooking(id: number, status: string): Observable<AdminBooking> {
    return this.http.put<AdminBooking>(`${API_URL}/admin/bookings/${id}`, { status });
  }
}
