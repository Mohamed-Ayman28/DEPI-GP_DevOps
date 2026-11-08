import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="admin-login">
      <section class="login-card">
        <div class="brand-mark">EP</div>
        <p class="eyebrow">EVENTPLANNER ADMIN</p>
        <h1>Welcome back</h1>
        <p class="muted">Sign in to manage your EventPlanner workspace.</p>
        <form (ngSubmit)="login()">
          <label for="username">Admin username</label>
          <input id="username" type="text" [(ngModel)]="username" name="username" required autocomplete="username">
          <label for="password">Password</label>
          <div class="password-field">
            <input id="password" [type]="showPassword ? 'text' : 'password'" [(ngModel)]="password" name="password" required autocomplete="current-password">
            <button type="button" (click)="showPassword = !showPassword" [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'">
              {{ showPassword ? 'Hide' : 'Show' }}
            </button>
          </div>
          <label class="remember"><input type="checkbox" [(ngModel)]="rememberMe" name="rememberMe"> Remember me</label>
          <p class="error" *ngIf="error">{{ error }}</p>
          <button class="submit" type="submit" [disabled]="loading">{{ loading ? 'Signing in...' : 'Sign in to admin' }}</button>
        </form>
        <a class="user-link" routerLink="/signin">Return to user sign in</a>
      </section>
    </main>
  `,
  styles: [`
    .admin-login { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: linear-gradient(120deg,#253b35,#35584c 58%,#d8a46d); color: #26332e; }
    .login-card { width: min(100%, 430px); padding: 40px; background: #fff; border: 1px solid #e4dfd8; border-radius: 16px; box-shadow: 0 18px 45px rgba(37,59,53,.18); }
    .brand-mark { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 12px; background: #c88d55; color: #fff; font-weight: 800; }
    .eyebrow { margin: 24px 0 8px; color: #b47742; font-size: .75rem; font-weight: 800; letter-spacing: .14em; }
    h1 { margin: 0; font-size: 2rem; } .muted { color: #667085; }
    form { display: grid; gap: 9px; margin-top: 28px; } label { font-weight: 600; font-size: .9rem; }
    input { width: 100%; box-sizing: border-box; padding: 12px 13px; border: 1px solid #d5dbe5; border-radius: 8px; font: inherit; margin-bottom: 10px; }
    .password-field { position: relative; } .password-field input { padding-right: 60px; }
    .password-field button { position: absolute; right: 8px; top: 8px; border: 0; background: transparent; color: #b47742; cursor: pointer; }
    .remember { display: flex; align-items: center; gap: 8px; color: #667085; font-weight: 400; } .remember input { width: auto; margin: 0; }
    .submit { margin-top: 10px; padding: 13px; border: 0; border-radius: 8px; background: #c88d55; color: #fff; font-weight: 700; cursor: pointer; }
    .submit:disabled { opacity: .65; cursor: wait; } .error { color: #c62828; font-size: .9rem; }
    .user-link { display: block; margin-top: 24px; color: #35584c; text-align: center; text-decoration: none; font-size: .9rem; }
  `]
})
export class AdminLoginComponent {
  username = '';
  password = '';
  rememberMe = false;
  showPassword = false;
  loading = false;
  error = '';

  constructor(private auth: AuthService, private router: Router) {}

  login(): void {
    this.error = '';
    this.loading = true;
    this.auth.adminLogin({ username: this.username, password: this.password }).subscribe({
      next: () => this.router.navigate(['/admin/dashboard']),
      error: err => {
        this.error = err.error?.detail || 'Unable to sign in with these credentials.';
        this.loading = false;
      }
    });
  }
}
