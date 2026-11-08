import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { API_URL } from '../app.config';

export type UserRole = 'customer' | 'vendor' | 'admin';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
  phone_number: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AdminLoginData {
  username: string;
  password: string;
}

interface AuthResponse {
  message: string;
  token: string;
  user: AuthUser;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly tokenKey = 'token';
  private readonly userKey = 'auth_user';
  private readonly userSubject = new BehaviorSubject<AuthUser | null>(null);
  readonly user$ = this.userSubject.asObservable();

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    this.userSubject.next(this.readUser());
  }

  signup(data: SignupData): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_URL}/signup`, data).pipe(
      tap(response => this.storeSession(response))
    );
  }

  login(data: LoginData): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_URL}/login`, data).pipe(
      tap(response => this.storeSession(response))
    );
  }

  adminLogin(data: AdminLoginData): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_URL}/admin/login`, data).pipe(
      tap(response => this.storeSession(response))
    );
  }

  logout(): void {
    if (this.isBrowser()) {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.userKey);
    }
    this.userSubject.next(null);
  }

  getToken(): string | null {
    return this.isBrowser() ? localStorage.getItem(this.tokenKey) : null;
  }

  getCurrentUser(): AuthUser | null {
    return this.userSubject.value;
  }

  hasRole(roles: UserRole[]): boolean {
    const user = this.getCurrentUser();
    return user !== null && roles.includes(user.role);
  }

  verifyAdminSession(): Observable<boolean> {
    if (!this.isAuthenticated()) {
      return of(false);
    }

    return this.http.get<AuthUser>(`${API_URL}/admin/me`).pipe(
      tap(user => {
        if (user.role === 'admin' && this.isBrowser()) {
          localStorage.setItem(this.userKey, JSON.stringify(user));
          this.userSubject.next(user);
        }
      }),
      map(user => user.role === 'admin'),
      catchError(() => {
        this.logout();
        return of(false);
      })
    );
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    const payload = this.decodeToken(token);
    if (!payload?.exp || payload.exp * 1000 <= Date.now()) {
      this.logout();
      return false;
    }
    return true;
  }

  private storeSession(response: AuthResponse): void {
    if (!response.token || !response.user) {
      throw new Error('Authentication response is missing session data');
    }
    if (this.isBrowser()) {
      localStorage.setItem(this.tokenKey, response.token);
      localStorage.setItem(this.userKey, JSON.stringify(response.user));
    }
    this.userSubject.next(response.user);
  }

  private readUser(): AuthUser | null {
    if (!this.isBrowser()) {
      return null;
    }
    const stored = localStorage.getItem(this.userKey);
    if (!stored) {
      return null;
    }
    try {
      return JSON.parse(stored) as AuthUser;
    } catch {
      localStorage.removeItem(this.userKey);
      return null;
    }
  }

  private decodeToken(token: string): { exp?: number } | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) {
        return null;
      }
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(normalized)) as { exp?: number };
    } catch {
      return null;
    }
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}