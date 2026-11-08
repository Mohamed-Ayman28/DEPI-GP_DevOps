import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CatalogService } from '../../services/catalog.service';
import { CatalogService as CatalogListing } from '../../models/catalog.model';

@Component({
  selector: 'app-service-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './service-details.component.html',
  styleUrls: ['./service-details.component.css']
})
export class ServiceDetailsComponent implements OnInit {
  service?: CatalogListing;
  loading = true;
  errorMessage = '';

  constructor(private route: ActivatedRoute, private catalog: CatalogService) {}

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
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'This service is unavailable or has not been published.';
        this.loading = false;
      }
    });
  }
}
