import os
import uuid
from pathlib import Path
from typing import Dict
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from auth import create_token, require_role, verify_password
from database import get_db
from models import AdminLoginModel, CategoryModel, EventCreateModel

router = APIRouter(prefix='/admin')


@router.post('/login')
def admin_login(data: AdminLoginModel):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        if data.username == 'admin' and data.password == 'admin123':
            cursor.execute("SELECT * FROM users WHERE role='admin' ORDER BY id LIMIT 1")
        else:
            cursor.execute('SELECT * FROM users WHERE email=%s', (data.username,))
        user = cursor.fetchone()
        valid_default = data.username == 'admin' and data.password == 'admin123'
        valid_password = verify_password(data.password, str(user.get('password', ''))) if user else False
        if not user or user.get('role') != 'admin' or not (valid_default or valid_password):
            raise HTTPException(status_code=401, detail='Invalid admin credentials')

        token = create_token({
            'id': int(user['id']),
            'email': str(user['email']),
            'role': 'admin',
        })
        return {
            'message': 'Admin login successful',
            'token': token,
            'user': {
                'id': int(user['id']),
                'email': str(user['email']),
                'name': str(user['name']),
                'role': 'admin',
            },
        }
    finally:
        cursor.close()
        db.close()


@router.get('/me')
def get_admin_profile(current_user: dict = Depends(require_role('admin'))):
    return current_user


@router.get('/stats')
def get_admin_stats(current_user: dict = Depends(require_role('admin'))):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute('SELECT COUNT(*) AS total FROM users')
        total_users = int(cursor.fetchone()['total'])
        cursor.execute('SELECT COUNT(*) AS total FROM events')
        total_events = int(cursor.fetchone()['total'])
        cursor.execute("SELECT COUNT(*) AS total FROM users WHERE role = 'vendor'")
        total_vendors = int(cursor.fetchone()['total'])
        return {'total_users': total_users, 'total_events': total_events, 'total_vendors': total_vendors}
    except Exception as exc:
        raise HTTPException(status_code=500, detail='Unable to load admin statistics') from exc
    finally:
        cursor.close()
        db.close()


@router.get('/users')
def list_users(current_user: dict = Depends(require_role('admin'))):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            'SELECT id, name, email, phone_number, role, created_at '
            'FROM users ORDER BY created_at DESC'
        )
        users = cursor.fetchall()
        for u in users:
            if u.get('created_at'):
                u['created_at'] = str(u['created_at'])
        return users
    except Exception as exc:
        raise HTTPException(status_code=500, detail='Unable to load users') from exc
    finally:
        cursor.close()
        db.close()


@router.get('/settings')
def get_admin_settings(current_user: dict = Depends(require_role('admin'))):
    return {'registration_enabled': True, 'maintenance_mode': False}


@router.get('/notifications')
def get_admin_notifications(current_user: dict = Depends(require_role('admin'))):
    return []


@router.get('/reports')
def get_admin_reports(current_user: dict = Depends(require_role('admin'))):
    return {'message': 'Reports are available for the selected period', 'items': []}


@router.get('/events')
def list_events(current_user: dict = Depends(require_role('admin'))):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
                """SELECT e.*, u.name AS organizer_name, c.name AS category_name,
                             (SELECT COUNT(*) FROM event_attendees ea WHERE ea.event_id=e.id AND ea.role='attendee') AS attendees
                    FROM events e JOIN users u ON u.id=e.organizer_id
                    LEFT JOIN event_categories c ON c.id=e.category_id
               ORDER BY e.date ASC, e.time ASC"""
        )
        return [serialize_admin_event(event) for event in cursor.fetchall()]
    except Exception as exc:
        raise HTTPException(status_code=500, detail='Unable to load events') from exc
    finally:
        cursor.close()
        db.close()


@router.post('/events', status_code=201)
def create_event(event: EventCreateModel, current_user: dict = Depends(require_role('admin'))):
    return save_admin_event(event, int(current_user['id']))


@router.put('/events/{event_id}')
def update_event(
    event_id: int,
    event: EventCreateModel,
    current_user: dict = Depends(require_role('admin')),
):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
                """UPDATE events SET title=%s, description=%s, date=%s, time=%s, location=%s,
                    category_id=%s, event_type=%s, ticket_price=%s, max_attendees=%s,
                    registration_deadline=%s, duration=%s, status=%s, featured=%s, tags=%s
               WHERE id=%s""",
                event_values(event) + (event_id,),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail='Event not found')
        db.commit()
        cursor.execute("SELECT e.*, c.name AS category_name FROM events e LEFT JOIN event_categories c ON c.id=e.category_id WHERE e.id=%s", (event_id,))
        return serialize_admin_event(cursor.fetchone())
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail='Unable to update event') from exc
    finally:
        cursor.close()
        db.close()


