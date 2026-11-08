import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CatalogService } from '../../services/catalog.service';
import { CreateCatalogService, ServiceCategory } from '../../models/catalog.model';

@Component({
  selector: 'app-vendor-services',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './vendor-services.component.html',
  styleUrls: ['./vendor-services.component.css']
})
export class VendorServicesComponent {
  categories: ServiceCategory[] = [];
  message = '';
  errorMessage = '';
  service: CreateCatalogService = {
    category_id: 0,
    name: '',
    description: '',
    base_price: 0,
    currency: 'USD',
    location: ''
  };

  constructor(private catalog: CatalogService) {
    this.catalog.getCategories().subscribe({
      next: categories => this.categories = categories,
      error: () => this.errorMessage = 'Categories are unavailable right now.'
    });
  }

  submit(): void {
    this.message = '';
    this.errorMessage = '';
    if (!this.service.category_id || !this.service.name || !this.service.description ||
        !this.service.location || this.service.base_price <= 0) {
      this.errorMessage = 'Complete every field and enter a price greater than zero.';
      return;
    }
    this.catalog.createService(this.service).subscribe({
      next: () => {
        this.message = 'Your service was submitted as a draft for approval.';
        this.service = { category_id: 0, name: '', description: '', base_price: 0, currency: 'USD', location: '' };
      },
      error: error => this.errorMessage = error.status === 401 || error.status === 403
        ? 'Sign in with a vendor account to list a service.'
        : 'Unable to submit your service. Please try again.'
    });
  }
}
