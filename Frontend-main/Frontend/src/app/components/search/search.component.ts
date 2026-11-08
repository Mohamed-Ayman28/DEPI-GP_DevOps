import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { EventService } from '../../services/event.service';
import { AuthService } from '../../services/auth.service';
import { Event } from '../../models/event.model';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css']
})
export class SearchComponent implements OnInit {
  // Search filters
  searchKeyword: string = '';
  searchDate: string = '';
  searchRole: string = '';

  // Search results
  searchResults: Event[] = [];
  isSearching: boolean = false;
  hasSearched: boolean = false;
  errorMessage: string = '';

  constructor(
    private eventService: EventService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.checkAuth();
  }

  checkAuth(): void {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      this.router.navigate(['/']);
    }
  }

  performSearch(): void {
    // At least one filter must be provided
    if (!this.searchKeyword && !this.searchDate && !this.searchRole) {
      alert('Please provide at least one search filter');
      return;
    }

    this.isSearching = true;
    this.errorMessage = '';
    this.searchResults = [];

    this.eventService.searchEvents(
      this.searchKeyword || undefined,
      this.searchDate || undefined,
      this.searchRole || undefined
    ).subscribe({
      next: (response: any) => {
        this.searchResults = response.results || [];
        this.hasSearched = true;
        this.isSearching = false;
        console.log('Search results:', this.searchResults);
      },
      error: (err) => {
        console.error('Error searching events:', err);
        this.errorMessage = 'Failed to search events. Please try again.';
        this.isSearching = false;
        this.hasSearched = true;
        if (err.status === 401) {
          alert('Session expired. Please login again.');
          this.logout();
        }
      }
    });
  }

  clearSearch(): void {
    this.searchKeyword = '';
    this.searchDate = '';
    this.searchRole = '';
    this.searchResults = [];
    this.hasSearched = false;
    this.errorMessage = '';
  }

  backToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/'], { replaceUrl: true });
  }
}
