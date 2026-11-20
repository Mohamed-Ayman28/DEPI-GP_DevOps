import datetime
import json
import logging
import re
import secrets
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from auth import get_current_user, require_role
from database import get_db
from notifications import send_booking_email

router = APIRouter(prefix='/checkout', tags=['checkout'])
logger = logging.getLogger(__name__)
MONEY = Decimal('0.01')
FEE_RATE = Decimal('0.02')
TAX_RATE = Decimal('0.00')


class CartItemInput(BaseModel):
    service_id: Optional[int] = None
    event_id: Optional[int] = None
    package_id: Optional[int] = None
    quantity: int = Field(default=1, ge=1, le=50)


class CartItemRequest(CartItemInput):
    pass


class CheckoutItem(CartItemInput):
    requirements: str = ''
    service_date: Optional[datetime.date] = None
    service_time: Optional[datetime.time] = None


class CheckoutRequest(BaseModel):
    items: List[CheckoutItem] = Field(min_length=1)
    customer_name: str = Field(min_length=2, max_length=200)
    customer_email: str = Field(min_length=3, max_length=255)
    phone_number: str = Field(min_length=3, max_length=30)
    payment_method: str = 'cash'
    ticket_quantity: Optional[int] = Field(default=None, ge=1, le=3)
    ticket_holders: List[str] = Field(default_factory=list, max_length=3)
    faculty: Optional[str] = Field(default=None, max_length=255)
    department: Optional[str] = Field(default=None, max_length=255)
    instapay_proof_path: Optional[str] = Field(default=None, max_length=1000)
    # Legacy clients may still send these values; they are ignored for service details.
    billing_address: Optional[str] = None
    event_date: Optional[datetime.date] = None
    event_location: Optional[str] = None
    guest_count: Optional[int] = Field(default=None, ge=1, le=100000)
    special_instructions: str = ''
    sandbox_result: str = 'success'
    idempotency_key: str = Field(min_length=8, max_length=100)

    @field_validator('customer_email')
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', value):
            raise ValueError('Enter a valid email address')
        return value

    @field_validator('phone_number')
    @classmethod
    def validate_phone(cls, value: str) -> str:
        value = value.strip()
        if not re.fullmatch(r'\+?[0-9][0-9\s().-]{5,28}[0-9]', value):
            raise ValueError('Enter a valid phone number')
        return value


class StatusRequest(BaseModel):
    status: str


class PaymentStatusRequest(BaseModel):
    payment_status: str


