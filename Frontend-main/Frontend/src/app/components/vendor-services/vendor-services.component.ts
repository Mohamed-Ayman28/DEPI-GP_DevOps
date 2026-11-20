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
  selectedImages: File[] = [];
  imagePreviews: string[] = [];
  service: CreateCatalogService = {
    category_id: 0,
    name: '',
    description: '',
    base_price: 0,
    currency: 'USD',
    location: '',
    included_services: '',
    decorations: '',
    additional_facilities: '',
    event_theme: '',
    special_instructions: ''
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
      next: created => {
        if (!created.id || !this.selectedImages.length) {
          this.finishCreate();
          return;
        }
        this.catalog.uploadServiceImages(created.id, this.selectedImages).subscribe({
          next: () => this.finishCreate(),
          error: () => {
            this.errorMessage = 'The service was created, but image upload failed. Please edit it again and retry.';
          }
        });
      },
      error: error => this.errorMessage = error.status === 401 || error.status === 403
        ? 'Sign in with a vendor account to list a service.'
        : 'Unable to submit your service. Please try again.'
    });
  }

  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []).filter(file =>
      ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)
    );
    this.selectedImages = files.slice(0, 10);
    this.imagePreviews.forEach(url => URL.revokeObjectURL(url));
    this.imagePreviews = this.selectedImages.map(file => URL.createObjectURL(file));
  }

  removeImage(index: number): void {
    URL.revokeObjectURL(this.imagePreviews[index]);
    this.selectedImages.splice(index, 1);
    this.imagePreviews.splice(index, 1);
  }

  private finishCreate(): void {
    this.message = 'Your service and images were submitted as a draft for approval.';
    this.imagePreviews.forEach(url => URL.revokeObjectURL(url));
    this.selectedImages = [];
    this.imagePreviews = [];
    this.service = { category_id: 0, name: '', description: '', base_price: 0, currency: 'USD', location: '', included_services: '', decorations: '', additional_facilities: '', event_theme: '', special_instructions: '' };
  }
}
