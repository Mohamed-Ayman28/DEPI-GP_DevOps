import { Routes } from '@angular/router';
import { LoginSignupComponent } from './components/login-signup/login-signup.component';
import { MarketplaceComponent } from './components/marketplace/marketplace.component';
import { ServiceDetailsComponent } from './components/service-details/service-details.component';
import { VendorServicesComponent } from './components/vendor-services/vendor-services.component';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { adminGuard } from './guards/admin.guard';
import { HomeComponent } from './components/home/home.component';
import { AdminLoginComponent } from './components/admin/admin-login.component';
import { AdminLayoutComponent } from './components/admin/admin-layout.component';
import { AdminDashboardComponent } from './components/admin/admin-dashboard.component';
import { AdminPageComponent } from './components/admin/admin-page.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'signin', component: LoginSignupComponent, data: { mode: 'login' } },
  { path: 'signup', component: LoginSignupComponent, data: { mode: 'signup' } },
  { path: 'dashboard', redirectTo: 'services', pathMatch: 'full' },
  { path: 'services', component: MarketplaceComponent, canActivate: [authGuard, roleGuard], data: { roles: ['customer', 'vendor'] } },
  { path: 'services/:id', component: ServiceDetailsComponent, canActivate: [authGuard, roleGuard], data: { roles: ['customer', 'vendor'] } },
  {
    path: 'vendor/services',
    component: VendorServicesComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['vendor', 'admin'] }
  },
  { path: 'admin', component: AdminLoginComponent, pathMatch: 'full' },
  { path: 'admin/login', component: AdminLoginComponent, pathMatch: 'full' },
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [adminGuard],
    children: [
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'users', component: AdminPageComponent, data: { title: 'Users', description: 'Review registered accounts and their access roles.' } },
      { path: 'events', component: AdminPageComponent, data: { title: 'Events', description: 'Create and manage published platform events.' } },
      { path: 'bookings', component: AdminPageComponent, data: { title: 'Bookings', description: 'Review and update customer booking requests.' } },
      { path: 'settings', component: AdminPageComponent, data: { title: 'Settings', description: 'Manage platform configuration and operational controls.' } },
      { path: 'profile', component: AdminPageComponent, data: { title: 'Profile', description: 'Review your administrator account information.' } },
      { path: 'notifications', component: AdminPageComponent, data: { title: 'Notifications', description: 'Review important platform notifications.' } },
      { path: 'reports', component: AdminPageComponent, data: { title: 'Reports', description: 'Review platform performance and analytics.' } },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: '' }
];