def _customer(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if user.get('role') != 'customer':
        raise HTTPException(status_code=403, detail='Only customer accounts can place bookings')
    return user


def _money(value: Any) -> Decimal:
    return Decimal(str(value)).quantize(MONEY, rounding=ROUND_HALF_UP)


def _date(value: Any) -> str:
    return value.isoformat() if hasattr(value, 'isoformat') else str(value)


def _category_key(value: Any) -> str:
    """Return a stable booking category key from the related database category."""
    normalized = re.sub(r'[^a-z]', '', str(value or '').casefold())
    aliases = {
        'graduation': 'graduation',
        'graduations': 'graduation',
        'engagement': 'engagement',
        'engagements': 'engagement',
        'wedding': 'wedding',
        'weddings': 'wedding',
        'birthday': 'birthday',
        'birthdays': 'birthday',
    }
    return aliases.get(normalized, normalized)


def _serialize_order(order: Dict[str, Any], items: List[Dict[str, Any]]) -> Dict[str, Any]:
    result = dict(order)
    for key in ('subtotal', 'discount', 'fee', 'tax', 'total'):
        result[key] = float(result[key] or 0)
    for key in ('created_at', 'updated_at', 'event_date'):
        if result.get(key):
            result[key] = _date(result[key])
    result['items'] = []
    for item in items:
        row = dict(item)
        row['unit_price'] = float(row['unit_price'])
        row['line_total'] = round(row['unit_price'] * row['quantity'], 2)
        for key in ('service_date', 'service_time'):
            if row.get(key):
                row[key] = _date(row[key])
        result['items'].append(row)
    return result


def _get_cart(cursor: Any, user_id: int) -> int:
    cursor.execute('SELECT id FROM carts WHERE user_id=%s', (user_id,))
    cart = cursor.fetchone()
    if cart:
        return int(cart['id'])
    cursor.execute('INSERT INTO carts (user_id) VALUES (%s)', (user_id,))
    return int(cursor.lastrowid)


def _cart(cursor: Any, user_id: int) -> Dict[str, Any]:
    cart_id = _get_cart(cursor, user_id)
    cursor.execute(
        '''SELECT ci.id, ci.service_id, ci.event_id, ci.package_id, ci.quantity,
                  COALESCE(s.name, e.title) AS name,
                  COALESCE(s.description, e.description, '') AS description,
                  COALESCE(s.location, e.location, '') AS location,
                  COALESCE(s.currency, 'USD') AS currency,
                  COALESCE(s.vendor_id, e.organizer_id) AS vendor_id,
                  COALESCE(vp.business_name, u.name, 'EventPlanner') AS provider_name,
                  COALESCE(sp.price, s.base_price, e.ticket_price, 0) AS unit_price,
                  COALESCE(sp.name, '') AS package_name,
                  COALESCE(sc.name, ec.name, '') AS category_name,
                  s.event_date, s.event_time, s.guest_count, s.included_services,
                  s.decorations, s.additional_facilities, s.event_theme,
                  s.special_instructions,
                  COALESCE(
                    (SELECT si.image_url FROM service_images si
                     WHERE si.service_id=s.id ORDER BY si.sort_order, si.id LIMIT 1),
                    e.cover_image
                  ) AS image_url
           FROM cart_items ci
           LEFT JOIN services s ON s.id=ci.service_id AND s.status='published'
           LEFT JOIN events e ON e.id=ci.event_id AND e.status='Published'
           LEFT JOIN service_packages sp ON sp.id=ci.package_id AND sp.is_active=1
           LEFT JOIN service_categories sc ON sc.id=s.category_id
           LEFT JOIN event_categories ec ON ec.id=e.category_id
           LEFT JOIN vendor_profiles vp ON vp.user_id=s.vendor_id
           LEFT JOIN users u ON u.id=e.organizer_id
           WHERE ci.cart_id=%s
             AND (s.id IS NOT NULL OR e.id IS NOT NULL)
           ORDER BY ci.created_at''',
        (cart_id,),
    )
    items = cursor.fetchall()
    subtotal = sum((_money(row['unit_price']) * int(row['quantity']) for row in items), Decimal('0'))
    return {'id': cart_id, 'items': items, 'subtotal': float(subtotal), 'count': sum(int(row['quantity']) for row in items)}


@router.get('/cart')
def get_cart(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        return _cart(cursor, int(current_user['id']))
    finally:
        cursor.close()
        db.close()


@router.post('/cart/items')
def add_cart_item(
    payload: CartItemRequest,
    current_user: Dict[str, Any] = Depends(_customer),
) -> Dict[str, Any]:
    if bool(payload.service_id) == bool(payload.event_id):
        raise HTTPException(status_code=400, detail='Add exactly one service or event')
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cart_id = _get_cart(cursor, int(current_user['id']))
        if payload.event_id:
            cursor.execute(
                "SELECT id, status FROM events WHERE id=%s",
                (payload.event_id,),
            )
            event = cursor.fetchone()
            if not event or event['status'] != 'Published':
                raise HTTPException(status_code=409, detail='This event is unavailable')
            cursor.execute(
                'SELECT id FROM cart_items WHERE cart_id=%s AND event_id=%s',
                (cart_id, payload.event_id),
            )
            existing = cursor.fetchone()
            if existing:
                cursor.execute(
                    'UPDATE cart_items SET quantity=LEAST(quantity+%s, 50) WHERE id=%s',
                    (payload.quantity, existing['id']),
                )
            else:
                cursor.execute(
                    'INSERT INTO cart_items (cart_id, event_id, quantity) VALUES (%s,%s,%s)',
                    (cart_id, payload.event_id, payload.quantity),
                )
            db.commit()
            return _cart(cursor, int(current_user['id']))
        cursor.execute(
            '''SELECT s.id, s.status, sp.id AS package_id
               FROM services s LEFT JOIN service_packages sp ON sp.id=%s AND sp.service_id=s.id AND sp.is_active=1
               WHERE s.id=%s''',
            (payload.package_id, payload.service_id),
        )
        service = cursor.fetchone()
        if not service or service['status'] != 'published':
            raise HTTPException(status_code=409, detail='This service is unavailable')
        if payload.package_id and not service['package_id']:
            raise HTTPException(status_code=409, detail='This package is unavailable')
        if payload.package_id is None:
            cursor.execute('SELECT id FROM cart_items WHERE cart_id=%s AND service_id=%s AND package_id IS NULL', (cart_id, payload.service_id))
        else:
            cursor.execute('SELECT id FROM cart_items WHERE cart_id=%s AND service_id=%s AND package_id=%s', (cart_id, payload.service_id, payload.package_id))
        existing = cursor.fetchone()
        if existing:
            cursor.execute('UPDATE cart_items SET quantity=LEAST(quantity+%s, 50) WHERE id=%s', (payload.quantity, existing['id']))
        else:
            cursor.execute('INSERT INTO cart_items (cart_id, service_id, package_id, quantity) VALUES (%s,%s,%s,%s)', (cart_id, payload.service_id, payload.package_id, payload.quantity))
        db.commit()
        return _cart(cursor, int(current_user['id']))
    finally:
        cursor.close()
        db.close()


@router.patch('/cart/items/{item_id}')
def update_cart_item(item_id: int, payload: CartItemRequest, current_user: Dict[str, Any] = Depends(_customer)) -> Dict[str, Any]:
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute('''UPDATE cart_items ci JOIN carts c ON c.id=ci.cart_id SET ci.quantity=%s WHERE ci.id=%s AND c.user_id=%s''', (payload.quantity, item_id, current_user['id']))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail='Cart item not found')
        db.commit()
        return _cart(cursor, int(current_user['id']))
    finally:
        cursor.close()
        db.close()


@router.delete('/cart/items/{item_id}')
def remove_cart_item(item_id: int, current_user: Dict[str, Any] = Depends(_customer)) -> Dict[str, Any]:
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute('DELETE ci FROM cart_items ci JOIN carts c ON c.id=ci.cart_id WHERE ci.id=%s AND c.user_id=%s', (item_id, current_user['id']))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail='Cart item not found')
        db.commit()
        return _cart(cursor, int(current_user['id']))
    finally:
        cursor.close()
        db.close()


