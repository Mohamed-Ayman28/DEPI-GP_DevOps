import os
from typing import Annotated, Any

from dotenv import load_dotenv
from fastapi import Depends, Header, HTTPException
from jose import JWTError, jwt

load_dotenv()

SECRET_KEY = os.getenv('SECRET_KEY', 'replace-with-a-long-random-development-secret')


def current_user(authorization: Annotated[str | None, Header()] = None) -> dict[str, Any]:
    if not authorization:
        raise HTTPException(status_code=401, detail='Authorization header missing')
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        raise HTTPException(status_code=401, detail='Invalid authorization header')
    try:
        payload = jwt.decode(parts[1], SECRET_KEY, algorithms=['HS256'])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail='Invalid token') from exc
    if not payload.get('id'):
        raise HTTPException(status_code=401, detail='Invalid token')
    return payload


def require_roles(*roles: str):
    def dependency(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        if user.get('role') not in roles:
            raise HTTPException(status_code=403, detail='Insufficient permissions')
        return user

    return dependency
