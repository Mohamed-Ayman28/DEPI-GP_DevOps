import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, AdminStats } from '../../services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="heading"><div><p class="eyebrow">OVERVIEW</p><h1>Dashboard</h1><p class="muted">A quick view of your platform activity.</p></div></div>
    <p class="error" *ngIf="error">{{ error }}</p>
    <div class="cards" *ngIf="stats; else loading">
      <article><span>Total users</span><strong>{{ stats.total_users }}</strong><small>Registered accounts</small></article>
      <article><span>Total events</span><strong>{{ stats.total_events }}</strong><small>Created on platform</small></article>
      <article><span>Vendors</span><strong>{{ stats.total_vendors }}</strong><small>Active service providers</small></article>
    </div>
    <ng-template #loading><p class="muted">Loading dashboard metrics...</p></ng-template>
  `,
  styles: [`.heading h1 { margin: 0; font-size: 2rem; } .eyebrow { color: #b47742; font-size: .75rem; font-weight: 800; letter-spacing: .12em; } .muted, small { color: #77706a; } .cards { display: grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap: 18px; margin-top: 32px; } article { padding: 24px; background: #fff; border: 1px solid #e4dfd8; border-radius: 12px; } article span, article small { display: block; } article strong { display: block; margin: 12px 0 6px; font-size: 2.2rem; color: #35584c; } .error { color: #ad4b42; }`]
})
export class AdminDashboardComponent implements OnInit {
  stats: AdminStats | null = null;
  error = '';
  constructor(private admin: AdminService) {}
  ngOnInit(): void { this.admin.getStats().subscribe({ next: stats => this.stats = stats, error: () => this.error = 'Could not load dashboard metrics.' }); }
}