@router.delete('/cart')
def clear_cart(current_user: Dict[str, Any] = Depends(_customer)) -> Dict[str, Any]:
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute('DELETE ci FROM cart_items ci JOIN carts c ON c.id=ci.cart_id WHERE c.user_id=%s', (current_user['id'],))
        db.commit()
        return _cart(cursor, int(current_user['id']))
    finally:
        cursor.close()
        db.close()


def _load_order(cursor: Any, order_id: int, user: Dict[str, Any]) -> Dict[str, Any]:
    if user.get('role') == 'admin':
        cursor.execute('SELECT o.*, u.name AS account_name FROM orders o JOIN users u ON u.id=o.customer_id WHERE o.id=%s', (order_id,))
    elif user.get('role') == 'vendor':
        cursor.execute('''SELECT DISTINCT o.*, u.name AS account_name
                          FROM orders o JOIN users u ON u.id=o.customer_id
                          JOIN order_items oi ON oi.order_id=o.id
                          WHERE o.id=%s AND oi.provider_id=%s''', (order_id, user['id']))
    else:
        cursor.execute('SELECT * FROM orders WHERE id=%s AND customer_id=%s', (order_id, user['id']))
    order = cursor.fetchone()
    if not order:
        raise HTTPException(status_code=404, detail='Order not found')
    if user.get('role') == 'vendor':
        cursor.execute('SELECT * FROM order_items WHERE order_id=%s AND provider_id=%s ORDER BY id', (order_id, user['id']))
    else:
        cursor.execute('SELECT * FROM order_items WHERE order_id=%s ORDER BY id', (order_id,))
    return _serialize_order(order, cursor.fetchall())


