import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CheckoutService, Order } from '../../services/checkout.service';

@Component({
  selector: 'app-provider-bookings',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="page"><header><a routerLink="/services" class="brand">EventPlanner</a><a routerLink="/vendor/services">List a service</a></header><p class="eyebrow">PROVIDER WORKSPACE</p><h1>Service bookings</h1><p class="muted">Only customer requirements and booking details related to your services are shown.</p><p class="error" *ngIf="error">{{ error }}</p><section class="list"><article *ngFor="let order of orders"><div><p class="eyebrow">{{ order.reference }}</p><h2>{{ order.event_date }} · {{ order.event_location }}</h2><p>{{ order.customer_name }} · {{ order.items.length }} service(s)</p><div *ngFor="let item of order.items" class="item"><strong>{{ item.service_name }}</strong><span>{{ item.requirements || 'No additional requirements' }}</span></div></div><div class="actions"><span class="badge">{{ order.status }}</span><button *ngIf="order.status==='confirmed' || order.status==='paid'" (click)="update(order,'in_progress')">Start</button><button *ngIf="order.status==='in_progress'" (click)="update(order,'completed')">Mark completed</button></div></article></section></main>
  `,
  styles: [`.page{min-height:100vh;background:#f8f5f0;color:#26332e;padding:30px 7%;box-sizing:border-box}.brand{font:700 1.4rem Georgia;color:#253b35}.page header{display:flex;justify-content:space-between;margin-bottom:60px}.page header a{color:#35584c}.eyebrow{color:#b47742;font-size:.72rem;font-weight:800;letter-spacing:.13em}.page h1{font:2.5rem Georgia;margin:8px 0}.muted{color:#777}.list{display:grid;gap:15px;margin-top:30px}.list article{background:#fff;border:1px solid #e8dfd5;border-radius:14px;padding:22px;display:flex;justify-content:space-between;gap:20px}.list h2{font:1.3rem Georgia}.item{margin-top:12px;padding:10px;background:#f8f5f0;border-radius:7px}.item span{display:block;color:#777;font-size:.85rem;margin-top:5px}.actions{display:grid;align-content:start;justify-items:end;gap:10px}.badge{background:#e2f1e7;color:#287344;padding:7px 10px;border-radius:20px;font-size:.8rem}.actions button{background:#c88d55;color:#fff;border:0;border-radius:7px;padding:10px;cursor:pointer}.error{color:#a53d33}@media(max-width:650px){.list article{display:grid}.actions{justify-items:start}}`]
})
export class ProviderBookingsComponent implements OnInit {
  orders: Order[] = []; error = '';
  constructor(private checkout: CheckoutService) {}
  ngOnInit(): void { this.checkout.getProviderOrders().subscribe({ next: orders => this.orders = orders, error: e => this.error = e.error?.detail || 'Unable to load provider bookings.' }); }
  update(order: Order, status: string): void { this.checkout.updateProviderOrder(order.id, status).subscribe({ next: updated => order.status = updated.status, error: e => this.error = e.error?.detail || 'Unable to update booking.' }); }
}
