import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CheckoutService, Order } from '../../services/checkout.service';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe],
  template: `
    <main class="page"><header><a routerLink="/services" class="brand">EventPlanner</a><nav><a routerLink="/services">Browse services</a><a routerLink="/cart">Cart</a></nav></header><section class="intro"><p class="eyebrow">YOUR EVENT JOURNEY</p><h1>My bookings</h1><p>Every detail, from first request to final celebration.</p></section>
    <p class="error" *ngIf="error">{{ error }}</p><section class="empty" *ngIf="!loading && !orders.length"><h2>No bookings yet</h2><p>Your next celebration starts with the right service.</p><a class="button" routerLink="/services">Explore services</a></section>
    <section class="orders" *ngIf="orders.length"><article *ngFor="let order of orders"><div><p class="eyebrow">{{ order.reference }}</p><h2>{{ order.items[0]?.service_name || 'Event service' }}<span *ngIf="order.items.length > 1"> +{{ order.items.length - 1 }} more</span></h2><p>{{ order.event_date }} · {{ order.event_location }}</p></div><div class="status"><span [class]="'badge '+order.status">{{ order.status.replace('_',' ') }}</span><strong>{{ order.total | currency:'USD' }}</strong><a [routerLink]="['/orders', order.id]">View details →</a></div></article></section>
  `,
  styles: [`.page{min-height:100vh;background:#f8f5f0;color:#26332e;padding:28px 7%;box-sizing:border-box}header{display:flex;justify-content:space-between}header a{color:#35584c;text-decoration:none;margin-left:20px}.brand{font:700 1.4rem Georgia}.intro{margin:65px 0 30px}.eyebrow{color:#b47742;font-size:.72rem;font-weight:800;letter-spacing:.13em}.intro h1{font:2.7rem Georgia;margin:8px 0}.orders{display:grid;gap:14px}.orders article,.empty{background:#fff;border:1px solid #e8dfd5;border-radius:14px;padding:24px;display:flex;justify-content:space-between;gap:20px}.orders h2{font:1.35rem Georgia;margin:7px 0}.orders p:not(.eyebrow){color:#777}.status{display:grid;justify-items:end;gap:9px}.status strong{font-size:1.15rem}.status a{color:#35584c}.badge{padding:7px 10px;border-radius:20px;background:#eee7de;color:#716b65;text-transform:capitalize;font-size:.8rem}.badge.paid,.badge.confirmed,.badge.completed{background:#e2f1e7;color:#287344}.badge.cancelled,.badge.refunded{background:#fae3e0;color:#9e3f36}.empty{display:block;text-align:center;max-width:500px;margin:auto}.button{display:inline-block;background:#c88d55;color:#fff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:700}.error{color:#a53d33}@media(max-width:650px){.orders article{display:grid}.status{justify-items:start}}`]
})
export class OrdersComponent implements OnInit {
  orders: Order[] = []; loading = true; error = '';
  constructor(private checkout: CheckoutService) {}
  ngOnInit(): void { this.checkout.getOrders().subscribe({ next: orders => { this.orders = orders; this.loading = false; }, error: e => { this.error = e.error?.detail || 'Unable to load bookings.'; this.loading = false; } }); }
}