@router.post('/orders', status_code=201)
def create_order(payload: CheckoutRequest, current_user: Dict[str, Any] = Depends(_customer)) -> Dict[str, Any]:
    if payload.payment_method not in ('cash', 'instapay', 'card_sandbox'):
        raise HTTPException(status_code=400, detail='Unsupported payment method')
    if payload.sandbox_result not in ('success', 'failed'):
        raise HTTPException(status_code=400, detail='Invalid sandbox payment result')
    user_id = int(current_user['id'])
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute('SELECT * FROM orders WHERE customer_id=%s AND idempotency_key=%s', (user_id, payload.idempotency_key))
        existing = cursor.fetchone()
        if existing:
            cursor.execute('SELECT * FROM order_items WHERE order_id=%s', (existing['id'],))
            return _serialize_order(existing, cursor.fetchall())
        db.start_transaction()
        validated: List[Dict[str, Any]] = []
        subtotal = Decimal('0')
        currency: Optional[str] = None
        booking_type: Optional[str] = None
        category_name: Optional[str] = None
        booking_ticket_quantity: Optional[int] = None
        snapshots: List[Dict[str, Any]] = []
        for item in payload.items:
            if bool(item.service_id) == bool(item.event_id):
                raise HTTPException(status_code=400, detail='Each booking item must reference exactly one service or event')
            if item.event_id:
                cursor.execute(
                    '''SELECT e.*, e.title AS name, e.organizer_id AS vendor_id,
                              'USD' AS currency, u.name AS provider_name, c.name AS category_name,
                              NULL AS package_name, NULL AS package_price
                       FROM events e LEFT JOIN users u ON u.id=e.organizer_id
                       LEFT JOIN event_categories c ON c.id=e.category_id
                       WHERE e.id=%s''',
                    (item.event_id,),
                )
                service = cursor.fetchone()
                if not service or service['status'] != 'Published':
                    raise HTTPException(status_code=409, detail=f'Event {item.event_id} is unavailable')
                if _category_key(service.get('category_name')) != 'graduation':
                    raise HTTPException(status_code=400, detail='Ticket checkout is only available for graduation events')
                if booking_type == 'service':
                    raise HTTPException(status_code=400, detail='A booking cannot mix services and graduation tickets')
                booking_type = 'graduation'
                category_name = service.get('category_name') or 'Graduations'
                quantity = payload.ticket_quantity or item.quantity
                if quantity < 1 or quantity > 3 or item.quantity != quantity:
                    raise HTTPException(status_code=400, detail='Graduation bookings require between 1 and 3 tickets')
                booking_ticket_quantity = quantity
                if not payload.faculty or not payload.department:
                    raise HTTPException(status_code=422, detail='Faculty and department are required for graduation bookings')
                holders = [name.strip() for name in payload.ticket_holders]
                if len(holders) != quantity or any(not name for name in holders):
                    raise HTTPException(status_code=422, detail='Provide a name for every ticket holder')
                if holders[0].casefold() != payload.customer_name.strip().casefold():
                    raise HTTPException(status_code=422, detail='The primary customer must be Ticket 1')
                price = _money(service['ticket_price'] or 0)
                subtotal += price * quantity
                item.quantity = quantity
                item.service_date = service['date']
                item.service_time = service['time']
                validated.append({'input': item, 'service': service, 'price': price, 'event_id': item.event_id})
                snapshots.append({key: str(value) if isinstance(value, (datetime.date, datetime.time)) else value
                                  for key, value in service.items()
                                  if key in ('id', 'name', 'description', 'date', 'time', 'location',
                                             'ticket_price', 'max_attendees', 'category_name', 'cover_image')})
                continue
            cursor.execute(
                '''SELECT s.id, s.name, s.description, s.vendor_id, s.status, s.base_price, s.currency,
                          s.location, s.event_date, s.event_time, s.guest_count,
                          s.included_services, s.decorations, s.additional_facilities,
                          s.event_theme, s.special_instructions, c.name AS category_name,
                          vp.business_name AS provider_name, sp.name AS package_name, sp.price AS package_price
                   FROM services s LEFT JOIN vendor_profiles vp ON vp.user_id=s.vendor_id
                   LEFT JOIN service_categories c ON c.id=s.category_id
                   LEFT JOIN service_packages sp ON sp.id=%s AND sp.service_id=s.id AND sp.is_active=1
                   WHERE s.id=%s''',
                (item.package_id, item.service_id),
            )
            service = cursor.fetchone()
            if not service or service['status'] != 'published':
                raise HTTPException(status_code=409, detail=f'Service {item.service_id} is unavailable')
            if booking_type == 'graduation':
                raise HTTPException(status_code=400, detail='A booking cannot mix services and graduation tickets')
            booking_type = 'service'
            category_name = service.get('category_name')
            if payload.ticket_quantity is not None or payload.ticket_holders or payload.faculty or payload.department:
                raise HTTPException(status_code=400, detail='Ticket details are only valid for graduation bookings')
            if item.package_id and service['package_name'] is None:
                raise HTTPException(status_code=409, detail=f'Package for service {item.service_id} is unavailable')
            if currency is None:
                currency = str(service['currency'])
            elif currency != str(service['currency']):
                raise HTTPException(status_code=400, detail='All services in one booking must use the same currency')
            price = _money(service['package_price'] if item.package_id else service['base_price'])
            subtotal += price * item.quantity
            item.service_date = service.get('event_date') or payload.event_date or datetime.date.today()
            item.service_time = service.get('event_time')
            snapshots.append({key: str(value) if isinstance(value, (datetime.date, datetime.time)) else value
                              for key, value in service.items()
                              if key in ('id', 'name', 'description', 'location', 'event_date', 'event_time',
                                         'guest_count', 'included_services', 'decorations',
                                         'additional_facilities', 'event_theme', 'special_instructions',
                                         'category_name', 'package_name', 'package_price')})
            validated.append({'input': item, 'service': service, 'price': price})
        if booking_type == 'graduation' and len(validated) != 1:
            raise HTTPException(status_code=400, detail='Graduation checkout accepts one event per booking')
        event_date = validated[0]['input'].service_date if validated else payload.event_date
        event_location = validated[0]['service'].get('location') if validated else payload.event_location
        if not event_date or not event_location:
            raise HTTPException(status_code=409, detail='The selected booking is missing configured event details')
        fee = (subtotal * FEE_RATE).quantize(MONEY, rounding=ROUND_HALF_UP)
        tax = (subtotal * TAX_RATE).quantize(MONEY, rounding=ROUND_HALF_UP)
        total = subtotal + fee + tax
        reference = f"EP-{secrets.token_hex(5).upper()}"
        payment_status = 'paid' if payload.payment_method == 'card_sandbox' and payload.sandbox_result == 'success' else (
            'pending_verification' if payload.payment_method == 'instapay' else 'pending')
        status = 'confirmed' if payment_status == 'paid' else 'pending'
        cursor.execute(
            '''INSERT INTO orders
               (reference, customer_id, status, payment_status, payment_method, subtotal, fee, tax, total,
                customer_name, customer_email, phone_number, billing_address, event_date, event_location,
                guest_count, special_instructions, idempotency_key, booking_type, event_category,
                service_snapshot, ticket_quantity, ticket_holders, faculty, department, instapay_proof_path)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
            (reference, user_id, status, payment_status, payload.payment_method, subtotal, fee, tax, total,
             payload.customer_name, payload.customer_email, payload.phone_number, event_location,
             event_date, event_location, payload.guest_count, payload.special_instructions, payload.idempotency_key,
             booking_type, category_name, json.dumps(snapshots),
             booking_ticket_quantity,
             json.dumps(payload.ticket_holders) if booking_type == 'graduation' else None,
             payload.faculty, payload.department, payload.instapay_proof_path),
        )
        order_id = int(cursor.lastrowid)
        for row in validated:
            item = row['input']
            service = row['service']
            cursor.execute(
                '''INSERT INTO order_items
                   (order_id, service_id, event_id, package_id, provider_id, service_name, package_name, provider_name,
                    unit_price, quantity, requirements, service_date, service_time)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
                (order_id, item.service_id, row.get('event_id'), item.package_id, service['vendor_id'], service['name'],
                 service['package_name'], service['provider_name'], row['price'], item.quantity,
                 item.requirements, item.service_date, item.service_time),
            )
        provider_ref = f'SANDBOX-{reference}' if payload.payment_method == 'card_sandbox' else None
        payment_tx_status = 'paid' if payment_status == 'paid' else ('failed' if payload.sandbox_result == 'failed' else 'pending')
        cursor.execute(
            '''INSERT INTO payment_transactions (order_id, provider, provider_reference, status, amount, failure_reason)
               VALUES (%s,%s,%s,%s,%s,%s)''',
            (order_id, 'sandbox' if payload.payment_method == 'card_sandbox' else payload.payment_method, provider_ref,
             payment_tx_status, total, 'Sandbox payment declined' if payment_tx_status == 'failed' else None),
        )
        cursor.execute(
            '''INSERT INTO admin_notifications (title, message, severity)
               VALUES (%s, %s, %s)''',
            (
                'New booking received',
                f'{payload.customer_name} created booking {reference} for {float(total):.2f}.',
                'success',
            ),
        )
        if payment_tx_status == 'failed':
            cursor.execute('UPDATE orders SET status=%s, payment_status=%s WHERE id=%s', ('pending', 'failed', order_id))
        cursor.execute('DELETE ci FROM cart_items ci JOIN carts c ON c.id=ci.cart_id WHERE c.user_id=%s', (user_id,))
        db.commit()
        created = _load_order(cursor, order_id, current_user)
        email_result = send_booking_email(created, created['items'])
        created['email_status'] = 'sent' if email_result['delivered'] else 'failed'
        created['email_error'] = email_result['reason']
        return created
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.exception('Checkout order creation failed')
        if 'Duplicate entry' in str(exc):
            raise HTTPException(status_code=409, detail='This checkout was already submitted')
        raise HTTPException(status_code=500, detail='Unable to create booking') from exc
    finally:
        cursor.close()
        db.close()


