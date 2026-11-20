import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Cart, CheckoutService } from '../../services/checkout.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CurrencyPipe],
  template: `
    <main class="page">
      <header><a routerLink="/services" class="brand">EventPlanner</a><a routerLink="/cart">← Cart</a></header>
      <section class="intro"><p class="eyebrow">SECURE CHECKOUT</p><h1>Confirm your booking.</h1>
        <p>Configured event details are read-only and cannot be changed at checkout.</p></section>
      <p class="error" *ngIf="error">{{ error }}</p>
      <form *ngIf="cart.items.length" (ngSubmit)="submit()" #form="ngForm" class="layout">
        <section class="panel">
          <h2>{{ graduation ? 'Graduation tickets' : 'Your information' }}</h2>
          <div class="grid">
            <label>Full name<input [(ngModel)]="data.customer_name" name="name" required minlength="2"></label>
            <label>Email address<input [(ngModel)]="data.customer_email" name="email" type="email" required></label>
            <label>Phone number<input [(ngModel)]="data.phone_number" name="phone" required></label>
            <ng-container *ngIf="graduation">
              <label>Faculty<input [(ngModel)]="data.faculty" name="faculty" required></label>
              <label>Department<input [(ngModel)]="data.department" name="department" required></label>
              <label>Ticket quantity<select [(ngModel)]="ticketQuantity" name="ticketQuantity" (ngModelChange)="syncHolders()" required>
                <option [ngValue]="1">1 ticket</option><option [ngValue]="2">2 tickets</option><option [ngValue]="3">3 tickets</option>
              </select></label>
              <label class="wide" *ngFor="let holder of data.ticket_holders; let i = index">
                Ticket {{ i + 1 }} holder full name
                <input [(ngModel)]="data.ticket_holders[i]" [name]="'holder'+i" [readonly]="i === 0" required>
              </label>
            </ng-container>
          </div>
          <h2>Payment method</h2>
          <label class="choice"><input type="radio" [(ngModel)]="data.payment_method" name="payment" value="cash" required> Cash <small>Pending until an admin confirms receipt.</small></label>
          <label class="choice"><input type="radio" [(ngModel)]="data.payment_method" name="payment" value="instapay" required> InstaPay <small>Pending verification after payment review.</small></label>
          <button class="button" type="submit" [disabled]="form.invalid || submitting">{{ submitting ? 'Creating booking...' : 'Confirm booking' }}</button>
        </section>
        <aside class="summary"><p class="eyebrow">READ-ONLY BOOKING SUMMARY</p>
          <article *ngFor="let item of cart.items" class="booking"><strong>{{ item.name }}</strong>
            <span>{{ item.package_name || (graduation ? 'Graduation event' : 'Configured package') }}</span>
            <span *ngIf="item.location">Location: {{ item.location }}</span>
            <span *ngIf="item.event_date">Date: {{ item.event_date }}<ng-container *ngIf="item.event_time"> at {{ item.event_time }}</ng-container></span>
            <span *ngIf="item.guest_count">Guests: {{ item.guest_count }}</span>
            <span *ngIf="item.event_theme">Theme: {{ item.event_theme }}</span>
            <span *ngIf="item.included_services">Included services: {{ item.included_services }}</span>
            <span *ngIf="item.decorations">Decorations: {{ item.decorations }}</span>
            <span *ngIf="item.additional_facilities">Additional facilities: {{ item.additional_facilities }}</span>
            <span *ngIf="graduation">Tickets: {{ ticketQuantity }}</span>
            <span *ngIf="!graduation && item.special_instructions">Notes: {{ item.special_instructions }}</span>
          </article>
          <hr>
          <div *ngIf="graduation"><span>Ticket price</span><strong>{{ unitTotal | currency:'USD' }}</strong></div>
          <div class="total"><span>Total</span><strong>{{ total | currency:'USD' }}</strong></div>
        </aside>
      </form>
      <section class="panel empty" *ngIf="!cart.items.length"><p>Your cart is empty.</p><a routerLink="/services">Browse services</a></section>
    </main>
  `,
  styles: [`.page{min-height:100vh;background:#f8f5f0;color:#26332e;padding:28px 7%;box-sizing:border-box}header{display:flex;justify-content:space-between}header a{color:#35584c;text-decoration:none}.brand{font:700 1.4rem Georgia}.intro{margin:55px 0 30px}.eyebrow{color:#b47742;font-size:.72rem;font-weight:800;letter-spacing:.13em}.intro h1{font:2.7rem Georgia;margin:8px 0}.layout{display:grid;grid-template-columns:1fr 330px;gap:25px}.panel,.summary{background:#fff;border:1px solid #e8dfd5;border-radius:14px;padding:26px}.panel h2{font:1.5rem Georgia;margin-top:0;margin-bottom:20px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px}label{display:grid;gap:7px;font-size:.85rem;font-weight:700}.wide{grid-column:1/-1}input,select{font:inherit;padding:11px;border:1px solid #d5dbe5;border-radius:7px;box-sizing:border-box;width:100%}.choice{display:flex;align-items:center;gap:8px;margin:16px 0}.choice input{width:auto}.choice small{font-weight:400;color:#667085}.button{padding:13px 18px;border:0;border-radius:8px;background:#c88d55;color:#fff;font-weight:700;cursor:pointer;margin-top:16px}.booking{display:grid;gap:7px;padding:15px 0;border-bottom:1px solid #eee}.booking span{color:#667085;font-size:.9rem}.summary>div{display:flex;justify-content:space-between;margin:14px 0}.summary .total{font-size:1.15rem}.error{color:#a53d33;margin-bottom:15px}.empty{max-width:500px}@media(max-width:800px){.layout{grid-template-columns:1fr}.grid{grid-template-columns:1fr}.wide{grid-column:auto}}`]
})
export class CheckoutComponent implements OnInit {
  cart: Cart = { id: 0, items: [], subtotal: 0, count: 0 };
  graduation = false;
  ticketQuantity = 1;
  submitting = false;
  error = '';
  data = {
    customer_name: '', customer_email: '', phone_number: '', faculty: '', department: '',
    ticket_holders: [] as string[], payment_method: 'cash'
  };

