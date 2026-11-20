import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CheckoutService } from '../../services/checkout.service';
import { EventService } from '../../services/event.service';
import { Event as PlatformEvent } from '../../models/event.model';
import { mediaUrl } from '../../utils/media-url';

export interface CategoryOption {
  id: number;
  name: string;
}

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './marketplace.component.html',
  styleUrls: ['./marketplace.component.css']
})
export class MarketplaceComponent implements OnInit {
  categories: CategoryOption[] = [];
  keyword = '';
  categoryId: number | undefined;
  minPrice: number | undefined;
  maxPrice: number | undefined;

  // Published events state (from Admin)
  allEvents: PlatformEvent[] = [];
  publishedEvents: PlatformEvent[] = [];
  eventsLoading = false;
  selectedEvent: PlatformEvent | null = null;
  showEventModal = false;

  // Toast feedback state
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  private toastTimer?: ReturnType<typeof setTimeout>;

  get cart$() { return this.checkout.cart$; }

  constructor(
    private checkout: CheckoutService,
    private eventService: EventService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.checkout.getCart().subscribe();
    this.loadPublishedEvents();
  }

  loadPublishedEvents(): void {
    this.eventsLoading = true;
    this.eventService.getPublishedEvents().subscribe({
      next: events => {
        this.allEvents = events;
        // Collect unique categories from published events
        const catMap = new Map<number, string>();
        events.forEach(e => {
          if (e.category_id && e.category_name) {
            catMap.set(e.category_id, e.category_name);
          }
        });
        this.categories = Array.from(catMap.entries()).map(([id, name]) => ({ id, name }));
        this.applyEventFilters();
        this.eventsLoading = false;
      },
      error: () => {
        this.eventsLoading = false;
      }
    });
  }

  search(): void {
    this.applyEventFilters();
  }

  applyEventFilters(): void {
    const q = this.keyword.trim().toLowerCase();
    this.publishedEvents = this.allEvents.filter(event => {
      const matchesKeyword = !q ||
        (event.title?.toLowerCase().includes(q) ||
         event.description?.toLowerCase().includes(q) ||
         event.location?.toLowerCase().includes(q) ||
         event.category_name?.toLowerCase().includes(q) ||
         (event.tags && event.tags.toLowerCase().includes(q)));

      const matchesCategory = !this.categoryId || event.category_id === this.categoryId;

      const price = event.ticket_price || 0;
      const matchesMinPrice = this.minPrice === undefined || price >= this.minPrice;
      const matchesMaxPrice = this.maxPrice === undefined || price <= this.maxPrice;

      return matchesKeyword && matchesCategory && matchesMinPrice && matchesMaxPrice;
    });
  }

  clearFilters(): void {
    this.keyword = '';
    this.categoryId = undefined;
    this.minPrice = undefined;
    this.maxPrice = undefined;
    this.applyEventFilters();
  }

  trackByEventId(_: number, event: PlatformEvent): number | undefined {
    return event.id;
  }

  mediaUrl(path?: string): string {
    return mediaUrl(path);
  }

  // ── Event Modal ────────────────────────────────────────
  openEventDetails(event: PlatformEvent, domEvent?: any): void {
    domEvent?.stopPropagation();
    this.selectedEvent = event;
    this.showEventModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeEventModal(): void {
    this.showEventModal = false;
    this.selectedEvent = null;
    document.body.style.overflow = '';
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.showEventModal) this.closeEventModal();
  }

  onEventBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closeEventModal();
    }
  }

  viewCart(): void {
    this.closeEventModal();
    this.router.navigate(['/cart']);
  }

  bookEvent(event: PlatformEvent): void {
    if (!event.id) return;
    this.checkout.addEventToCart(event.id).subscribe({
      next: () => {
        this.showToast(`${event.title} added to your cart.`);
        this.closeEventModal();
        this.router.navigate(['/cart']);
      },
      error: err => this.showToast(
        err.error?.detail || 'Unable to add this event to the cart.',
        'error'
      )
    });
  }

  // ── Toast ──────────────────────────────────────────────
  showToast(message: string, type: 'success' | 'error' = 'success'): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage = message;
    this.toastType = type;
    this.toastTimer = setTimeout(() => { this.toastMessage = ''; }, 4000);
  }

  dismissToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage = '';
  }
}