@router.get('/orders')
def list_orders(current_user: Dict[str, Any] = Depends(_customer)) -> List[Dict[str, Any]]:
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute('SELECT * FROM orders WHERE customer_id=%s ORDER BY created_at DESC', (current_user['id'],))
        orders = cursor.fetchall()
        for order in orders:
            cursor.execute('SELECT * FROM order_items WHERE order_id=%s', (order['id'],))
            order = _serialize_order(order, cursor.fetchall())
        return [_load_order(cursor, int(order['id']), current_user) for order in orders]
    finally:
        cursor.close()
        db.close()


@router.get('/orders/{order_id}')
def get_order(order_id: int, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        return _load_order(cursor, order_id, current_user)
    finally:
        cursor.close()
        db.close()


@router.get('/orders/{order_id}/receipt.pdf')
def get_order_receipt(order_id: int, current_user: Dict[str, Any] = Depends(get_current_user)):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        order = _load_order(cursor, order_id, current_user)
    finally:
        cursor.close()
        db.close()

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    pdf.setTitle(f"EventPlanner Receipt {order['reference']}")
    pdf.setFont('Helvetica-Bold', 18)
    pdf.drawString(50, 750, 'EventPlanner')
    pdf.setFont('Helvetica', 11)
    pdf.drawString(50, 730, f"Booking reference: {order['reference']}")
    pdf.drawString(50, 714, f"Customer: {order['customer_name']} ({order['customer_email']})")
    pdf.drawString(50, 698, f"Event date: {order['event_date']} — {order['event_location']}")
    pdf.drawString(50, 682, f"Status: {order['status']} | Payment: {order['payment_status']} ({order['payment_method']})")
    y = 650
    pdf.setFont('Helvetica-Bold', 11)
    pdf.drawString(50, y, 'Selected items')
    pdf.setFont('Helvetica', 10)
    y -= 24
    for item in order['items']:
        pdf.drawString(50, y, f"{item['service_name']} x {item['quantity']}")
        pdf.drawRightString(560, y, f"${item['line_total']:,.2f}")
        y -= 18
    y -= 10
    for label, key in (('Subtotal', 'subtotal'), ('Discount', 'discount'), ('Fee', 'fee'), ('Tax', 'tax'), ('Total', 'total')):
        pdf.setFont('Helvetica-Bold' if label == 'Total' else 'Helvetica', 11)
        pdf.drawString(50, y, label)
        pdf.drawRightString(560, y, f"${order[key]:,.2f}")
        y -= 18
    pdf.save()
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type='application/pdf',
        headers={'Content-Disposition': f"attachment; filename={order['reference']}-receipt.pdf"},
    )