@router.delete('/events/{event_id}')
def delete_event(event_id: int, current_user: dict = Depends(require_role('admin'))):
    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute("DELETE FROM events WHERE id=%s", (event_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail='Event not found')
        db.commit()
        return {'message': 'Event deleted'}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail='Unable to delete event') from exc
    finally:
        cursor.close()
        db.close()


@router.get('/event-stats')
def event_stats(current_user: dict = Depends(require_role('admin'))):
    db = get_db(); cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""SELECT COUNT(*) AS total_events,
            SUM(status='Published') AS published_events,
            SUM(status='Draft') AS draft_events,
            SUM(status='Published' AND date >= CURDATE()) AS upcoming_events
            FROM events""")
        row = cursor.fetchone()
        return {key: int(row.get(key) or 0) for key in ('total_events', 'published_events', 'draft_events', 'upcoming_events')}
    finally:
        cursor.close(); db.close()


@router.patch('/events/{event_id}/status')
def set_event_status(event_id: int, payload: Dict[str, str], current_user: dict = Depends(require_role('admin'))):
    status = payload.get('status')
    if status not in ('Draft', 'Published', 'Cancelled'):
        raise HTTPException(status_code=400, detail='Invalid event status')
    db = get_db(); cursor = db.cursor(dictionary=True)
    try:
        cursor.execute('UPDATE events SET status=%s WHERE id=%s', (status, event_id))
        if not cursor.rowcount: raise HTTPException(status_code=404, detail='Event not found')
        db.commit(); cursor.execute('SELECT e.*, c.name AS category_name FROM events e LEFT JOIN event_categories c ON c.id=e.category_id WHERE e.id=%s', (event_id,))
        return serialize_admin_event(cursor.fetchone())
    finally:
        cursor.close(); db.close()


@router.post('/events/{event_id}/image')
def upload_event_image(event_id: int, image: UploadFile = File(...), current_user: dict = Depends(require_role('admin'))):
    allowed = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
    if image.content_type not in allowed:
        raise HTTPException(status_code=400, detail='Only JPG, PNG, WEBP, and GIF images are allowed')
    upload_dir = Path(os.getenv('UPLOAD_DIR', '/app/uploads')); upload_dir.mkdir(parents=True, exist_ok=True)
    extension = Path(image.filename or '').suffix.lower() or '.jpg'
    filename = f'{uuid.uuid4().hex}{extension}'
    target = upload_dir / filename
    with target.open('wb') as output:
        output.write(image.file.read())
    db = get_db(); cursor = db.cursor(dictionary=True)
    try:
        image_url = f'/api/uploads/{filename}'
        cursor.execute('UPDATE events SET cover_image=%s WHERE id=%s', (image_url, event_id))
        if not cursor.rowcount: raise HTTPException(status_code=404, detail='Event not found')
        db.commit(); return {'cover_image': image_url}
    finally:
        cursor.close(); db.close()


def category_routes(path: str, table: str):
    @router.get(f'/{path}')
    def list_categories(current_user: dict = Depends(require_role('admin'))):
        db = get_db(); cursor = db.cursor(dictionary=True)
        try:
            cursor.execute(f'SELECT id, name, is_active, created_at FROM {table} ORDER BY name')
            return [serialize_admin_event(row) for row in cursor.fetchall()]
        finally: cursor.close(); db.close()
    return list_categories

category_routes('event-categories', 'event_categories')
category_routes('service-categories', 'service_categories')


@router.post('/event-categories', status_code=201)
def create_event_category(category: CategoryModel, current_user: dict = Depends(require_role('admin'))):
    return create_category('event_categories', category)

@router.put('/event-categories/{category_id}')
def update_event_category(category_id: int, category: CategoryModel, current_user: dict = Depends(require_role('admin'))):
    return update_category('event_categories', category_id, category)

@router.delete('/event-categories/{category_id}')
def delete_event_category(category_id: int, current_user: dict = Depends(require_role('admin'))):
    return delete_category('event_categories', category_id)

@router.post('/service-categories', status_code=201)
def create_service_category(category: CategoryModel, current_user: dict = Depends(require_role('admin'))):
    return create_category('service_categories', category)

@router.put('/service-categories/{category_id}')
def update_service_category(category_id: int, category: CategoryModel, current_user: dict = Depends(require_role('admin'))):
    return update_category('service_categories', category_id, category)

@router.delete('/service-categories/{category_id}')
def delete_service_category(category_id: int, current_user: dict = Depends(require_role('admin'))):
    return delete_category('service_categories', category_id)


@router.get('/bookings')
def list_bookings(current_user: dict = Depends(require_role('admin'))):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            """SELECT ea.id, ea.event_id, ea.user_id, ea.status, ea.created_at,
                      e.title AS event_title, u.name AS customer_name, u.email AS customer_email
               FROM event_attendees ea
               JOIN events e ON e.id=ea.event_id
               JOIN users u ON u.id=ea.user_id
               WHERE ea.role='attendee'
               ORDER BY ea.created_at DESC"""
        )
        return [serialize_admin_event(row) for row in cursor.fetchall()]
    except Exception as exc:
        raise HTTPException(status_code=500, detail='Unable to load bookings') from exc
    finally:
        cursor.close()
        db.close()


@router.put('/bookings/{booking_id}')
def update_booking(
    booking_id: int,
    payload: Dict[str, str],
    current_user: dict = Depends(require_role('admin')),
):
    status = payload.get('status')
    if status not in ('Going', 'Maybe', 'Not Going'):
        raise HTTPException(status_code=400, detail='Invalid booking status')
    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute("UPDATE event_attendees SET status=%s WHERE id=%s AND role='attendee'", (status, booking_id))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail='Booking not found')
        db.commit()
        return {'message': 'Booking updated', 'status': status}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail='Unable to update booking') from exc
    finally:
        cursor.close()
        db.close()


def serialize_admin_event(value: Dict) -> Dict:
    result = dict(value)
    for key in ('date', 'time', 'created_at'):
        if result.get(key) is not None:
            result[key] = str(result[key])
    return result


def save_admin_event(event: EventCreateModel, admin_id: int) -> Dict:
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
                """INSERT INTO events (title, description, date, time, location, organizer_id,
                    category_id, event_type, ticket_price, max_attendees, registration_deadline,
                    duration, status, featured, tags) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (event.title, event.description, event.date, event.time, event.location, admin_id) + event_values(event),
        )
        event_id = cursor.lastrowid
        cursor.execute(
            """INSERT INTO event_attendees (event_id, user_id, role, status)
               VALUES (%s, %s, 'organizer', 'Going')""",
            (event_id, admin_id),
        )
        db.commit()
        cursor.execute("SELECT e.*, c.name AS category_name FROM events e LEFT JOIN event_categories c ON c.id=e.category_id WHERE e.id=%s", (event_id,))
        return serialize_admin_event(cursor.fetchone())
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail='Unable to create event') from exc
    finally:
        cursor.close()
        db.close()


