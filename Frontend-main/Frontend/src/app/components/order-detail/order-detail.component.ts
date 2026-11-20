import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CheckoutService, Order } from '../../services/checkout.service';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, RouterLink],
  template: `
    <main class="page"><header><a routerLink="/services" class="brand">EventPlanner</a><a routerLink="/orders">← My bookings</a></header><p *ngIf="error" class="error">{{ error }}</p><section *ngIf="order" class="card"><div class="success">✓</div><p class="eyebrow">BOOKING CONFIRMATION</p><h1>{{ order.payment_status === 'failed' ? 'Payment needs attention' : 'Your celebration is on its way' }}</h1><p class="ref">{{ order.reference }}</p><div class="details"><div><span>Booking status</span><strong>{{ order.status }}</strong></div><div><span>Payment</span><strong>{{ order.payment_status }} · {{ order.payment_method }}</strong></div><div><span>Event date</span><strong>{{ order.event_date }} · {{ order.event_location }}</strong></div><div><span>Customer</span><strong>{{ order.customer_name }} · {{ order.customer_email }}</strong></div></div><h2>Selected services</h2><div class="line" *ngFor="let item of order.items"><div><strong>{{ item.service_name }}</strong><small>{{ item.provider_name || 'Provider' }} · Qty {{ item.quantity }}</small></div><strong>{{ item.line_total | currency:'USD' }}</strong></div><div class="total"><span>Total</span><strong>{{ order.total | currency:'USD' }}</strong></div><button (click)="print()">Print receipt</button><button (click)="downloadReceipt()">Download PDF</button><a routerLink="/orders">Back to bookings</a><button class="cancel" *ngIf="order.status !== 'cancelled' && order.status !== 'completed'" (click)="cancel()">Cancel booking</button></section></main>
  `,
  styles: [`.page{min-height:100vh;background:#f8f5f0;color:#26332e;padding:28px 7%;box-sizing:border-box}header{display:flex;justify-content:space-between;margin-bottom:55px}header a{color:#35584c;text-decoration:none}.brand{font:700 1.4rem Georgia}.card{background:#fff;border:1px solid #e8dfd5;border-radius:16px;max-width:780px;margin:auto;padding:38px;box-shadow:0 12px 32px #26332e0d}.success{width:45px;height:45px;border-radius:50%;background:#e2f1e7;color:#287344;display:grid;place-items:center;font-size:1.5rem}.eyebrow{color:#b47742;font-size:.72rem;font-weight:800;letter-spacing:.13em;margin-top:22px}.card h1{font:2.3rem Georgia;margin:8px 0}.ref{color:#777}.details{display:grid;grid-template-columns:1fr 1fr;gap:16px;background:#f8f5f0;padding:18px;border-radius:10px;margin:28px 0}.details span,.line small{display:block;color:#777;font-size:.8rem}.details strong{display:block;margin-top:6px}.line{display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:14px 0}.total{display:flex;justify-content:space-between;font-size:1.2rem;padding:20px 0}.card button,.card a{display:inline-block;margin:8px 8px 0 0;padding:11px 15px;border:0;border-radius:7px;background:#c88d55;color:#fff;text-decoration:none;cursor:pointer}.card a{background:#35584c}.card .cancel{background:#fff;color:#a53d33;border:1px solid #d5aaa4}.error{color:#a53d33}@media(max-width:600px){.details{grid-template-columns:1fr}.card{padding:24px}}`]
})
export class OrderDetailComponent implements OnInit {
  order?: Order; error = '';
  constructor(private route: ActivatedRoute, private checkout: CheckoutService) {}
  ngOnInit(): void { const id = Number(this.route.snapshot.paramMap.get('id')); this.checkout.getOrder(id).subscribe({ next: order => this.order = order, error: e => this.error = e.error?.detail || 'Booking not found.' }); }
  print(): void { window.print(); }
  downloadReceipt(): void {
    if (!this.order) return;
    this.checkout.downloadReceipt(this.order.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.order?.reference || 'booking'}-receipt.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.error = 'The receipt could not be downloaded.'
    });
  }
  cancel(): void { if (!this.order || !window.confirm('Cancel this booking?')) return; this.checkout.cancelOrder(this.order.id).subscribe({ next: order => this.order = order, error: e => this.error = e.error?.detail || 'Unable to cancel booking.' }); }
}