@router.patch('/orders/{order_id}/cancel')
def cancel_order(order_id: int, current_user: Dict[str, Any] = Depends(_customer)) -> Dict[str, Any]:
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("UPDATE orders SET status='cancelled', payment_status=IF(payment_status='paid','refunded',payment_status) WHERE id=%s AND customer_id=%s AND status NOT IN ('completed','cancelled','refunded')", (order_id, current_user['id']))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=409, detail='This booking cannot be cancelled')
        db.commit()
        return _load_order(cursor, order_id, current_user)
    finally:
        cursor.close()
        db.close()


@router.get('/admin/orders')
def admin_orders(
    status: Optional[str] = Query(default=None),
    payment_status: Optional[str] = Query(default=None),
    booking_type: Optional[str] = Query(default=None),
    event_category: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None, max_length=100),
    current_user: Dict[str, Any] = Depends(require_role('admin')),
) -> List[Dict[str, Any]]:
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        where, params = ['1=1'], []
        if status:
            where.append('o.status=%s'); params.append(status)
        if payment_status:
            where.append('o.payment_status=%s'); params.append(payment_status)
        if booking_type:
            where.append('o.booking_type=%s'); params.append(booking_type)
        if event_category:
            where.append('o.event_category=%s'); params.append(event_category)
        if search:
            where.append('(o.reference LIKE %s OR o.customer_name LIKE %s OR o.customer_email LIKE %s)')
            params.extend([f'%{search}%', f'%{search}%', f'%{search}%'])
        cursor.execute(f'SELECT o.*, u.name AS account_name FROM orders o JOIN users u ON u.id=o.customer_id WHERE {" AND ".join(where)} ORDER BY o.created_at DESC', params)
        rows = cursor.fetchall()
        return [_load_order(cursor, int(row['id']), current_user) for row in rows]
    finally:
        cursor.close()