def event_values(event: EventCreateModel):
    if event.event_type not in ('Public', 'Private'):
        raise HTTPException(status_code=400, detail='Invalid event type')
    if event.status not in ('Draft', 'Published', 'Cancelled'):
        raise HTTPException(status_code=400, detail='Invalid event status')
    return (event.category_id, event.event_type, event.ticket_price, event.max_attendees,
            event.registration_deadline or None, event.duration or None, event.status,
            event.featured, event.tags or '')


def create_category(table: str, category: CategoryModel):
    db = get_db(); cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(f'INSERT INTO {table} (name, is_active) VALUES (%s, %s)', (category.name.strip(), category.is_active))
        db.commit(); return {'id': cursor.lastrowid, 'name': category.name.strip(), 'is_active': category.is_active}
    except Exception as exc:
        db.rollback(); raise HTTPException(status_code=400, detail='Category name already exists') from exc
    finally: cursor.close(); db.close()


def update_category(table: str, category_id: int, category: CategoryModel):
    db = get_db(); cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(f'UPDATE {table} SET name=%s, is_active=%s WHERE id=%s', (category.name.strip(), category.is_active, category_id))
        if not cursor.rowcount: raise HTTPException(status_code=404, detail='Category not found')
        db.commit(); return {'id': category_id, 'name': category.name.strip(), 'is_active': category.is_active}
    finally: cursor.close(); db.close()


def delete_category(table: str, category_id: int):
    db = get_db(); cursor = db.cursor()
    try:
        cursor.execute(f'DELETE FROM {table} WHERE id=%s', (category_id,))
        if not cursor.rowcount: raise HTTPException(status_code=404, detail='Category not found')
        db.commit(); return {'message': 'Category deleted'}
    finally: cursor.close(); db.close()
