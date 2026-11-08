import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { EventService } from '../../services/event.service';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let eventService: jasmine.SpyObj<EventService>;
  let router: Router;
  let navigateSpy: jasmine.Spy;

  beforeEach(async () => {
    const eventServiceSpy = jasmine.createSpyObj('EventService', [
      'getMyOrganizedEvents',
      'getMyInvitedEvents',
      'createEvent',
      'deleteEvent'
    ]);
    await TestBed.configureTestingModule({
      imports: [DashboardComponent, HttpClientTestingModule, RouterTestingModule],
      providers: [
        { provide: EventService, useValue: eventServiceSpy }
      ]
    }).compileComponents();

    eventService = TestBed.inject(EventService) as jasmine.SpyObj<EventService>;
    router = TestBed.inject(Router);
    navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should redirect to home if not authenticated', () => {
    localStorage.removeItem('token');
    eventService.getMyOrganizedEvents.and.returnValue(of([]));
    
    fixture.detectChanges();
    
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should load organized events on init', () => {
    localStorage.setItem('token', 'test-token');
    const mockEvents = [
      {
        id: 1,
        title: 'Test Event',
        description: 'Test Description',
        date: '2024-12-25',
        time: '10:00',
        location: 'Test Location'
      }
    ];
    eventService.getMyOrganizedEvents.and.returnValue(of(mockEvents));

    fixture.detectChanges();

    expect(eventService.getMyOrganizedEvents).toHaveBeenCalled();
    expect(component.organizedEvents).toEqual(mockEvents);
  });

  it('should switch to invited view and load invited events', () => {
    localStorage.setItem('token', 'test-token');
    const mockEvents = [
      {
        id: 2,
        title: 'Invited Event',
        description: 'Invited Description',
        date: '2024-12-26',
        time: '14:00',
        location: 'Invited Location',
        organizer_name: 'John Doe'
      }
    ];
    eventService.getMyOrganizedEvents.and.returnValue(of([]));
    eventService.getMyInvitedEvents.and.returnValue(of(mockEvents));

    fixture.detectChanges();
    component.currentView = 'invited';
    component.loadInvitedEvents();

    expect(eventService.getMyInvitedEvents).toHaveBeenCalled();
    expect(component.invitedEvents).toEqual(mockEvents);
  });

  it('should create a new event successfully', () => {
    localStorage.setItem('token', 'test-token');
    const newEvent = {
      title: 'New Event',
      description: 'New Description',
      date: '2024-12-27',
      time: '16:00',
      location: 'New Location'
    };
    const createdEvent = { id: 3, ...newEvent };
    
    eventService.getMyOrganizedEvents.and.returnValue(of([]));
    eventService.createEvent.and.returnValue(of(createdEvent));
    
    fixture.detectChanges();
    component.newEvent = newEvent;
    spyOn(window, 'alert');
    
    component.createEvent();

    expect(eventService.createEvent).toHaveBeenCalledWith(newEvent);
    expect(window.alert).toHaveBeenCalledWith('Event created successfully! ✅');
    expect(component.currentView).toBe('organized');
  });

  it('should show alert if creating event with missing fields', () => {
    localStorage.setItem('token', 'test-token');
    eventService.getMyOrganizedEvents.and.returnValue(of([]));
    
    fixture.detectChanges();
    component.newEvent = {
      title: '',
      description: '',
      date: '',
      time: '',
      location: ''
    };
    spyOn(window, 'alert');
    
    component.createEvent();

    expect(eventService.createEvent).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith('Please fill in all fields');
  });

  it('should delete event after confirmation', () => {
    localStorage.setItem('token', 'test-token');
    eventService.getMyOrganizedEvents.and.returnValue(of([]));
    eventService.deleteEvent.and.returnValue(of({}));
    
    fixture.detectChanges();
    spyOn(window, 'confirm').and.returnValue(true);
    spyOn(window, 'alert');
    
    component.deleteEvent(1);

    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this event?');
    expect(eventService.deleteEvent).toHaveBeenCalledWith(1);
    expect(window.alert).toHaveBeenCalledWith('Event deleted successfully! ✅');
  });

  it('should not delete event if user cancels', () => {
    localStorage.setItem('token', 'test-token');
    eventService.getMyOrganizedEvents.and.returnValue(of([]));
    
    fixture.detectChanges();
    spyOn(window, 'confirm').and.returnValue(false);
    
    component.deleteEvent(1);

    expect(window.confirm).toHaveBeenCalled();
    expect(eventService.deleteEvent).not.toHaveBeenCalled();
  });

  it('should populate form when editing an event', () => {
    localStorage.setItem('token', 'test-token');
    const mockEvent = {
      id: 1,
      title: 'Edit Event',
      description: 'Edit Description',
      date: '2024-12-28',
      time: '18:00',
      location: 'Edit Location'
    };
    eventService.getMyOrganizedEvents.and.returnValue(of([]));
    
    fixture.detectChanges();
    component.editEvent(mockEvent);

    expect(component.newEvent.title).toBe(mockEvent.title);
    expect(component.newEvent.description).toBe(mockEvent.description);
    expect(component.newEvent.date).toBe(mockEvent.date);
    expect(component.newEvent.time).toBe(mockEvent.time);
    expect(component.newEvent.location).toBe(mockEvent.location);
    expect(component.currentView).toBe('create');
  });

  it('should reset form', () => {
    component.newEvent = {
      title: 'Test',
      description: 'Test',
      date: '2024-12-25',
      time: '10:00',
      location: 'Test'
    };
    
    component.resetForm();

    expect(component.newEvent.title).toBe('');
    expect(component.newEvent.description).toBe('');
    expect(component.newEvent.date).toBe('');
    expect(component.newEvent.time).toBe('');
    expect(component.newEvent.location).toBe('');
  });

  it('should logout and clear token', () => {
    localStorage.setItem('token', 'test-token');
    eventService.getMyOrganizedEvents.and.returnValue(of([]));
    
    fixture.detectChanges();
    component.logout();

    expect(localStorage.getItem('token')).toBeNull();
    expect(navigateSpy.calls.mostRecent().args).toEqual([['/'], { replaceUrl: true }]);
  });

  it('should handle error when loading organized events', () => {
    localStorage.setItem('token', 'test-token');
    const error = { status: 500, message: 'Server error' };
    eventService.getMyOrganizedEvents.and.returnValue(throwError(() => error));
    spyOn(console, 'error');
    
    fixture.detectChanges();

    expect(console.error).toHaveBeenCalledWith('Error loading organized events:', error);
  });

  it('should logout on 401 error when loading events', () => {
    localStorage.setItem('token', 'test-token');
    const error = { status: 401, message: 'Unauthorized' };
    eventService.getMyOrganizedEvents.and.returnValue(throwError(() => error));
    spyOn(window, 'alert');
    
    fixture.detectChanges();

    expect(window.alert).toHaveBeenCalledWith('Session expired. Please login again.');
    expect(navigateSpy.calls.mostRecent().args).toEqual([['/'], { replaceUrl: true }]);
  });

  afterEach(() => {
    localStorage.clear();
  });
});