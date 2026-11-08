import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from database import get_db
from models import TaskCreateModel, TaskUpdateModel
from auth import get_current_user

router = APIRouter()


def serialize_task(task: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not task:
        return task
    task = dict(task)
    if isinstance(task.get('due_date'), (datetime.date, datetime.datetime)):
        task['due_date'] = task['due_date'].strftime('%Y-%m-%d')
    if isinstance(task.get('created_at'), (datetime.date, datetime.datetime)):
        task['created_at'] = task['created_at'].isoformat()
    return task


@router.post('', status_code=201)
@router.post('/', status_code=201)
def create_task(payload: TaskCreateModel, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user.get('id', 0))
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        # Check event exists and user is organizer
        cursor.execute("SELECT organizer_id FROM events WHERE id=%s", (payload.event_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail='Event not found')
        organizer_id = int(row['organizer_id'])
        if organizer_id != user_id:
            raise HTTPException(status_code=403, detail='Only organizer can create tasks')

        cursor.execute(
            """INSERT INTO tasks (event_id, title, description, due_date, assigned_to, status)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (payload.event_id, payload.title, payload.description, payload.due_date, payload.assigned_to, 'Pending')
        )
        db.commit()
        task_id = cursor.lastrowid
        return {'message': 'Task created', 'task_id': task_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.get('/assigned')
def get_assigned_tasks(current_user: dict = Depends(get_current_user)):
    user_id = int(current_user.get('id', 0))
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM tasks WHERE assigned_to=%s ORDER BY due_date ASC", (user_id,))
        rows = cursor.fetchall()
        return {'tasks': [serialize_task(r) for r in rows]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.get('/search')
def search_tasks(
    q: Optional[str] = None,
    date: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    user_id = int(current_user.get('id', 0))
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        base = """SELECT DISTINCT t.*
                  FROM tasks t
                  JOIN event_attendees ea ON t.event_id=ea.event_id
                  WHERE ea.user_id=%s"""
        params: List[Any] = [user_id]
        if q:
            base += " AND (t.title LIKE %s OR t.description LIKE %s)"
            qparam = f"%{q}%"
            params.extend([qparam, qparam])
        if date:
            base += " AND t.due_date=%s"
            params.append(date)
        if status:
            base += " AND t.status=%s"
            params.append(status)
        cursor.execute(base, tuple(params))
        rows = cursor.fetchall()
        return {'results': [serialize_task(r) for r in rows]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.get('/event/{event_id}')
def list_event_tasks(event_id: int, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user.get('id', 0))
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        # Ensure user is part of the event (attendee or organizer)
        cursor.execute("SELECT 1 FROM event_attendees WHERE event_id=%s AND user_id=%s", (event_id, user_id))
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail='Not a participant of this event')
        cursor.execute("SELECT * FROM tasks WHERE event_id=%s ORDER BY due_date ASC", (event_id,))
        rows = cursor.fetchall()
        return {'tasks': [serialize_task(r) for r in rows]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.get('/{task_id}')
def get_task(task_id: int, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user.get('id', 0))
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM tasks WHERE id=%s", (task_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail='Task not found')
        cursor.execute(
            """SELECT 1 FROM event_attendees
               WHERE event_id=%s AND user_id=%s""",
            (row['event_id'], user_id),
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail='Not a participant of this event')
        return {'task': serialize_task(row)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.put('/{task_id}')
def update_task(task_id: int, payload: TaskUpdateModel, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user.get('id', 0))
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        # Check task exists and requester is organizer
        cursor.execute("SELECT event_id FROM tasks WHERE id=%s", (task_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail='Task not found')
        event_id = int(row['event_id'])

        cursor.execute("SELECT organizer_id FROM events WHERE id=%s", (event_id,))
        erow = cursor.fetchone()
        if not erow:
            raise HTTPException(status_code=404, detail='Event not found')
        organizer_id = int(erow['organizer_id'])
        if organizer_id != user_id:
            raise HTTPException(status_code=403, detail='Only organizer can update tasks')

        updates = []
        params = []
        if payload.title is not None:
            updates.append('title=%s')
            params.append(payload.title)
        if payload.description is not None:
            updates.append('description=%s')
            params.append(payload.description)
        if payload.due_date is not None:
            updates.append('due_date=%s')
            params.append(payload.due_date)
        if payload.assigned_to is not None:
            updates.append('assigned_to=%s')
            params.append(payload.assigned_to)
        if payload.status is not None:
            updates.append('status=%s')
            params.append(payload.status)

        if not updates:
            raise HTTPException(status_code=400, detail='No fields to update')

        sql = f"UPDATE tasks SET {', '.join(updates)} WHERE id=%s"
        params.append(task_id)
        cursor.execute(sql, tuple(params))
        db.commit()

        cursor.execute("SELECT * FROM tasks WHERE id=%s", (task_id,))
        updated = cursor.fetchone()
        return {'message': 'Task updated', 'task': serialize_task(updated)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.delete('/{task_id}')
def delete_task(task_id: int, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user.get('id', 0))
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT event_id FROM tasks WHERE id=%s", (task_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail='Task not found')
        event_id = int(row['event_id'])

        cursor.execute("SELECT organizer_id FROM events WHERE id=%s", (event_id,))
        erow = cursor.fetchone()
        if not erow:
            raise HTTPException(status_code=404, detail='Event not found')
        organizer_id = int(erow['organizer_id'])
        if organizer_id != user_id:
            raise HTTPException(status_code=403, detail='Only organizer can delete tasks')

        cursor.execute("DELETE FROM tasks WHERE id=%s", (task_id,))
        db.commit()
        return {'message': 'Task deleted'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()
