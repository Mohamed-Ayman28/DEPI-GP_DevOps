export interface Event {
  id?: number;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  organizer_id?: number;
  organizer_name?: string;
  created_at?: string;
  is_organizer?: boolean;
  attendees?: Attendee[];
  category_id?: number;
  category_name?: string;
  cover_image?: string;
  image_urls?: string[];
  status?: string;
  max_attendees?: number;
  event_type?: 'Public' | 'Private';
  ticket_price?: number;
  featured?: boolean | number;
  duration?: string;
  tags?: string;
  registration_deadline?: string;
}

export interface CreateEventDto {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
}

export interface Attendee {
  user_id: number;
  name?: string;
  email?: string;
  status: 'Going' | 'Maybe' | 'Not Going';
  responded_at?: string;
}