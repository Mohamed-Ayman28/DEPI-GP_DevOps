import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { EventService } from './event.service';
import { API_URL } from '../app.config';
import { Attendee } from '../models/event.model';

describe('EventService', () => {
  let service: EventService;
  let httpMock: HttpTestingController;
  const apiUrl = `${API_URL}/events`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [EventService]
    });

    service = TestBed.inject(EventService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.setItem('token', 'fake-token');
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('token');
  });

  it('should POST attendance when rsvp called', (done) => {
    service.rsvp(1, 'Going').subscribe(res => {
      expect(res).toBeTruthy();
      done();
    });

    const req = httpMock.expectOne(`${apiUrl}/1/attendance`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ status: 'Going' });
    expect(req.request.headers.get('Authorization')).toBe('Bearer fake-token');
    req.flush({ success: true });
  });

  it('should GET attendees', (done) => {
    const mock: Attendee[] = [{ user_id: 2, name: 'Alice', status: 'Maybe' }];

    service.getAttendees(1).subscribe(data => {
      expect(data).toEqual(mock);
      done();
    });

    const req = httpMock.expectOne(`${apiUrl}/1/attendees`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
  });
});
