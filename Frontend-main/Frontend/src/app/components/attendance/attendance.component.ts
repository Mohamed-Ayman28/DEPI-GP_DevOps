import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { EventService } from '../../services/event.service';
import { Attendee } from '../../models/event.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './attendance.component.html',
  styleUrls: ['./attendance.component.css']
})
export class AttendanceComponent implements OnInit {
  eventId: number | null = null;
  attendees: Attendee[] = [];
  filteredAttendees: Attendee[] = [];

  constructor(private route: ActivatedRoute, private eventService: EventService, private router: Router) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.eventId = id ? parseInt(id, 10) : null;
    if (!this.eventId) { this.router.navigate(['/dashboard']); return; }
    this.loadAttendees();
  }

  loadAttendees(): void {
    if (!this.eventId) return;
    this.eventService.getAttendees(this.eventId).subscribe({
      next: (list) => {
        this.attendees = list;
        // Filter out "Not Going" attendees - only show "Going" and "Maybe"
        this.filteredAttendees = list.filter(a => a.status !== 'Not Going');
      },
      error: (err) => { console.error(err); alert('Failed to load attendees'); }
    });
  }

  navigateBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
