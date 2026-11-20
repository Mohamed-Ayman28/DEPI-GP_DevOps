import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CheckoutService, Cart, CartItem } from '../../services/checkout.service';
import { mediaUrl } from '../../utils/media-url';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe],
  template: `
    <main class="page"><header><a routerLink="/services" class="brand">EventPlanner</a><a routerLink="/services">Continue shopping</a></header>
    <section class="intro"><p class="eyebrow">YOUR CELEBRATION PLAN</p><h1>Shopping cart</h1><p>Review services before creating your booking.</p></section>
    <p class="message error" *ngIf="error">{{ error }}</p>
    <section class="empty" *ngIf="!loading && !cart.items.length"><h2>Your cart is ready for inspiration</h2><p>Add trusted event services to start planning.</p><a class="button" routerLink="/services">Browse services</a></section>
    <div class="layout" *ngIf="cart.items.length">
      <section class="items"><article class="item" *ngFor="let item of cart.items">
        <div class="image" [class.has-image]="item.image_url" [style.background-image]="item.image_url ? 'url(' + mediaUrl(item.image_url) + ')' : null">{{ item.image_url ? '' : (item.package_name || (item.event_id ? 'EVENT' : 'SERVICE')) }}</div><div class="copy"><p class="eyebrow">{{ item.provider_name || 'Verified provider' }}</p><h2>{{ item.name }}</h2><p>{{ item.description }}</p><small>{{ item.location }}</small></div>
        <div class="controls"><strong>{{ item.unit_price | currency:item.currency }}</strong><label>Qty <input type="number" min="1" max="50" [value]="item.quantity" (change)="changeQuantity(item, $event)"></label><button class="link danger" (click)="remove(item)">Remove</button></div>
      </article><button class="link" (click)="clear()">Clear cart</button></section>
      <aside class="summary"><p class="eyebrow">ORDER SUMMARY</p><div><span>Subtotal</span><strong>{{ cart.subtotal | currency:'USD' }}</strong></div><div><span>Service fee</span><span>Calculated at checkout</span></div><hr><div class="total"><span>Estimated total</span><strong>{{ cart.subtotal | currency:'USD' }}</strong></div><a class="button" routerLink="/checkout">Proceed to checkout</a></aside>
    </div>
  `,
  styles: [`.page{min-height:100vh;background:#f8f5f0;color:#26332e;padding:28px 7%;box-sizing:border-box}header{display:flex;justify-content:space-between;align-items:center}header a{color:#35584c;text-decoration:none}.brand{font:700 1.4rem Georgia;color:#253b35}.intro{margin:70px 0 32px}.eyebrow{color:#b47742;font-size:.72rem;font-weight:800;letter-spacing:.13em}.intro h1{font:2.7rem Georgia;margin:8px 0}.layout{display:grid;grid-template-columns:1fr 330px;gap:28px;align-items:start}.item,.summary,.empty{background:#fff;border:1px solid #e8dfd5;border-radius:14px;box-shadow:0 8px 24px #26332e0d}.item{display:grid;grid-template-columns:130px 1fr auto;gap:20px;padding:18px;margin-bottom:14px;align-items:center}.image{height:110px;border-radius:10px;background:linear-gradient(135deg,#35584c,#c88d55);display:grid;place-items:center;color:#fff;font-size:.7rem;font-weight:800;text-align:center;padding:8px}.copy h2{margin:5px 0;font:1.35rem Georgia}.copy p:not(.eyebrow){color:#667085;margin:8px 0}.controls{display:grid;gap:10px;justify-items:end}.controls strong{font-size:1.1rem}.controls label{font-size:.85rem}.controls input{width:55px;padding:7px}.link{border:0;background:none;color:#35584c;cursor:pointer;padding:7px}.danger{color:#a53d33}.summary{padding:24px}.summary>div{display:flex;justify-content:space-between;margin:16px 0;color:#667085}.summary .total{color:#26332e;font-size:1.1rem}.button{display:block;background:#c88d55;color:#fff;text-align:center;text-decoration:none;border:0;border-radius:8px;padding:13px;font-weight:700;cursor:pointer}.empty{padding:60px;text-align:center;max-width:560px;margin:0 auto}.empty h2{font:1.8rem Georgia}.message{padding:12px}.error{color:#a53d33}@media(max-width:800px){.layout{grid-template-columns:1fr}.item{grid-template-columns:90px 1fr}.controls{grid-column:2;justify-items:start}.image{height:85px}}`]
})
export class CartComponent implements OnInit {
  cart: Cart = { id: 0, items: [], subtotal: 0, count: 0 };
  loading = true;
  error = '';
  constructor(private checkout: CheckoutService) {}
  mediaUrl(path?: string): string { return mediaUrl(path); }
  ngOnInit(): void { this.checkout.getCart().subscribe({ next: c => { this.cart = c; this.loading = false; }, error: e => { this.error = e.error?.detail || 'Unable to load your cart.'; this.loading = false; } }); }
  changeQuantity(item: CartItem, event: Event): void { const quantity = Number((event.target as HTMLInputElement).value); if (quantity < 1) return; this.checkout.updateItem(item, quantity).subscribe(c => this.cart = c); }
  remove(item: CartItem): void { this.checkout.removeItem(item).subscribe(c => this.cart = c); }
  clear(): void { this.checkout.clearCart().subscribe(c => this.cart = c); }
}