  constructor(private checkout: CheckoutService, private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    const user = this.auth.getCurrentUser();
    if (user) {
      this.data.customer_name = user.name;
      this.data.customer_email = user.email;
    }
    this.checkout.getCart().subscribe({
      next: cart => {
        this.cart = cart;
        this.graduation = cart.items.length === 1 &&
          !!cart.items[0].event_id &&
          this.categoryKey(cart.items[0].category_name) === 'graduation';
        this.syncHolders();
      },
      error: e => this.error = e.error?.detail || 'Unable to load your cart.'
    });
  }

  private categoryKey(value?: string): string {
    const key = (value || '').toLowerCase().replace(/[^a-z]/g, '');
    return key === 'graduations' ? 'graduation' : key;
  }

  get unitTotal(): number { return this.cart.subtotal; }
  get total(): number { return this.graduation ? (this.cart.items[0]?.unit_price || 0) * this.ticketQuantity : this.cart.subtotal; }

  syncHolders(): void {
    if (!this.graduation) return;
    const holders = Array.from({ length: this.ticketQuantity }, (_, index) =>
      index === 0 ? this.data.customer_name : (this.data.ticket_holders[index] || ''));
    this.data.ticket_holders = holders;
  }

  submit(): void {
    if (this.graduation) this.syncHolders();
    this.submitting = true;
    this.error = '';
    const item = this.cart.items[0];
    this.checkout.createOrder({
      items: this.graduation
        ? [{ event_id: item.event_id, quantity: this.ticketQuantity }]
        : this.cart.items.map(value => ({
            service_id: value.service_id, package_id: value.package_id, quantity: value.quantity
          })),
      ...this.data,
      ticket_quantity: this.graduation ? this.ticketQuantity : undefined,
      idempotency_key: crypto.randomUUID()
    }).subscribe({
      next: order => this.router.navigate(['/orders', order.id]),
      error: e => { this.error = e.error?.detail || 'Unable to create your booking.'; this.submitting = false; }
    });
  }
}
