import datetime
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from database import get_db
from models import EventCreateModel
from auth import get_current_user

router = APIRouter()


def serialize_event(event: Optional[Dict]) -> Optional[Dict]:
    if not event:
        return event
    event = dict(event)
    if isinstance(event.get('date'), (datetime.date, datetime.datetime)):
        event['date'] = event['date'].strftime('%Y-%m-%d')
    if isinstance(event.get('time'), datetime.timedelta):
        total_seconds = int(event['time'].total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        event['time'] = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    elif isinstance(event.get('time'), datetime.time):
        event['time'] = event['time'].strftime('%H:%M:%S')
    if isinstance(event.get('created_at'), (datetime.date, datetime.datetime)):
        event['created_at'] = event['created_at'].isoformat()
    return event


def serialize_attendee(att: Dict) -> Dict:
    att = dict(att)
    if isinstance(att.get('created_at'), (datetime.date, datetime.datetime)):
        att['created_at'] = att['created_at'].isoformat()
    if isinstance(att.get('responded_at'), (datetime.date, datetime.datetime)):
        att['responded_at'] = att['responded_at'].isoformat()
    return att


@router.post('', status_code=201)
@router.post('/', status_code=201)
def create_event(event: EventCreateModel, current_user: Dict = Depends(get_current_user)):
    organizer_id = int(current_user.get('id', 0))
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            """INSERT INTO events (title, description, date, time, location, organizer_id)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (event.title, event.description, event.date, event.time, event.location, organizer_id)
        )
        db.commit()
        event_id = cursor.lastrowid

        # Add organizer as attendee with role organizer
        cursor.execute(
            """INSERT INTO event_attendees (event_id, user_id, role, status)
               VALUES (%s, %s, %s, %s)""",
            (event_id, organizer_id, 'organizer', 'Going')
        )
        db.commit()

        cursor.execute("SELECT * FROM events WHERE id=%s", (event_id,))
        created = cursor.fetchone()
        if created:
            created['is_organizer'] = True
        return serialize_event(created)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.get('/organized')
def get_organized_events(current_user: Dict = Depends(get_current_user)):
    user_id = int(current_user.get('id', 0))
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM events WHERE organizer_id=%s ORDER BY date ASC, time ASC", (user_id,))
        events = cursor.fetchall()
        for ev in events:
            ev['is_organizer'] = True
            serialize_event(ev)
        return events
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.get('/invited')
def get_invited_events(current_user: Dict = Depends(get_current_user)):
    user_id = int(current_user.get('id', 0))
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            """SELECT e.*, u.name AS organizer_name, ea.status AS my_status
               FROM events e
               JOIN event_attendees ea ON e.id = ea.event_id
               JOIN users u ON e.organizer_id = u.id
               WHERE ea.user_id = %s AND ea.role = 'attendee'
               ORDER BY e.date ASC, e.time ASC""",
            (user_id,)
        )
        events = cursor.fetchall()
        for ev in events:
            ev['is_organizer'] = False
            serialize_event(ev)
        return events
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.get('/{event_id}')
def get_event(event_id: int, current_user: Dict = Depends(get_current_user)):
    user_id = int(current_user.get('id', 0))
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            """SELECT e.*, u.name AS organizer_name
               FROM events e
               JOIN users u ON e.organizer_id = u.id
               WHERE e.id = %s""",
            (event_id,)
        )
        ev = cursor.fetchone()
        if not ev:
            raise HTTPException(status_code=404, detail='Event not found')
        cursor.execute(
            """SELECT 1 FROM event_attendees
               WHERE event_id=%s AND user_id=%s""",
            (event_id, user_id),
        )
        if (
            int(ev.get('organizer_id', 0)) != user_id
            and not cursor.fetchone()
            and current_user.get('role') != 'admin'
        ):
            raise HTTPException(status_code=403, detail='You are not a participant of this event')
        ev['is_organizer'] = (int(ev.get('organizer_id', 0)) == user_id)
        return serialize_event(ev)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.put('/{event_id}')
def update_event(event_id: int, event: EventCreateModel, current_user: Dict = Depends(get_current_user)):
    user_id = int(current_user.get('id', 0))
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT organizer_id FROM events WHERE id=%s", (event_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail='Event not found')
        if int(row['organizer_id']) != user_id:
            raise HTTPException(status_code=403, detail='Only organizer can update the event')
        cursor.execute(
            """UPDATE events SET title=%s, description=%s, date=%s, time=%s, location=%s WHERE id=%s""",
            (event.title, event.description, event.date, event.time, event.location, event_id)
        )
        db.commit()
        cursor.execute("SELECT * FROM events WHERE id=%s", (event_id,))
        updated = cursor.fetchone()
        if updated:
            updated['is_organizer'] = True
        return serialize_event(updated)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.delete('/{event_id}')
def delete_event(event_id: int, current_user: Dict = Depends(get_current_user)):
    requester_id = int(current_user.get('id', 0))
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT organizer_id FROM events WHERE id=%s", (event_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail='Event not found')
        if int(row['organizer_id']) != requester_id:
            raise HTTPException(status_code=403, detail='Only organizer can delete the event')
        cursor.execute("DELETE FROM events WHERE id=%s", (event_id,))
        db.commit()
        return {'message': 'Event deleted'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.post('/{event_id}/invite')
def invite_by_email(event_id: int, payload: Dict, current_user: Dict = Depends(get_current_user)):
    inviter_id = int(current_user.get('id', 0))
    email = payload.get('email')
    if not email:
        raise HTTPException(status_code=400, detail='email is required')
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT organizer_id FROM events WHERE id=%s", (event_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail='Event not found')
        if int(row['organizer_id']) != inviter_id:
            raise HTTPException(status_code=403, detail='Only organizer can invite')

        cursor.execute("SELECT id FROM users WHERE email=%s", (email,))
        urow = cursor.fetchone()
        if not urow:
            raise HTTPException(status_code=404, detail='User with that email not found')
        user_id = int(urow['id'])

        cursor.execute("SELECT id FROM event_attendees WHERE event_id=%s AND user_id=%s", (event_id, user_id))
        if not cursor.fetchone():
            cursor.execute(
                """INSERT INTO event_attendees (event_id, user_id, role, status) VALUES (%s,%s,%s,%s)""",
                (event_id, user_id, 'attendee', 'Maybe')
            )
            db.commit()
        return {'message': 'Invitation processed'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.post('/{event_id}/attendance')
def rsvp(event_id: int, payload: Dict, current_user: Dict = Depends(get_current_user)):
    status = payload.get('status')
    user_id = int(current_user.get('id', 0))
    if status not in ('Going', 'Maybe', 'Not Going'):
        raise HTTPException(status_code=400, detail='Invalid status')
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM events WHERE id=%s", (event_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail='Event not found')
        cursor.execute("SELECT id FROM event_attendees WHERE event_id=%s AND user_id=%s", (event_id, user_id))
        row = cursor.fetchone()
        if row:
            cursor.execute("UPDATE event_attendees SET status=%s WHERE id=%s", (status, row['id']))
        else:
            cursor.execute(
                """INSERT INTO event_attendees (event_id, user_id, role, status) VALUES (%s,%s,%s,%s)""",
                (event_id, user_id, 'attendee', status)
            )
        db.commit()
        return {'message': 'Response recorded'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.get('/{event_id}/attendees')
def get_attendees(event_id: int, current_user: Dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM events WHERE id=%s", (event_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail='Event not found')
        cursor.execute("SELECT organizer_id FROM events WHERE id=%s", (event_id,))
        event = cursor.fetchone()
        if not event:
            raise HTTPException(status_code=404, detail='Event not found')
        cursor.execute(
            "SELECT 1 FROM event_attendees WHERE event_id=%s AND user_id=%s",
            (event_id, int(current_user.get('id', 0))),
        )
        if (
            int(event['organizer_id']) != int(current_user.get('id', 0))
            and not cursor.fetchone()
            and current_user.get('role') != 'admin'
        ):
            raise HTTPException(status_code=403, detail='Only participants can view attendees')

        cursor.execute(
            """SELECT ea.*, ea.created_at AS responded_at, u.name, u.email
               FROM event_attendees ea
               JOIN users u ON ea.user_id=u.id
               WHERE ea.event_id=%s""",
            (event_id,)
        )
        rows = cursor.fetchall()
        return [serialize_attendee(r) for r in rows]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()
