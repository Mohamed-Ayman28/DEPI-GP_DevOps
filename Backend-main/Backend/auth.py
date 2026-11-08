import os
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

import bcrypt
from dotenv import load_dotenv
from fastapi import Depends, Header, HTTPException
from jose import JWTError, jwt

load_dotenv()

SECRET_KEY = os.getenv('SECRET_KEY', 'replace-with-a-long-random-development-secret')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', '30'))

if os.getenv('ENVIRONMENT', 'development').lower() == 'production' and (
    not os.getenv('SECRET_KEY') or len(SECRET_KEY) < 32
):
    raise RuntimeError('A SECRET_KEY of at least 32 characters is required in production')


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain: str, stored: str) -> bool:
    try:
        if not stored.startswith('$2'):
            return False
        return bcrypt.checkpw(plain.encode('utf-8'), stored.encode('utf-8'))
    except (ValueError, TypeError):
        return False


def create_token(data: dict) -> str:
    payload = data.copy()
    payload['exp'] = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload['iat'] = datetime.now(timezone.utc)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if not payload.get('id'):
            raise HTTPException(status_code=401, detail='Invalid token')
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail='Invalid token')


def get_current_user(authorization: Optional[str] = Header(None)) -> Dict:
    """FastAPI dependency to extract current user from Authorization header.

    Expects header: Authorization: Bearer <token>
    """
    if not authorization:
        raise HTTPException(status_code=401, detail='Authorization header missing')
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        raise HTTPException(status_code=401, detail='Invalid authorization header')
    token = parts[1]
    current_user = decode_token(token)
    from database import get_db

    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            'SELECT id, email, name, role FROM users WHERE id=%s',
            (current_user['id'],),
        )
        user = cursor.fetchone()
    finally:
        cursor.close()
        db.close()
    if not user:
        raise HTTPException(status_code=401, detail='User account is no longer available')
    return {
        'id': int(user['id']),
        'email': str(user['email']),
        'name': str(user['name']),
        'role': str(user['role']),
    }


def get_optional_current_user(authorization: Optional[str] = Header(None)) -> Optional[Dict]:
    """FastAPI dependency to extract current user if present, or None if not."""
    if not authorization:
        return None
    try:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == 'bearer':
            return decode_token(parts[1])
    except Exception:
        return None
    return None


def require_role(*allowed_roles: str):
    def dependency(current_user: Dict = Depends(get_current_user)) -> Dict:
        from database import get_db

        db = get_db()
        cursor = db.cursor(dictionary=True)
        try:
            cursor.execute('SELECT role FROM users WHERE id=%s', (current_user['id'],))
            user = cursor.fetchone()
        finally:
            cursor.close()
            db.close()
        role = user.get('role') if user else None
        if role not in allowed_roles:
            raise HTTPException(status_code=403, detail='Insufficient permissions')
        current_user['role'] = role
        return current_user

    return dependency
