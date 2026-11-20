import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogService } from '../../services/catalog.service';
import { CatalogService as CatalogListing } from '../../models/catalog.model';
import { CheckoutService } from '../../services/checkout.service';
import { AuthService } from '../../services/auth.service';
import { mediaUrl } from '../../utils/media-url';

@Component({
  selector: 'app-service-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './service-details.component.html',
  styleUrls: ['./service-details.component.css']
})
export class ServiceDetailsComponent implements OnInit {
  service?: CatalogListing;
  loading = true;
  errorMessage = '';
  bookingOpen = false;
  submitting = false;
  bookingSuccess = '';
  booking = {
    name: '',
    email: '',
    phone: '',
    eventDate: '',
    eventLocation: '',
    guestCount: undefined as number | undefined,
    requirements: ''
  };
  get canBook(): boolean {
    return this.auth.hasRole(['customer']);
  }

  mediaUrl(path?: string): string {
    return mediaUrl(path);
  }

  constructor(
    private route: ActivatedRoute,
    private catalog: CatalogService,
    private checkout: CheckoutService,
    private auth: AuthService,
    private router: Router
  ) {}

  addToCart(packageId?: number): void {
    if (!this.service?.id) return;
    this.checkout.addToCart(this.service.id, packageId).subscribe({
      next: () => this.router.navigate(['/cart']),
      error: err => this.errorMessage = err.error?.detail || 'Unable to add this service.'
    });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.errorMessage = 'This service could not be found.';
      this.loading = false;
      return;
    }
    this.catalog.getService(id).subscribe({
      next: service => {
        this.service = service;
        const user = this.auth.getCurrentUser();
        this.booking.name = user?.name || '';
        this.booking.email = user?.email || '';
        this.bookingOpen = this.route.snapshot.queryParamMap.get('book') === 'true';
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'This service is unavailable or has not been published.';
        this.loading = false;
      }
    });
  }

  openBooking(): void {
    this.bookingOpen = true;
    this.bookingSuccess = '';
  }

  submitBooking(): void {
    if (!this.service?.id || !this.booking.eventDate || !this.booking.eventLocation ||
        !this.booking.name || !this.booking.email || !this.booking.phone) {
      this.errorMessage = 'Complete your contact and event details before confirming.';
      return;
    }
    this.submitting = true;
    this.errorMessage = '';
    this.checkout.createOrder({
      items: [{
        service_id: this.service.id,
        quantity: 1,
        requirements: this.booking.requirements,
        service_date: this.booking.eventDate
      }],
      customer_name: this.booking.name,
      customer_email: this.booking.email,
      phone_number: this.booking.phone,
      billing_address: this.booking.eventLocation,
      event_date: this.booking.eventDate,
      event_location: this.booking.eventLocation,
      guest_count: this.booking.guestCount,
      special_instructions: this.booking.requirements,
      payment_method: 'cash',
      sandbox_result: 'success',
      idempotency_key: `direct-${this.service.id}-${crypto.randomUUID()}`
    }).subscribe({
      next: order => {
        this.bookingSuccess = `Booking request ${order.reference} was created successfully.`;
        this.submitting = false;
        this.router.navigate(['/orders', order.id]);
      },
      error: err => {
        this.errorMessage = err.error?.detail || 'This service could not be booked. Please try again.';
        this.submitting = false;
      }
    });
  }
}
