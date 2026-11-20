from typing import Annotated, Any
import os
import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from mysql.connector import MySQLConnection

from .auth import require_roles
from .database import get_db
from .schemas import CategoryCreate, PackageCreate, ServiceCreate

app = FastAPI(title='EventPlanner Catalog Service', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            'CORS_ORIGINS',
            'http://localhost:4200,http://localhost:8080',
        ).split(',')
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

Database = Annotated[MySQLConnection, Depends(get_db)]


@app.get('/health/live')
def liveness() -> dict[str, str]:
    return {'status': 'ok'}


@app.get('/health/ready')
def readiness(db: Database) -> dict[str, str]:
    cursor = db.cursor()
    try:
        cursor.execute('SELECT 1')
        cursor.fetchone()
        return {'status': 'ready'}
    finally:
        cursor.close()


@app.get('/categories')
def list_categories(db: Database) -> list[dict[str, Any]]:
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            'SELECT id, name, description FROM service_categories '
            'WHERE is_active=1 ORDER BY name'
        )
        return cursor.fetchall()
    finally:
        cursor.close()


@app.post('/categories', status_code=201)
def create_category(
    payload: CategoryCreate,
    db: Database,
    _admin: dict[str, Any] = Depends(require_roles('admin')),
) -> dict[str, Any]:
    cursor = db.cursor()
    try:
        cursor.execute(
            'INSERT INTO service_categories (name, description) VALUES (%s, %s)',
            (payload.name, payload.description),
        )
        db.commit()
        return {'id': cursor.lastrowid, **payload.model_dump()}
    finally:
        cursor.close()


@app.get('/services')
def list_services(
    db: Database,
    category_id: int | None = None,
    vendor_id: int | None = None,
    q: str | None = Query(default=None, min_length=1, max_length=100),
    min_price: float | None = Query(default=None, ge=0),
    max_price: float | None = Query(default=None, ge=0),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    clauses = ["s.status='published'"]
    params: list[Any] = []
    if category_id is not None:
        clauses.append('s.category_id=%s')
        params.append(category_id)
    if vendor_id is not None:
        clauses.append('s.vendor_id=%s')
        params.append(vendor_id)
    if q:
        clauses.append('(s.name LIKE %s OR s.description LIKE %s)')
        params.extend([f'%{q}%', f'%{q}%'])
    if min_price is not None:
        clauses.append('s.base_price >= %s')
        params.append(min_price)
    if max_price is not None:
        clauses.append('s.base_price <= %s')
        params.append(max_price)

    offset = (page - 1) * page_size
    where = ' AND '.join(clauses)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            f'''SELECT s.id, s.vendor_id, s.category_id, s.name, s.description,
                       s.base_price, s.currency, s.location, s.created_at,
                       c.name AS category_name, u.name AS provider_name,
                       vp.business_name AS provider_business_name,
                       vp.phone_number AS provider_phone,
                       (SELECT si.image_url FROM service_images si
                        WHERE si.service_id=s.id ORDER BY si.sort_order, si.id LIMIT 1) AS image_url
                FROM services s
                JOIN service_categories c ON c.id=s.category_id
                JOIN users u ON u.id=s.vendor_id
                LEFT JOIN vendor_profiles vp ON vp.user_id=s.vendor_id
                WHERE {where}
                ORDER BY s.created_at DESC
                LIMIT %s OFFSET %s''',
            (*params, page_size, offset),
        )
        return {'results': cursor.fetchall(), 'page': page, 'page_size': page_size}
    finally:
        cursor.close()


@app.get('/services/{service_id}')
def get_service(service_id: int, db: Database) -> dict[str, Any]:
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            '''SELECT s.*, c.name AS category_name, u.name AS provider_name,
                      vp.business_name AS provider_business_name,
                      vp.phone_number AS provider_phone,
                      (SELECT si.image_url FROM service_images si
                       WHERE si.service_id=s.id ORDER BY si.sort_order, si.id LIMIT 1) AS image_url
               FROM services s JOIN service_categories c ON c.id=s.category_id
               JOIN users u ON u.id=s.vendor_id
               LEFT JOIN vendor_profiles vp ON vp.user_id=s.vendor_id
               WHERE s.id=%s AND s.status='published' ''',
            (service_id,),
        )
        service = cursor.fetchone()
        if not service:
            raise HTTPException(status_code=404, detail='Service not found')
        cursor.execute(
            'SELECT id, name, description, price, currency '
            'FROM service_packages WHERE service_id=%s AND is_active=1 ORDER BY price',
            (service_id,),
        )
        service['packages'] = cursor.fetchall()
        cursor.execute(
            'SELECT image_url FROM service_images '
            'WHERE service_id=%s ORDER BY sort_order, id',
            (service_id,),
        )
        image_rows = cursor.fetchall()
        service['image_urls'] = [row['image_url'] for row in image_rows]
        if not service.get('image_url') and service['image_urls']:
            service['image_url'] = service['image_urls'][0]
        return service
    finally:
        cursor.close()


