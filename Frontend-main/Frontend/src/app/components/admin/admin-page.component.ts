import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AdminBooking, AdminCategory, AdminEvent, AdminNotification, AdminReports, AdminService, AdminSettings, AdminUser, EventStats } from '../../services/admin.service';
import { CheckoutService, Order } from '../../services/checkout.service';
import { mediaUrl } from '../../utils/media-url';

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
          <label class="upload wide">Event images<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple (change)="selectImages($event)"><small *ngIf="selectedImages.length">{{ selectedImages.length }} image(s) selected — first image is the cover</small></label>
          <div class="wide event-image-strip" *ngIf="eventImagePreviews.length">
            <article *ngFor="let preview of eventImagePreviews; let i = index"><img [src]="preview" [alt]="'Event image ' + (i + 1)"><button type="button" (click)="removeSelectedImage(i)">×</button><small *ngIf="i === 0">Cover image</small></article>
          </div>
          <label class="check"><input [(ngModel)]="form.featured" name="featured" type="checkbox"> Featured event</label>
          <div class="wide actions"><button type="submit" [disabled]="saving">{{ saving ? 'Saving...' : (editingId ? 'Save changes' : 'Create event') }}</button></div>
        </form>
      </section>

      <section class="panel"><div class="section-heading"><div><h2>Event categories</h2><p class="muted">Add, rename, activate, or remove categories.</p></div></div>
        <div class="category-add"><input [(ngModel)]="newEventCategory" placeholder="New event category"><button type="button" (click)="addCategory('event')">Add category</button></div>
        <div class="category-list"><div *ngFor="let category of eventCategories"><input [(ngModel)]="category.name"><button type="button" (click)="toggleCategory(category, 'event')">{{ category.is_active ? 'Deactivate' : 'Activate' }}</button><button type="button" class="secondary" (click)="saveCategory(category, 'event')">Save</button><button type="button" class="danger" (click)="removeCategory(category, 'event')">Delete</button></div></div>
      </section>
      <section class="panel"><div class="toolbar"><input [(ngModel)]="search" placeholder="Search events..." (ngModelChange)="applyFilters()"><select [(ngModel)]="statusFilter" (ngModelChange)="applyFilters()"><option value="">All statuses</option><option>Draft</option><option>Published</option><option>Cancelled</option></select><select [(ngModel)]="categoryFilter" (ngModelChange)="applyFilters()"><option value="">All categories</option><option *ngFor="let category of eventCategories" [value]="category.name">{{ category.name }}</option></select></div>
        <div class="table-wrap"><table *ngIf="filteredEvents.length; else noEvents"><thead><tr><th>Event</th><th>Category</th><th>Date</th><th>Location</th><th>Attendees</th><th>Status</th><th>Actions</th></tr></thead><tbody><tr *ngFor="let event of filteredEvents"><td class="event-cell"><img *ngIf="event.cover_image" [src]="mediaUrl(event.cover_image)" [alt]="event.title"><span>{{ event.title }}<small *ngIf="event.featured">Featured</small></span></td><td>{{ event.category_name || 'Uncategorized' }}</td><td>{{ event.date }}<small>{{ event.time }}</small></td><td>{{ event.location }}</td><td>{{ event.attendees || 0 }}<span *ngIf="event.max_attendees"> / {{ event.max_attendees }}</span></td><td><span class="badge" [class.published]="event.status === 'Published'" [class.cancelled]="event.status === 'Cancelled'">{{ event.status }}</span></td><td class="row-actions"><button type="button" (click)="editEvent(event)">Edit</button><button type="button" (click)="publishEvent(event)">{{ event.status === 'Published' ? 'Unpublish' : 'Publish' }}</button><button type="button" class="danger" (click)="deleteEvent(event.id)">Delete</button></td></tr></tbody></table></div><ng-template #noEvents><p class="muted empty">No events match your filters.</p></ng-template>
      </section>
    </ng-container>

    <section class="panel" *ngIf="title === 'Bookings'"><div class="toolbar"><input [(ngModel)]="orderSearch" (ngModelChange)="loadOrders()" placeholder="Search reference, customer, or email"><select [(ngModel)]="orderStatus" (ngModelChange)="loadOrders()"><option value="">All booking statuses</option><option>awaiting_payment</option><option>paid</option><option>confirmed</option><option>in_progress</option><option>completed</option><option>cancelled</option></select><select [(ngModel)]="paymentStatus" (ngModelChange)="loadOrders()"><option value="">All payment statuses</option><option>pending</option><option>pending_verification</option><option>paid</option><option>failed</option><option>refunded</option></select></div><table *ngIf="orders.length"><thead><tr><th>Reference</th><th>Customer</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th><th>Update</th></tr></thead><tbody><tr *ngFor="let order of orders"><td>{{ order.reference }}</td><td>{{ order.customer_name }}<small>{{ order.customer_email }}</small></td><td>{{ order.event_date }}<small>{{ order.event_location }}</small></td><td>{{ order.total | currency:'USD' }}</td><td><span class="badge">{{ order.payment_method }} — {{ order.payment_status }}</span><select [value]="order.payment_status" (change)="updatePayment(order, $event)"><option *ngFor="let payment of paymentStatuses" [value]="payment">{{ payment }}</option></select></td><td><span class="badge">{{ order.status }}</span></td><td><select [value]="order.status" (change)="updateOrder(order, $event)"><option *ngFor="let status of orderStatuses" [value]="status">{{ status }}</option></select><button type="button" (click)="resendOrderEmail(order)">Resend email</button><button *ngIf="confirmingDeleteId !== order.id" type="button" class="danger" (click)="confirmingDeleteId = order.id">Cancel</button><ng-container *ngIf="confirmingDeleteId === order.id"><button type="button" class="danger" [disabled]="deletingId === order.id" (click)="deleteOrder(order)">{{ deletingId === order.id ? 'Deleting...' : 'Delete' }}</button><button type="button" class="secondary" (click)="confirmingDeleteId = null">Keep</button></ng-container></td></tr></tbody></table><p *ngIf="!orders.length" class="muted">No orders match your filters.</p></section>

    <section class="panel" *ngIf="title === 'Profile' && profile">
      <h2>Administrator profile</h2><div class="detail-grid"><div><span class="muted">Name</span><strong>{{ profile.name }}</strong></div><div><span class="muted">Email</span><strong>{{ profile.email }}</strong></div><div><span class="muted">Phone</span><strong>{{ profile.phone_number }}</strong></div><div><span class="muted">Role</span><strong>{{ profile.role }}</strong></div><div><span class="muted">Account created</span><strong>{{ profile.created_at | date:'medium' }}</strong></div></div>
    </section>

    <section class="panel" *ngIf="title === 'Settings' && settings">
      <h2>Platform settings</h2><p class="muted">Current operational settings returned by the administration service.</p>
      <div class="setting-row"><div><strong>Customer registration</strong><small>Allow new customer accounts to be created.</small></div><label class="switch"><input type="checkbox" [(ngModel)]="settings.registration_enabled"><span>{{ settings.registration_enabled ? 'Enabled' : 'Disabled' }}</span></label></div>
      <div class="setting-row"><div><strong>Maintenance mode</strong><small>Temporarily restrict normal platform activity.</small></div><label class="switch"><input type="checkbox" [(ngModel)]="settings.maintenance_mode"><span>{{ settings.maintenance_mode ? 'Enabled' : 'Disabled' }}</span></label></div>
      <button type="button" (click)="saveSettings()" [disabled]="saving">{{ saving ? 'Saving...' : 'Save settings' }}</button>
      <small class="muted" *ngIf="settings.updated_at">Last updated: {{ settings.updated_at | date:'medium' }}</small>
    </section>

    <section class="panel" *ngIf="title === 'Notifications'">
      <h2>Notifications</h2><p *ngIf="!notifications.length" class="muted">There are no notifications right now.</p>
      <div class="notification" *ngFor="let notification of notifications"><strong>{{ notification.title }}</strong><span class="badge">{{ notification.severity }}</span><p>{{ notification.message }}</p><small>{{ notification.created_at | date:'medium' }}</small><button *ngIf="!notification.is_read" type="button" class="secondary" (click)="markRead(notification)">Mark as read</button></div>
    </section>

    <section class="panel" *ngIf="title === 'Reports' && reports">
      <h2>Reports</h2><p class="muted">{{ reports.message }}</p><p *ngIf="!reports.items.length" class="muted">No report data is available for the selected period.</p>
      <table *ngIf="reports.items.length"><thead><tr><th *ngFor="let key of reportKeys">{{ key }}</th></tr></thead><tbody><tr *ngFor="let row of reports.items"><td *ngFor="let key of reportKeys">{{ row[key] }}</td></tr></tbody></table>
    </section>
  `,
  styles: [`
    :host { display:block; } .eyebrow { color:#b47742; font-size:.75rem; font-weight:800; letter-spacing:.12em; } h1 { margin:0; font-size:2rem; } h2 { margin:0 0 4px; font-size:1.15rem; } .muted { color:#77706a; } .error { color:#ad4b42; }
    .panel { margin-top:22px; padding:22px; background:#fff; border:1px solid #eaecf0; border-radius:12px; overflow-x:auto; } .section-heading,.toolbar { display:flex; justify-content:space-between; align-items:center; gap:14px; margin-bottom:18px; } .toolbar { justify-content:flex-start; } .toolbar input { flex:1; min-width:220px; } .detail-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:18px; margin-top:22px; } .detail-grid div { display:grid; gap:6px; } .setting-row { display:flex; justify-content:space-between; align-items:center; gap:20px; padding:16px 0; border-bottom:1px solid #eaecf0; } .setting-row small { display:block; color:#667085; margin-top:4px; } .switch { display:flex; align-items:center; gap:8px; } .switch input { width:auto; } .notification { padding:15px 0; border-bottom:1px solid #eaecf0; } .notification p { margin:7px 0; color:#667085; }
    .stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-top:24px; } .stat-grid article { padding:18px; border:1px solid #eaecf0; border-radius:12px; background:#fff; } .stat-grid span { color:#667085; font-size:.85rem; } .stat-grid strong { display:block; margin-top:8px; font-size:1.7rem; }
    table { width:100%; border-collapse:collapse; min-width:850px; } th,td { padding:13px 10px; border-bottom:1px solid #eaecf0; text-align:left; vertical-align:middle; } th { color:#667085; font-size:.75rem; text-transform:uppercase; } td small { display:block; color:#667085; margin-top:3px; } .event-cell { display:flex; align-items:center; gap:10px; font-weight:600; } .event-cell img { width:42px; height:42px; object-fit:cover; border-radius:7px; }
    .badge { padding:4px 9px; border-radius:999px; background:#f7eadb; color:#a66b35; font-size:.78rem; white-space:nowrap; } .badge.published { background:#e4f0e9; color:#35584c; } .badge.cancelled { background:#fbe8e6; color:#ad4b42; } .event-cell small { color:#b47742; } .row-actions { white-space:nowrap; } .row-actions button { margin:2px; }
    .event-form { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; } label { display:grid; gap:6px; color:#4b5751; font-size:.82rem; font-weight:600; } .wide { grid-column:1/-1; } input,select,textarea,button { padding:10px; border:1px solid #d8d1c9; border-radius:7px; font:inherit; box-sizing:border-box; } textarea { resize:vertical; } button { background:#c88d55; color:#fff; cursor:pointer; border:0; } button:disabled { opacity:.6; cursor:wait; } .secondary { background:#e8e2da; color:#4b5751; } .danger { background:#ad4b42; } .check { display:flex; align-items:center; grid-column:1/-1; } .check input { width:auto; } .category-add { display:flex; gap:8px; margin-bottom:12px; } .category-add input { flex:1; } .category-list { display:grid; gap:8px; } .category-list > div { display:flex; gap:8px; align-items:center; } .category-list input { flex:1; } .empty { padding:20px; text-align:center; }
    .event-image-strip { display:grid; grid-auto-flow:column; grid-auto-columns:minmax(170px,220px); gap:12px; overflow-x:auto; padding:8px 2px 12px; scroll-snap-type:x mandatory; } .event-image-strip article { height:150px; position:relative; border-radius:9px; overflow:hidden; background:#eee; scroll-snap-align:start; } .event-image-strip img { width:100%; height:100%; object-fit:cover; } .event-image-strip button { position:absolute; right:8px; top:8px; width:28px; height:28px; padding:0; border-radius:50%; background:#fff; color:#ad4b42; } .event-image-strip small { position:absolute; left:8px; bottom:8px; padding:5px 8px; border-radius:20px; background:#fff; color:#35584c; font-weight:800; }
    @media (max-width:800px) { .event-form,.stat-grid { grid-template-columns:1fr 1fr; } } @media (max-width:560px) { .event-form,.stat-grid { grid-template-columns:1fr; } .section-heading,.toolbar { align-items:stretch; flex-direction:column; } .category-list > div { flex-wrap:wrap; } .category-list input { flex-basis:100%; } }
  `]
})
export class AdminPageComponent implements OnInit {
  title = ''; description = ''; users: AdminUser[] = []; events: AdminEvent[] = []; filteredEvents: AdminEvent[] = []; bookings: AdminBooking[] = []; orders: Order[] = []; eventCategories: AdminCategory[] = []; serviceCategories: AdminCategory[] = [];
  profile: AdminUser | null = null; settings: AdminSettings | null = null; notifications: AdminNotification[] = []; reports: AdminReports | null = null;
  confirmingDeleteId: number | null = null;
  deletingId: number | null = null;
  loading = false; saving = false; error = ''; editingId: number | null = null; selectedImage: File | null = null; selectedImages: File[] = []; eventImagePreviews: string[] = []; search = ''; statusFilter = ''; categoryFilter = ''; newEventCategory = ''; newServiceCategory = ''; orderSearch = ''; orderStatus = ''; paymentStatus = '';
  orderStatuses = ['awaiting_payment', 'paid', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded'];
  paymentStatuses = ['pending', 'pending_verification', 'paid', 'failed', 'refunded'];
  stats: EventStats = { total_events: 0, published_events: 0, draft_events: 0, upcoming_events: 0 };
  form: Partial<AdminEvent> = this.emptyEvent();
  get statCards() { return [{ label: 'Total events', value: this.stats.total_events }, { label: 'Published', value: this.stats.published_events }, { label: 'Drafts', value: this.stats.draft_events }, { label: 'Upcoming', value: this.stats.upcoming_events }]; }
  constructor(private route: ActivatedRoute, private admin: AdminService, private checkout: CheckoutService) {}
  ngOnInit(): void {
    this.title = this.route.snapshot.data['title']; this.description = this.route.snapshot.data['description'];
    if (this.title === 'Events') this.loadEvents();
    else if (this.title === 'Users') this.admin.getUsers().subscribe({ next: v => this.users = v, error: e => this.error = e.error?.detail || 'Could not load users.' });
    else if (this.title === 'Bookings') this.loadOrders();
    else if (this.title === 'Profile') this.admin.getProfile().subscribe({ next: v => this.profile = v, error: e => this.error = e.error?.detail || 'Could not load profile.' });
    else if (this.title === 'Settings') this.admin.getSettings().subscribe({ next: v => this.settings = v, error: e => this.error = e.error?.detail || 'Could not load settings.' });
    else if (this.title === 'Notifications') this.admin.getNotifications().subscribe({ next: v => this.notifications = v, error: e => this.error = e.error?.detail || 'Could not load notifications.' });
    else if (this.title === 'Reports') this.admin.getReports().subscribe({ next: v => this.reports = v, error: e => this.error = e.error?.detail || 'Could not load reports.' });
  }
  get reportKeys(): string[] { return this.reports?.items.length ? Object.keys(this.reports.items[0]) : []; }
  loadOrders(): void { this.checkout.getAdminOrders({ status: this.orderStatus, payment_status: this.paymentStatus, search: this.orderSearch }).subscribe({ next: v => this.orders = v, error: e => this.error = e.error?.detail || 'Could not load orders.' }); }
  updateOrder(order: Order, event: Event): void { const status = (event.target as HTMLSelectElement).value; this.checkout.updateAdminOrder(order.id, status).subscribe({ next: updated => order.status = updated.status, error: e => this.error = e.error?.detail || 'Could not update order.' }); }
  updatePayment(order: Order, event: Event): void { const payment_status = (event.target as HTMLSelectElement).value; this.checkout.updateAdminPayment(order.id, payment_status).subscribe({ next: updated => { order.payment_status = updated.payment_status; order.status = updated.status; }, error: e => this.error = e.error?.detail || 'Could not update payment.' }); }
  deleteOrder(order: Order): void {
    this.deletingId = order.id;
    this.error = '';
    this.checkout.deleteAdminOrder(order.id).subscribe({
      next: () => {
        this.orders = this.orders.filter(item => item.id !== order.id);
        this.confirmingDeleteId = null;
        this.deletingId = null;
      },
      error: e => {
        this.error = e.error?.detail || 'Could not delete booking.';
        this.confirmingDeleteId = null;
        this.deletingId = null;
      }
    });
  }
  saveSettings(): void {
    if (!this.settings) return;
    this.saving = true;
    this.admin.updateSettings(this.settings).subscribe({
      next: settings => { this.settings = settings; this.saving = false; },
      error: e => { this.error = e.error?.detail || 'Could not save settings.'; this.saving = false; }
    });
  }
  markRead(notification: AdminNotification): void {
    this.admin.markNotificationRead(notification.id).subscribe({
      next: () => notification.is_read = true,
      error: e => this.error = e.error?.detail || 'Could not update notification.'
    });
  }
  resendOrderEmail(order: Order): void {
    this.checkout.resendAdminEmail(order.id).subscribe({
      next: () => this.error = '',
      error: e => this.error = e.error?.detail || 'The confirmation email could not be delivered.'
    });
  }
  emptyEvent(): Partial<AdminEvent> { return { title:'', description:'', date:'', time:'', location:'', event_type:'Public', ticket_price:0, status:'Draft', featured:false, tags:'' }; }
  mediaUrl(path?: string): string { return mediaUrl(path); }
  loadEvents(): void { this.loading = true; this.admin.getEvents().subscribe({ next: v => { this.events=v; this.applyFilters(); this.loading=false; }, error: () => { this.error='Could not load events.'; this.loading=false; } }); this.admin.getEventStats().subscribe(v => this.stats=v); this.admin.getEventCategories().subscribe(v => this.eventCategories=v); this.admin.getServiceCategories().subscribe(v => this.serviceCategories=v); }
  applyFilters(): void { const q=this.search.toLowerCase(); this.filteredEvents=this.events.filter(e => (!q || `${e.title} ${e.location} ${e.category_name}`.toLowerCase().includes(q)) && (!this.statusFilter || e.status===this.statusFilter) && (!this.categoryFilter || e.category_name===this.categoryFilter)); }
  selectImage(event: Event): void { const input=event.target as HTMLInputElement; this.selectedImage=input.files?.[0] || null; }
  selectImages(event: Event): void {
    const input=event.target as HTMLInputElement;
    const files=Array.from(input.files || []).filter(file => ['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)).slice(0,10);
    this.eventImagePreviews.forEach(url => URL.revokeObjectURL(url));
    this.selectedImages=files;
    this.eventImagePreviews=files.map(file => URL.createObjectURL(file));
  }
  removeSelectedImage(index: number): void {
    URL.revokeObjectURL(this.eventImagePreviews[index]);
    this.eventImagePreviews.splice(index,1);
    this.selectedImages.splice(index,1);
  }
  saveEvent(): void { this.saving=true; const request=this.editingId ? this.admin.updateEvent(this.editingId,this.form) : this.admin.createEvent(this.form as Omit<AdminEvent,'id'|'organizer_name'>); request.subscribe({ next: event => { const finish=()=>{ this.events=this.editingId ? this.events.map(e=>e.id===event.id?event:e) : [...this.events,event]; this.resetForm(); this.applyFilters(); this.admin.getEventStats().subscribe(v=>this.stats=v); }; if(this.selectedImages.length) this.admin.uploadEventImages(event.id,this.selectedImages).subscribe({next:result=>{event.cover_image=result.image_urls[0] || event.cover_image; finish();},error:()=>{this.error='Event saved, but image upload failed.'; finish();}}); else if(this.selectedImage) this.admin.uploadEventImage(event.id,this.selectedImage).subscribe({next:()=>finish(),error:()=>{this.error='Event saved, but image upload failed.'; finish();}}); else finish(); }, error: err=>{this.error=err.error?.detail || 'Could not save event.'; this.saving=false;} }); }
  editEvent(event: AdminEvent): void { this.editingId=event.id; this.form={...event}; this.selectedImage=null; this.selectedImages=[]; this.eventImagePreviews=(event.image_urls || (event.cover_image ? [event.cover_image] : [])).map(mediaUrl); window.scrollTo({top:0,behavior:'smooth'}); }
  resetForm(): void { this.editingId=null; this.form=this.emptyEvent(); this.selectedImage=null; this.selectedImages=[]; this.eventImagePreviews.forEach(url => URL.revokeObjectURL(url)); this.eventImagePreviews=[]; this.saving=false; }
  publishEvent(event: AdminEvent): void { const status=event.status==='Published'?'Draft':'Published'; this.admin.setEventStatus(event.id,status).subscribe({next:v=>{this.events=this.events.map(e=>e.id===v.id?v:e);this.applyFilters();this.admin.getEventStats().subscribe(s=>this.stats=s);},error:()=>this.error='Could not update event status.'}); }
  deleteEvent(id:number): void { if(!confirm('Delete this event?')) return; this.admin.deleteEvent(id).subscribe({next:()=>{this.events=this.events.filter(e=>e.id!==id);this.applyFilters();this.admin.getEventStats().subscribe(s=>this.stats=s);},error:()=>this.error='Could not delete event.'}); }
  addCategory(type:'event'|'service'): void { const name=type==='event'?this.newEventCategory.trim():this.newServiceCategory.trim(); if(!name)return; const call=type==='event'?this.admin.createEventCategory({name}):this.admin.createServiceCategory({name}); call.subscribe({next:c=>{(type==='event'?this.eventCategories:this.serviceCategories).push(c);if(type==='event')this.newEventCategory='';else this.newServiceCategory='';},error:()=>this.error='Could not add category.'}); }
  toggleCategory(c:AdminCategory,type:'event'|'service'):void { this.saveCategory({...c,is_active:!c.is_active},type); }
  saveCategory(c:AdminCategory,type:'event'|'service'):void { const call=type==='event'?this.admin.updateEventCategory(c.id,c):this.admin.updateServiceCategory(c.id,c);call.subscribe({next:v=>{const list=type==='event'?this.eventCategories:this.serviceCategories;const i=list.findIndex(x=>x.id===v.id);if(i>=0)list[i]=v;},error:()=>this.error='Could not update category.'}); }
  removeCategory(c:AdminCategory,type:'event'|'service'):void { if(!confirm(`Delete ${c.name}?`))return;const call=type==='event'?this.admin.deleteEventCategory(c.id):this.admin.deleteServiceCategory(c.id);call.subscribe({next:()=>{const list=type==='event'?this.eventCategories:this.serviceCategories; if(type==='event')this.eventCategories=list.filter(x=>x.id!==c.id);else this.serviceCategories=list.filter(x=>x.id!==c.id);},error:()=>this.error='Could not delete category.'}); }
  updateBooking(id:number,status:string):void { this.admin.updateBooking(id,status).subscribe({next:()=>this.bookings=this.bookings.map(b=>b.id===id?{...b,status}:b),error:()=>this.error='Could not update booking.'}); }
}
