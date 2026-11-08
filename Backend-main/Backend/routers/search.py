import datetime
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Query, Depends
from database import get_db
from auth import get_optional_current_user

router = APIRouter()


def serialize_search_event(event: Dict[str, Any]) -> Dict[str, Any]:
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


@router.get('/events/published')
def get_published_events(current_user: Optional[Dict] = Depends(get_optional_current_user)):
    """Return only events explicitly published by an administrator."""
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            """SELECT e.*, u.name AS organizer_name, c.name AS category_name
               FROM events e
               LEFT JOIN users u ON u.id = e.organizer_id
               LEFT JOIN event_categories c ON c.id = e.category_id
               WHERE e.status = 'Published'
               ORDER BY e.date ASC, e.time ASC"""
        )
        return [serialize_search_event(event) for event in cursor.fetchall()]
    except Exception as exc:
        raise HTTPException(status_code=500, detail='Unable to load published events') from exc
    finally:
        cursor.close()
        db.close()


@router.get('/events')
def search_events(
    q: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    current_user: Optional[Dict] = Depends(get_optional_current_user)
):
    user_id = int(current_user.get('id', 0)) if current_user else 0
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        base = """SELECT DISTINCT e.*,
                         u_org.name AS organizer_name
                  FROM events e
                  LEFT JOIN users u_org ON e.organizer_id = u_org.id
                  LEFT JOIN event_attendees ea ON e.id = ea.event_id
                  WHERE 1=1"""
        params: List[Any] = []
        if q:
            base += " AND (e.title LIKE %s OR e.description LIKE %s)"
            qparam = f"%{q}%"
            params.extend([qparam, qparam])
        if date:
            base += " AND e.date=%s"
            params.append(date)
        if role and role in ('organizer', 'attendee'):
            if user_id > 0:
                base += " AND ea.role=%s AND ea.user_id=%s"
                params.extend([role, user_id])
            else:
                base += " AND ea.role=%s"
                params.append(role)

        base += " ORDER BY e.date ASC, e.time ASC"
        cursor.execute(base, tuple(params))
        rows = cursor.fetchall()
        for ev in rows:
            ev['is_organizer'] = (int(ev.get('organizer_id', 0)) == user_id)
        return {'results': [serialize_search_event(r) for r in rows]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()