@app.post('/services', status_code=201)
def create_service(
    payload: ServiceCreate,
    db: Database,
    user: dict[str, Any] = Depends(require_roles('vendor', 'admin')),
) -> dict[str, Any]:
    cursor = db.cursor()
    try:
        cursor.execute(
            '''INSERT INTO services
               (vendor_id, category_id, name, description, base_price, currency, location, status,
                event_date, event_time, guest_count, included_services, decorations,
                additional_facilities, event_theme, special_instructions)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)''',
            (
                user['id'],
                payload.category_id,
                payload.name,
                payload.description,
                payload.base_price,
                payload.currency,
                payload.location,
                'draft',
                payload.event_date,
                payload.event_time,
                payload.guest_count,
                payload.included_services,
                payload.decorations,
                payload.additional_facilities,
                payload.event_theme,
                payload.special_instructions,
            ),
        )
        db.commit()
        return {'id': cursor.lastrowid, 'status': 'draft', **payload.model_dump()}
    finally:
        cursor.close()


@app.post('/services/{service_id}/images', status_code=201)
def upload_service_images(
    service_id: int,
    images: list[UploadFile] = File(...),
    db: Database = None,
    user: dict[str, Any] = Depends(require_roles('vendor', 'admin')),
) -> dict[str, Any]:
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute('SELECT vendor_id FROM services WHERE id=%s', (service_id,))
        service = cursor.fetchone()
        if not service:
            raise HTTPException(status_code=404, detail='Service not found')
        if user.get('role') != 'admin' and int(service['vendor_id']) != int(user['id']):
            raise HTTPException(status_code=403, detail='Only the service owner can add images')

        allowed = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
        upload_dir = Path(os.getenv('UPLOAD_DIR', '/app/uploads'))
        upload_dir.mkdir(parents=True, exist_ok=True)
        uploaded: list[str] = []
        cursor.execute(
            'SELECT COALESCE(MAX(sort_order), -1) AS max_order '
            'FROM service_images WHERE service_id=%s',
            (service_id,),
        )
        next_order = int(cursor.fetchone()['max_order']) + 1

        for image in images:
            if image.content_type not in allowed:
                raise HTTPException(status_code=400, detail='Only JPG, PNG, WEBP, and GIF images are allowed')
            extension = Path(image.filename or '').suffix.lower() or '.jpg'
            if extension not in {'.jpg', '.jpeg', '.png', '.webp', '.gif'}:
                extension = '.jpg'
            filename = f'{uuid.uuid4().hex}{extension}'
            target = upload_dir / filename
            with target.open('wb') as output:
                output.write(image.file.read())
            image_url = f'/uploads/{filename}'
            cursor.execute(
                'INSERT INTO service_images (service_id, image_url, sort_order) '
                'VALUES (%s, %s, %s)',
                (service_id, image_url, next_order),
            )
            next_order += 1
            uploaded.append(image_url)

        db.commit()
        return {'service_id': service_id, 'image_urls': uploaded}
    except HTTPException:
        db.rollback()
        raise
    finally:
        cursor.close()


@app.post('/services/{service_id}/packages', status_code=201)
def create_package(
    service_id: int,
    payload: PackageCreate,
    db: Database,
    user: dict[str, Any] = Depends(require_roles('vendor', 'admin')),
) -> dict[str, Any]:
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute('SELECT vendor_id FROM services WHERE id=%s', (service_id,))
        service = cursor.fetchone()
        if not service:
            raise HTTPException(status_code=404, detail='Service not found')
        if user.get('role') != 'admin' and service['vendor_id'] != int(user['id']):
            raise HTTPException(status_code=403, detail='Only the service owner can add packages')
        cursor.execute(
            '''INSERT INTO service_packages
               (service_id, name, description, price, currency)
               VALUES (%s, %s, %s, %s, %s)''',
            (service_id, payload.name, payload.description, payload.price, payload.currency),
        )
        db.commit()
        return {'id': cursor.lastrowid, 'service_id': service_id, **payload.model_dump()}
    finally:
        cursor.close()
