// dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { EventService } from '../../services/event.service';
import { AuthService } from '../../services/auth.service';
import { Event, CreateEventDto, Attendee } from '../../models/event.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  currentView: 'organized' | 'invited' | 'create' = 'organized';
  organizedEvents: Event[] = [];
  invitedEvents: Event[] = [];
  editingEventId: number | null = null;

  // Create Event Model
  newEvent: CreateEventDto = {
    title: '',
    description: '',
    date: '',
    time: '',
    location: ''
  };

  // Invite Modal State
  // Invite panel state (organized section)
  inviteSelectedEventId: number | null = null;
  inviteEmail: string = '';
  // Attendance/Attendees state
  attendees: Attendee[] = [];
  showAttendeesModal: boolean = false;

  constructor(
    private eventService: EventService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.checkAuth();
    this.loadOrganizedEvents();
  }

  checkAuth(): void {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      this.router.navigate(['/']);
    }
  }

  loadOrganizedEvents(): void {
    this.eventService.getMyOrganizedEvents().subscribe({
      next: (events) => {
        this.organizedEvents = events;
        console.log('Organized events loaded:', events);
      },
      error: (err) => {
        console.error('Error loading organized events:', err);
        if (err.status === 401) {
          alert('Session expired. Please login again.');
          this.logout();
        }
      }
    });
  }

  loadInvitedEvents(): void {
    this.eventService.getMyInvitedEvents().subscribe({
      next: (events) => {
        this.invitedEvents = events;
        console.log('Invited events loaded:', events);
      },
      error: (err) => {
        console.error('Error loading invited events:', err);
        if (err.status === 401) {
          alert('Session expired. Please login again.');
          this.logout();
        }
      }
    });
  }

  createEvent(): void {
    if (!this.newEvent.title || !this.newEvent.description || !this.newEvent.date ||
        !this.newEvent.time || !this.newEvent.location) {
      alert('Please fill in all fields');
      return;
    }

    const request = this.editingEventId
      ? this.eventService.updateEvent(this.editingEventId, this.newEvent)
      : this.eventService.createEvent(this.newEvent);

    request.subscribe({
      next: (event) => {
        const action = this.editingEventId ? 'updated' : 'created';
        console.log(`Event ${action}:`, event);
        alert(`Event ${action} successfully! ✅`);
        this.resetForm();
        this.currentView = 'organized';
        this.loadOrganizedEvents();
      },
      error: (err) => {
        console.error('Error creating event:', err);
        alert(`Error: ${err.error?.detail || err.message}`);
      }
    });
  }

  editEvent(event: Event): void {
    if (!event.id) return;
    this.editingEventId = event.id;
    this.newEvent = {
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.time,
      location: event.location
    };
    this.currentView = 'create';
  }

  deleteEvent(eventId: number): void {
    if (!confirm('Are you sure you want to delete this event?')) return;

    this.eventService.deleteEvent(eventId).subscribe({
      next: () => {
        alert('Event deleted successfully! ✅');
        this.loadOrganizedEvents();
      },
      error: (err) => {
        console.error('Error deleting event:', err);
        alert('Failed to delete event');
      }
    });
  }

  resetForm(): void {
    this.editingEventId = null;
    this.newEvent = {
      title: '',
      description: '',
      date: '',
      time: '',
      location: ''
    };
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/'], { replaceUrl: true });
  }

  /** -------------------------
   *   INVITATION FEATURE
   *  ------------------------- */
  // Invite using the organized-events invite panel
  openInvitePanelForEvent(eventId: number | undefined): void {
    if (!eventId) return;
    this.inviteSelectedEventId = eventId;
    // scroll to the invite form
    setTimeout(() => {
      const el = document.getElementById('invite-panel');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = document.getElementById('inviteEmailInput') as HTMLInputElement | null;
      if (input) input.focus();
    }, 50);
  }

  sendInvitationToSelectedEvent(): void {
    if (!this.inviteEmail || !this.inviteSelectedEventId) {
      alert('Please select an event and enter an email');
      return;
    }
    this.eventService.inviteUserToEvent(this.inviteSelectedEventId, this.inviteEmail).subscribe({
      next: () => {
        alert('Invitation sent successfully! ✅');
        this.inviteEmail = '';
        this.inviteSelectedEventId = null;
      },
      error: (err) => {
        console.error('Error sending invitation:', err);
        alert('Failed to send invitation: ' + (err.error?.detail || err.message));
      }
    });
  }

  // RSVP for current user
  rsvp(eventId: number | undefined, status: 'Going' | 'Maybe' | 'Not Going'): void {
    if (!eventId) return;
    this.eventService.rsvp(eventId, status).subscribe({
      next: () => {
        alert(`Your response '${status}' was recorded.`);
        // refresh invited events to reflect any changes if backend returns updated data
        this.loadInvitedEvents();
      },
      error: (err) => {
        console.error('Error sending RSVP:', err);
        alert('Failed to send RSVP');
      }
    });
  }

  // Navigate to attendance page (separate page) for organizer to view details
  viewAttendance(eventId: number | undefined): void {
    if (!eventId) return;
    this.router.navigate(['/attendance', eventId]);
  }
}