@router.patch('/admin/orders/{order_id}/payment')
def update_admin_payment(
    order_id: int,
    payload: PaymentStatusRequest,
    current_user: Dict[str, Any] = Depends(require_role('admin')),
) -> Dict[str, Any]:
    if payload.payment_status not in ('pending', 'pending_verification', 'paid', 'failed', 'refunded'):
        raise HTTPException(status_code=400, detail='Invalid payment status')
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute('SELECT id, total FROM orders WHERE id=%s', (order_id,))
        order = cursor.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail='Order not found')
        booking_status = 'confirmed' if payload.payment_status == 'paid' else (
            'pending' if payload.payment_status in ('pending', 'pending_verification') else 'cancelled')
        cursor.execute(
            'UPDATE orders SET payment_status=%s, status=%s WHERE id=%s',
            (payload.payment_status, booking_status, order_id),
        )
        cursor.execute(
            '''INSERT INTO admin_notifications (title, message, severity)
               VALUES (%s, %s, %s)''',
            (
                'Booking payment updated',
                f'Payment for booking {order_id} was marked {payload.payment_status}.',
                'info' if payload.payment_status in ('pending', 'pending_verification') else 'success',
            ),
        )
        cursor.execute(
            '''UPDATE payment_transactions
               SET status=%s WHERE order_id=%s AND id=(SELECT id FROM (
                 SELECT id FROM payment_transactions WHERE order_id=%s ORDER BY id DESC LIMIT 1
               ) latest)''',
            (payload.payment_status if payload.payment_status != 'pending_verification' else 'pending',
             order_id, order_id),
        )
        db.commit()
        updated = _load_order(cursor, order_id, current_user)
        email_result = send_booking_email(updated, updated['items'], f"EventPlanner payment update — {updated['reference']}")
        updated['email_status'] = 'sent' if email_result['delivered'] else 'failed'
        updated['email_error'] = email_result['reason']
        return updated
    finally:
        cursor.close()
        db.close()


