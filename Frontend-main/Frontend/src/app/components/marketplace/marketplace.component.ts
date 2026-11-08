import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CatalogService } from '../../services/catalog.service';
import { CatalogService as CatalogListing, ServiceCategory } from '../../models/catalog.model';
import { EventService } from '../../services/event.service';
import { Event } from '../../models/event.model';

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './marketplace.component.html',
  styleUrls: ['./marketplace.component.css']
})
export class MarketplaceComponent implements OnInit {
  services: CatalogListing[] = [];
  categories: ServiceCategory[] = [];
  keyword = '';
  categoryId: number | undefined;
  minPrice: number | undefined;
  maxPrice: number | undefined;
  loading = false;
  errorMessage = '';
  publishedEvents: Event[] = [];
  eventsLoading = false;

  constructor(private catalog: CatalogService, private eventService: EventService) {}

  ngOnInit(): void {
    this.catalog.getCategories().subscribe({
      next: categories => this.categories = categories,
      error: () => this.errorMessage = 'Categories are temporarily unavailable.'
    });
    this.search();
    this.loadPublishedEvents();
  }

  private loadPublishedEvents(): void {
    this.eventsLoading = true;
    this.eventService.getPublishedEvents().subscribe({
      next: events => { this.publishedEvents = events; this.eventsLoading = false; },
      error: () => { this.eventsLoading = false; }
    });
  }

  search(): void {
    this.loading = true;
    this.errorMessage = '';
    this.catalog.searchServices({
      q: this.keyword.trim() || undefined,
      categoryId: this.categoryId,
      minPrice: this.minPrice,
      maxPrice: this.maxPrice
    }).subscribe({
      next: response => {
        this.services = response.results;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load services. Please try again.';
        this.loading = false;
      }
    });
  }

  clearFilters(): void {
    this.keyword = '';
    this.categoryId = undefined;
    this.minPrice = undefined;
    this.maxPrice = undefined;
    this.search();
  }
}
