import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AdminBooking, AdminCategory, AdminEvent, AdminService, AdminStats, AdminUser, EventStats } from '../../services/admin.service';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <p class="eyebrow">ADMINISTRATION</p><h1>{{ title }}</h1><p class="muted">{{ description }}</p>
    <p *ngIf="error" class="error">{{ error }}</p>

    <section class="panel" *ngIf="title === 'Users'">
      <p *ngIf="loading" class="muted">Loading users...</p>
      <table *ngIf="users.length"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th></tr></thead>
        <tbody><tr *ngFor="let user of users"><td>{{ user.name }}</td><td>{{ user.email }}</td><td>{{ user.phone_number }}</td><td><span class="badge">{{ user.role }}</span></td></tr></tbody></table>
    </section>

    <ng-container *ngIf="title === 'Events'">
      <section class="stat-grid"><article *ngFor="let stat of statCards"><span>{{ stat.label }}</span><strong>{{ stat.value }}</strong></article></section>
      <section class="panel">
        <div class="section-heading"><div><h2>{{ editingId ? 'Edit event' : 'Create event' }}</h2><p class="muted">Manage event details, publishing, and registration settings.</p></div><button *ngIf="editingId" class="secondary" type="button" (click)="resetForm()">Cancel edit</button></div>
        <form class="event-form" (ngSubmit)="saveEvent()">
          <label>Title<input [(ngModel)]="form.title" name="title" required maxlength="255"></label>
          <label>Category<select [(ngModel)]="form.category_id" name="category_id"><option [ngValue]="undefined">Select category</option><option *ngFor="let category of eventCategories" [ngValue]="category.id">{{ category.name }}</option></select></label>
          <label>Date<input [(ngModel)]="form.date" name="date" type="date" required></label>
          <label>Time<input [(ngModel)]="form.time" name="time" type="time" required></label>
          <label>Location<input [(ngModel)]="form.location" name="location" required></label>
          <label>Event type<select [(ngModel)]="form.event_type" name="event_type"><option>Public</option><option>Private</option></select></label>
          <label>Ticket price<input [(ngModel)]="form.ticket_price" name="ticket_price" type="number" min="0" step="0.01"></label>
          <label>Maximum attendees<input [(ngModel)]="form.max_attendees" name="max_attendees" type="number" min="1"></label>
          <label>Registration deadline<input [(ngModel)]="form.registration_deadline" name="registration_deadline" type="date"></label>
          <label>Duration<input [(ngModel)]="form.duration" name="duration" placeholder="e.g. 3 hours"></label>
          <label>Status<select [(ngModel)]="form.status" name="status"><option>Draft</option><option>Published</option><option>Cancelled</option></select></label>
          <label class="wide">Description<textarea [(ngModel)]="form.description" name="description" rows="3"></textarea></label>
          <label class="wide">Tags<input [(ngModel)]="form.tags" name="tags" placeholder="music, outdoor, family"></label>
          <label class="upload wide">Cover image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" (change)="selectImage($event)"><small *ngIf="selectedImage">{{ selectedImage.name }}</small></label>
          <label class="check"><input [(ngModel)]="form.featured" name="featured" type="checkbox"> Featured event</label>
          <div class="wide actions"><button type="submit" [disabled]="saving">{{ saving ? 'Saving...' : (editingId ? 'Save changes' : 'Create event') }}</button></div>
        </form>
      </section>

      <section class="panel"><div class="section-heading"><div><h2>Event categories</h2><p class="muted">Add, rename, activate, or remove categories.</p></div></div>
        <div class="category-add"><input [(ngModel)]="newEventCategory" placeholder="New event category"><button type="button" (click)="addCategory('event')">Add category</button></div>
        <div class="category-list"><div *ngFor="let category of eventCategories"><input [(ngModel)]="category.name"><button type="button" (click)="toggleCategory(category, 'event')">{{ category.is_active ? 'Deactivate' : 'Activate' }}</button><button type="button" class="secondary" (click)="saveCategory(category, 'event')">Save</button><button type="button" class="danger" (click)="removeCategory(category, 'event')">Delete</button></div></div>
      </section>
      <section class="panel"><div class="section-heading"><div><h2>Service categories</h2><p class="muted">Manage services available to event planners.</p></div></div>
        <div class="category-add"><input [(ngModel)]="newServiceCategory" placeholder="New service category"><button type="button" (click)="addCategory('service')">Add category</button></div>
        <div class="category-list"><div *ngFor="let category of serviceCategories"><input [(ngModel)]="category.name"><button type="button" (click)="toggleCategory(category, 'service')">{{ category.is_active ? 'Deactivate' : 'Activate' }}</button><button type="button" class="secondary" (click)="saveCategory(category, 'service')">Save</button><button type="button" class="danger" (click)="removeCategory(category, 'service')">Delete</button></div></div>
      </section>
      <section class="panel"><div class="toolbar"><input [(ngModel)]="search" placeholder="Search events..." (ngModelChange)="applyFilters()"><select [(ngModel)]="statusFilter" (ngModelChange)="applyFilters()"><option value="">All statuses</option><option>Draft</option><option>Published</option><option>Cancelled</option></select><select [(ngModel)]="categoryFilter" (ngModelChange)="applyFilters()"><option value="">All categories</option><option *ngFor="let category of eventCategories" [value]="category.name">{{ category.name }}</option></select></div>
        <div class="table-wrap"><table *ngIf="filteredEvents.length; else noEvents"><thead><tr><th>Event</th><th>Category</th><th>Date</th><th>Location</th><th>Attendees</th><th>Status</th><th>Actions</th></tr></thead><tbody><tr *ngFor="let event of filteredEvents"><td class="event-cell"><img *ngIf="event.cover_image" [src]="event.cover_image"><span>{{ event.title }}<small *ngIf="event.featured">Featured</small></span></td><td>{{ event.category_name || 'Uncategorized' }}</td><td>{{ event.date }}<small>{{ event.time }}</small></td><td>{{ event.location }}</td><td>{{ event.attendees || 0 }}<span *ngIf="event.max_attendees"> / {{ event.max_attendees }}</span></td><td><span class="badge" [class.published]="event.status === 'Published'" [class.cancelled]="event.status === 'Cancelled'">{{ event.status }}</span></td><td class="row-actions"><button type="button" (click)="editEvent(event)">Edit</button><button type="button" (click)="publishEvent(event)">{{ event.status === 'Published' ? 'Unpublish' : 'Publish' }}</button><button type="button" class="danger" (click)="deleteEvent(event.id)">Delete</button></td></tr></tbody></table></div><ng-template #noEvents><p class="muted empty">No events match your filters.</p></ng-template>
      </section>
    </ng-container>

    <section class="panel" *ngIf="title === 'Bookings'"><table *ngIf="bookings.length"><thead><tr><th>Event</th><th>Customer</th><th>Email</th><th>Status</th><th></th></tr></thead><tbody><tr *ngFor="let booking of bookings"><td>{{ booking.event_title }}</td><td>{{ booking.customer_name }}</td><td>{{ booking.customer_email }}</td><td>{{ booking.status }}</td><td><button (click)="updateBooking(booking.id, 'Going')">Accept</button><button class="danger" (click)="updateBooking(booking.id, 'Not Going')">Reject</button></td></tr></tbody></table><p *ngIf="!bookings.length" class="muted">No booking requests yet.</p></section>
  `,
  styles: [`
    :host { display:block; } .eyebrow { color:#b47742; font-size:.75rem; font-weight:800; letter-spacing:.12em; } h1 { margin:0; font-size:2rem; } h2 { margin:0 0 4px; font-size:1.15rem; } .muted { color:#77706a; } .error { color:#ad4b42; }
    .panel { margin-top:22px; padding:22px; background:#fff; border:1px solid #eaecf0; border-radius:12px; overflow-x:auto; } .section-heading,.toolbar { display:flex; justify-content:space-between; align-items:center; gap:14px; margin-bottom:18px; } .toolbar { justify-content:flex-start; } .toolbar input { flex:1; min-width:220px; }
    .stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-top:24px; } .stat-grid article { padding:18px; border:1px solid #eaecf0; border-radius:12px; background:#fff; } .stat-grid span { color:#667085; font-size:.85rem; } .stat-grid strong { display:block; margin-top:8px; font-size:1.7rem; }
    table { width:100%; border-collapse:collapse; min-width:850px; } th,td { padding:13px 10px; border-bottom:1px solid #eaecf0; text-align:left; vertical-align:middle; } th { color:#667085; font-size:.75rem; text-transform:uppercase; } td small { display:block; color:#667085; margin-top:3px; } .event-cell { display:flex; align-items:center; gap:10px; font-weight:600; } .event-cell img { width:42px; height:42px; object-fit:cover; border-radius:7px; }
    .badge { padding:4px 9px; border-radius:999px; background:#f7eadb; color:#a66b35; font-size:.78rem; white-space:nowrap; } .badge.published { background:#e4f0e9; color:#35584c; } .badge.cancelled { background:#fbe8e6; color:#ad4b42; } .event-cell small { color:#b47742; } .row-actions { white-space:nowrap; } .row-actions button { margin:2px; }
    .event-form { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; } label { display:grid; gap:6px; color:#4b5751; font-size:.82rem; font-weight:600; } .wide { grid-column:1/-1; } input,select,textarea,button { padding:10px; border:1px solid #d8d1c9; border-radius:7px; font:inherit; box-sizing:border-box; } textarea { resize:vertical; } button { background:#c88d55; color:#fff; cursor:pointer; border:0; } button:disabled { opacity:.6; cursor:wait; } .secondary { background:#e8e2da; color:#4b5751; } .danger { background:#ad4b42; } .check { display:flex; align-items:center; grid-column:1/-1; } .check input { width:auto; } .category-add { display:flex; gap:8px; margin-bottom:12px; } .category-add input { flex:1; } .category-list { display:grid; gap:8px; } .category-list > div { display:flex; gap:8px; align-items:center; } .category-list input { flex:1; } .empty { padding:20px; text-align:center; }
    @media (max-width:800px) { .event-form,.stat-grid { grid-template-columns:1fr 1fr; } } @media (max-width:560px) { .event-form,.stat-grid { grid-template-columns:1fr; } .section-heading,.toolbar { align-items:stretch; flex-direction:column; } .category-list > div { flex-wrap:wrap; } .category-list input { flex-basis:100%; } }
  `]
})
export class AdminPageComponent implements OnInit {
  title = ''; description = ''; users: AdminUser[] = []; events: AdminEvent[] = []; filteredEvents: AdminEvent[] = []; bookings: AdminBooking[] = []; eventCategories: AdminCategory[] = []; serviceCategories: AdminCategory[] = [];
  loading = false; saving = false; error = ''; editingId: number | null = null; selectedImage: File | null = null; search = ''; statusFilter = ''; categoryFilter = ''; newEventCategory = ''; newServiceCategory = '';
  stats: EventStats = { total_events: 0, published_events: 0, draft_events: 0, upcoming_events: 0 };
  form: Partial<AdminEvent> = this.emptyEvent();
  get statCards() { return [{ label: 'Total events', value: this.stats.total_events }, { label: 'Published', value: this.stats.published_events }, { label: 'Drafts', value: this.stats.draft_events }, { label: 'Upcoming', value: this.stats.upcoming_events }]; }
  constructor(private route: ActivatedRoute, private admin: AdminService) {}
  ngOnInit(): void { this.title = this.route.snapshot.data['title']; this.description = this.route.snapshot.data['description']; if (this.title === 'Events') this.loadEvents(); else if (this.title === 'Users') this.admin.getUsers().subscribe(v => this.users = v); else this.admin.getBookings().subscribe(v => this.bookings = v); }
  emptyEvent(): Partial<AdminEvent> { return { title:'', description:'', date:'', time:'', location:'', event_type:'Public', ticket_price:0, status:'Draft', featured:false, tags:'' }; }
  loadEvents(): void { this.loading = true; this.admin.getEvents().subscribe({ next: v => { this.events=v; this.applyFilters(); this.loading=false; }, error: () => { this.error='Could not load events.'; this.loading=false; } }); this.admin.getEventStats().subscribe(v => this.stats=v); this.admin.getEventCategories().subscribe(v => this.eventCategories=v); this.admin.getServiceCategories().subscribe(v => this.serviceCategories=v); }
  applyFilters(): void { const q=this.search.toLowerCase(); this.filteredEvents=this.events.filter(e => (!q || `${e.title} ${e.location} ${e.category_name}`.toLowerCase().includes(q)) && (!this.statusFilter || e.status===this.statusFilter) && (!this.categoryFilter || e.category_name===this.categoryFilter)); }
  selectImage(event: Event): void { const input=event.target as HTMLInputElement; this.selectedImage=input.files?.[0] || null; }
  saveEvent(): void { this.saving=true; const request=this.editingId ? this.admin.updateEvent(this.editingId,this.form) : this.admin.createEvent(this.form as Omit<AdminEvent,'id'|'organizer_name'>); request.subscribe({ next: event => { const finish=()=>{ this.events=this.editingId ? this.events.map(e=>e.id===event.id?event:e) : [...this.events,event]; this.resetForm(); this.applyFilters(); this.admin.getEventStats().subscribe(v=>this.stats=v); }; if(this.selectedImage) this.admin.uploadEventImage(event.id,this.selectedImage).subscribe({next:image=>finish(),error:()=>{this.error='Event saved, but image upload failed.'; finish();}}); else finish(); }, error: err=>{this.error=err.error?.detail || 'Could not save event.'; this.saving=false;} }); }
  editEvent(event: AdminEvent): void { this.editingId=event.id; this.form={...event}; this.selectedImage=null; window.scrollTo({top:0,behavior:'smooth'}); }
  resetForm(): void { this.editingId=null; this.form=this.emptyEvent(); this.selectedImage=null; this.saving=false; }
  publishEvent(event: AdminEvent): void { const status=event.status==='Published'?'Draft':'Published'; this.admin.setEventStatus(event.id,status).subscribe({next:v=>{this.events=this.events.map(e=>e.id===v.id?v:e);this.applyFilters();this.admin.getEventStats().subscribe(s=>this.stats=s);},error:()=>this.error='Could not update event status.'}); }
  deleteEvent(id:number): void { if(!confirm('Delete this event?')) return; this.admin.deleteEvent(id).subscribe({next:()=>{this.events=this.events.filter(e=>e.id!==id);this.applyFilters();this.admin.getEventStats().subscribe(s=>this.stats=s);},error:()=>this.error='Could not delete event.'}); }
  addCategory(type:'event'|'service'): void { const name=type==='event'?this.newEventCategory.trim():this.newServiceCategory.trim(); if(!name)return; const call=type==='event'?this.admin.createEventCategory({name}):this.admin.createServiceCategory({name}); call.subscribe({next:c=>{(type==='event'?this.eventCategories:this.serviceCategories).push(c);if(type==='event')this.newEventCategory='';else this.newServiceCategory='';},error:()=>this.error='Could not add category.'}); }
  toggleCategory(c:AdminCategory,type:'event'|'service'):void { this.saveCategory({...c,is_active:!c.is_active},type); }
  saveCategory(c:AdminCategory,type:'event'|'service'):void { const call=type==='event'?this.admin.updateEventCategory(c.id,c):this.admin.updateServiceCategory(c.id,c);call.subscribe({next:v=>{const list=type==='event'?this.eventCategories:this.serviceCategories;const i=list.findIndex(x=>x.id===v.id);if(i>=0)list[i]=v;},error:()=>this.error='Could not update category.'}); }
  removeCategory(c:AdminCategory,type:'event'|'service'):void { if(!confirm(`Delete ${c.name}?`))return;const call=type==='event'?this.admin.deleteEventCategory(c.id):this.admin.deleteServiceCategory(c.id);call.subscribe({next:()=>{const list=type==='event'?this.eventCategories:this.serviceCategories; if(type==='event')this.eventCategories=list.filter(x=>x.id!==c.id);else this.serviceCategories=list.filter(x=>x.id!==c.id);},error:()=>this.error='Could not delete category.'}); }
  updateBooking(id:number,status:string):void { this.admin.updateBooking(id,status).subscribe({next:()=>this.bookings=this.bookings.map(b=>b.id===id?{...b,status}:b),error:()=>this.error='Could not update booking.'}); }
}
