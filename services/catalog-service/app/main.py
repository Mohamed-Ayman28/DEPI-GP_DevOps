from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from mysql.connector import MySQLConnection

from .auth import require_roles
from .database import get_db
from .schemas import CategoryCreate, PackageCreate, ServiceCreate

app = FastAPI(title='EventPlanner Catalog Service', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
                       c.name AS category_name
                FROM services s
                JOIN service_categories c ON c.id=s.category_id
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
            '''SELECT s.*, c.name AS category_name
               FROM services s JOIN service_categories c ON c.id=s.category_id
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
               (vendor_id, category_id, name, description, base_price, currency, location, status)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)''',
            (
                user['id'],
                payload.category_id,
                payload.name,
                payload.description,
                payload.base_price,
                payload.currency,
                payload.location,
                'draft',
            ),
        )
        db.commit()
        return {'id': cursor.lastrowid, 'status': 'draft', **payload.model_dump()}
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
