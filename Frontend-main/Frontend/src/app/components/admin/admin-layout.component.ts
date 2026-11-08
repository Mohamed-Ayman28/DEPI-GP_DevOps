import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin-shell">
      <aside class="sidebar">
        <div class="logo"><span>EP</span><strong>EventPlanner</strong></div>
        <p class="section-label">Workspace</p>
        <nav>
          <a routerLink="/admin/dashboard" routerLinkActive="active">Overview</a>
          <a routerLink="/admin/users" routerLinkActive="active">Users</a>
          <a routerLink="/admin/events" routerLinkActive="active">Events</a>
          <a routerLink="/admin/bookings" routerLinkActive="active">Bookings</a>
          <a routerLink="/admin/reports" routerLinkActive="active">Reports</a>
          <a routerLink="/admin/notifications" routerLinkActive="active">Notifications</a>
          <a routerLink="/admin/settings" routerLinkActive="active">Settings</a>
          <a routerLink="/admin/profile" routerLinkActive="active">My profile</a>
        </nav>
        <button class="logout" (click)="logout()">Sign out</button>
      </aside>
      <section class="admin-content">
        <header><span>Administration</span><span class="account">{{ auth.getCurrentUser()?.name || 'Administrator' }}</span></header>
        <main><router-outlet /></main>
      </section>
    </div>
  `,
  styles: [`
    .admin-shell { min-height: 100vh; display: flex; background: #f7f5f2; color: #26332e; }
    .sidebar { width: 235px; flex: 0 0 235px; display: flex; flex-direction: column; padding: 28px 18px; box-sizing: border-box; background: #253b35; color: #e8eee8; }
    .logo { display: flex; align-items: center; gap: 10px; color: #fff; font-size: 1.05rem; } .logo span { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; background: #c88d55; font-size: .8rem; }
    .section-label { margin: 46px 12px 12px; color: #b7c8bf; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; }
    nav { display: grid; gap: 4px; } nav a { padding: 11px 12px; border-radius: 7px; color: #c9d8d0; text-decoration: none; } nav a.active, nav a:hover { color: #fff; background: #35584c; }
    .logout { margin-top: auto; padding: 11px 12px; border: 1px solid #718c80; border-radius: 7px; color: #fff; background: transparent; cursor: pointer; text-align: left; }
    .admin-content { min-width: 0; flex: 1; } header { height: 72px; display: flex; justify-content: space-between; align-items: center; padding: 0 34px; box-sizing: border-box; background: #fff; border-bottom: 1px solid #e4dfd8; font-weight: 700; } .account { color: #77706a; font-size: .9rem; }
    main { padding: 34px; } @media (max-width: 700px) { .sidebar { width: 64px; flex-basis: 64px; padding: 18px 10px; } .logo strong, .section-label, nav a, .logout { font-size: 0; } nav a { height: 42px; } main { padding: 20px; } header { padding: 0 20px; } }
  `]
})
export class AdminLayoutComponent {
  constructor(public auth: AuthService, private router: Router) {}
  logout(): void { this.auth.logout(); this.router.navigate(['/admin/login'], { replaceUrl: true }); }
}
