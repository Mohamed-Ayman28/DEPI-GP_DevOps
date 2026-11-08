import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Event, CreateEventDto, Attendee } from '../models/event.model';
import { API_URL } from '../app.config';

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private apiUrl = `${API_URL}/events`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  createEvent(event: CreateEventDto): Observable<Event> {
    // FastAPI requires trailing slash for POST /events/
    const url = this.apiUrl.endsWith('/') ? this.apiUrl : `${this.apiUrl}/`;
    return this.http.post<Event>(url, event, { headers: this.getHeaders() });
  }

  getMyOrganizedEvents(): Observable<Event[]> {
    return this.http.get<Event[]>(`${this.apiUrl}/organized`, { headers: this.getHeaders() });
  }

  getMyInvitedEvents(): Observable<Event[]> {
    return this.http.get<Event[]>(`${this.apiUrl}/invited`, { headers: this.getHeaders() });
  }

  getPublishedEvents(): Observable<Event[]> {
    return this.http.get<Event[]>(`${API_URL}/search/events/published`, { headers: this.getHeaders() });
  }

  getEventById(id: number): Observable<Event> {
    return this.http.get<Event>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }

  updateEvent(id: number, event: CreateEventDto): Observable<Event> {
    return this.http.put<Event>(`${this.apiUrl}/${id}`, event, { headers: this.getHeaders() });
  }

  deleteEvent(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }

  // ✅ NEW METHOD (Required by your component)
  inviteUserToEvent(eventId: number, email: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/${eventId}/invite`,
      { email },
      { headers: this.getHeaders() }
    );
  }

  // Set the attendance status for the current user for an event
  rsvp(eventId: number, status: 'Going' | 'Maybe' | 'Not Going'): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/${eventId}/attendance`,
      { status },
      { headers: this.getHeaders() }
    );
  }

  // Get list of attendees and their statuses for an event (organizer view)
  getAttendees(eventId: number): Observable<Attendee[]> {
    return this.http.get<Attendee[]>(`${this.apiUrl}/${eventId}/attendees`, { headers: this.getHeaders() });
  }

  // Advanced search for events with filters
  searchEvents(keyword?: string, date?: string, role?: string): Observable<any> {
    let params: any = {};
    
    if (keyword) {
      params.q = keyword;
    }
    if (date) {
      params.date = date;
    }
    if (role) {
      params.role = role;
    }

    return this.http.get(`${API_URL}/search/events`, { 
      params: params,
      headers: this.getHeaders() 
    });
  }
}
