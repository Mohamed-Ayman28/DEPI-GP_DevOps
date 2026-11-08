from typing import Any, Dict
from fastapi import APIRouter, HTTPException
from database import get_db
from models import SignupModel, LoginModel
from auth import hash_password, verify_password, create_token

router = APIRouter()


@router.post('/signup', status_code=201)
def signup(user: SignupModel):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM users WHERE email=%s", (user.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail='Email already registered')

        hashed = hash_password(user.password)
        assigned_role = user.role if user.role in ('customer', 'vendor') else 'customer'
        cursor.execute(
            "INSERT INTO users (name, email, password, phone_number, role) VALUES (%s,%s,%s,%s,%s)",
            (user.name, user.email, hashed, user.phone_number, assigned_role),
        )
        db.commit()

        # fetch the newly created user to return a token (auto-login)
        cursor.execute("SELECT * FROM users WHERE email=%s", (user.email,))
        new_user = cursor.fetchone()
        if not new_user:
            raise HTTPException(status_code=500, detail='User created but could not be retrieved')

        user_id = int(new_user.get('id', 0))
        user_email = str(new_user.get('email', ''))
        user_name = str(new_user.get('name', ''))
        user_role = str(new_user.get('role', 'customer'))
        token = create_token({
            'id': user_id,
            'email': user_email,
            'role': user_role,
        })

        return {
            'message': 'User registered successfully',
            'token': token,
            'user': {
                'id': user_id,
                'email': user_email,
                'name': user_name,
                'role': user_role,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()


@router.post('/login')
def login(data: LoginModel):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM users WHERE email=%s", (data.email,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail='Invalid email or password')
        if not verify_password(data.password, str(user.get('password', ''))):
            raise HTTPException(status_code=401, detail='Invalid email or password')

        stored_password = str(user.get('password', ''))
        if not stored_password.startswith('$2'):
            cursor.execute(
                "UPDATE users SET password=%s WHERE id=%s",
                (hash_password(data.password), user.get('id')),
            )
            db.commit()

        user_id = int(user.get('id', 0))
        user_email = str(user.get('email', ''))
        user_name = str(user.get('name', ''))
        user_role = str(user.get('role', 'customer'))
        if user_role == 'admin':
            raise HTTPException(
                status_code=403,
                detail='Use the administrator sign-in page for admin accounts',
            )
        token = create_token({
            'id': user_id,
            'email': user_email,
            'role': user_role,
        })
        return {
            'message': 'Login successful',
            'token': token,
            'user': {
                'id': user_id,
                'email': user_email,
                'name': user_name,
                'role': user_role,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        db.close()