@router.delete('/admin/orders/{order_id}')
def delete_admin_order(
    order_id: int,
    current_user: Dict[str, Any] = Depends(require_role('admin')),
) -> Dict[str, Any]:
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute('SELECT id, reference FROM orders WHERE id=%s', (order_id,))
        order = cursor.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail='Booking not found')

        db.start_transaction()
        cursor.execute('DELETE FROM orders WHERE id=%s', (order_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail='Booking not found')
        cursor.execute(
            '''INSERT INTO admin_notifications (title, message, severity)
               VALUES (%s, %s, %s)''',
            (
                'Booking deleted',
                f'Administrator deleted booking {order["reference"]}.',
                'warning',
            ),
        )
        db.commit()
        return {'deleted': True, 'id': order_id}
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.exception('Admin booking deletion failed')
        raise HTTPException(status_code=500, detail='Unable to delete booking') from exc
    finally:
        cursor.close()
        db.close()


@router.patch('/admin/orders/{order_id}')
def update_admin_order(order_id: int, payload: StatusRequest, current_user: Dict[str, Any] = Depends(require_role('admin'))) -> Dict[str, Any]:
    allowed = {'pending', 'awaiting_payment', 'paid', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded'}
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail='Invalid booking status')
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute('UPDATE orders SET status=%s, payment_status=IF(%s=%s, %s, payment_status) WHERE id=%s', (payload.status, payload.status, 'refunded', 'refunded', order_id))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail='Order not found')
        db.commit()
        updated = _load_order(cursor, order_id, current_user)
        email_result = send_booking_email(
            updated,
            updated['items'],
            f"EventPlanner booking update — {updated['reference']}",
        )
        updated['email_status'] = 'sent' if email_result['delivered'] else 'failed'
        updated['email_error'] = email_result['reason']
        return updated
    finally:
        cursor.close()
        db.close()


@router.post('/admin/orders/{order_id}/resend-email')
def resend_order_email(order_id: int, current_user: Dict[str, Any] = Depends(require_role('admin'))) -> Dict[str, Any]:
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        order = _load_order(cursor, order_id, current_user)
    finally:
        cursor.close()
        db.close()
    email_result = send_booking_email(order, order['items'])
    if not email_result['delivered']:
        raise HTTPException(status_code=502, detail=f"Confirmation email could not be delivered: {email_result['reason']}")
    return {'reference': order['reference'], 'email_status': 'sent'}


@router.get('/provider/orders')
def provider_orders(current_user: Dict[str, Any] = Depends(require_role('vendor'))) -> List[Dict[str, Any]]:
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute('''SELECT DISTINCT o.* FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE oi.provider_id=%s ORDER BY o.created_at DESC''', (current_user['id'],))
        return [_load_order(cursor, int(row['id']), current_user) for row in cursor.fetchall()]
    finally:
        cursor.close()
        db.close()


@router.patch('/provider/orders/{order_id}')
def update_provider_order(
    order_id: int,
    payload: StatusRequest,
    current_user: Dict[str, Any] = Depends(require_role('vendor')),
) -> Dict[str, Any]:
    if payload.status not in ('in_progress', 'completed', 'cancelled'):
        raise HTTPException(status_code=400, detail='Providers may only update service progress')
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            '''UPDATE orders o JOIN order_items oi ON oi.order_id=o.id
               SET o.status=%s
               WHERE o.id=%s AND oi.provider_id=%s AND o.status NOT IN ('cancelled','refunded')''',
            (payload.status, order_id, current_user['id']),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail='Provider booking not found')
        db.commit()
        return _load_order(cursor, order_id, current_user)
    finally:
        cursor.close()
        db.close()
