import datetime
from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from models import ResponseModel
from auth import get_current_user, require_role

router = APIRouter()


@router.post('/{event_id}')
def set_response(
    event_id: int,
    response: ResponseModel,
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user.get('id', 0))
    if response.user_id != user_id:
        raise HTTPException(status_code=403, detail='You can only update your own booking request')
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        # check event exists
        cursor.execute("SELECT id FROM events WHERE id=%s", (event_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail='Event not found')
        # update or insert attendee response
        cursor.execute("SELECT id FROM event_attendees WHERE event_id=%s AND user_id=%s", (event_id, response.user_id))
        row = cursor.fetchone()
        if row:
            cursor.execute("UPDATE event_attendees SET status=%s WHERE id=%s", (response.status, row['id']))
        else:
            cursor.execute(
                "INSERT INTO event_attendees (event_id, user_id, role, status) VALUES (%s,%s,%s,%s)",
                (event_id, response.user_id, 'attendee', response.status)
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


@router.get('/{event_id}')
def get_responses(event_id: int, current_user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT organizer_id FROM events WHERE id=%s", (event_id,))
        event = cursor.fetchone()
        if not event:
            raise HTTPException(status_code=404, detail='Event not found')
        if (
            int(event['organizer_id']) != int(current_user.get('id', 0))
            and current_user.get('role') != 'admin'
        ):
            raise HTTPException(status_code=403, detail='Only the event organizer can view booking requests')
        cursor.execute(
            """SELECT ea.*, u.name, u.email
               FROM event_attendees ea
               JOIN users u ON ea.user_id=u.id
               WHERE ea.event_id=%s""",
            (event_id,)
        )
        rows = cursor.fetchall()
        for r in rows:
            if isinstance(r.get('created_at'), (datetime.date, datetime.datetime)):
                r['created_at'] = r['created_at'].isoformat()
        return {'attendees': rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()
