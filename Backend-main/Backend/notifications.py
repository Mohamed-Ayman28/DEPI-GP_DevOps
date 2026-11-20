import os
import json
import smtplib
from email.message import EmailMessage
from typing import Any, Dict


def smtp_configured() -> bool:
    return bool(
        os.getenv('SMTP_HOST')
        and os.getenv('SMTP_FROM')
        and os.getenv('SMTP_USERNAME')
        and os.getenv('SMTP_PASSWORD')
    )


def send_booking_email(order: Dict[str, Any], items: list[Dict[str, Any]], status_subject: str | None = None) -> Dict[str, Any]:
    if not smtp_configured():
        return {'delivered': False, 'reason': 'SMTP is not configured'}

    subject = status_subject or f"EventPlanner booking confirmation — {order['reference']}"
    graduation_details = ''
    if order.get('booking_type') == 'graduation':
        holders = order.get('ticket_holders') or '[]'
        try:
            holder_names = ', '.join(json.loads(holders))
        except (TypeError, ValueError):
            holder_names = str(holders)
        graduation_details = (
            f"<p><strong>Tickets:</strong> {order.get('ticket_quantity', 0)}<br>"
            f"<strong>Faculty:</strong> {order.get('faculty', '')}<br>"
            f"<strong>Department:</strong> {order.get('department', '')}<br>"
            f"<strong>Ticket holders:</strong> {holder_names}</p>"
        )
    item_rows = ''.join(
        f"<tr><td>{item['service_name']}</td><td>{item['quantity']}</td>"
        f"<td>${float(item['unit_price']):,.2f}</td><td>${float(item['line_total']):,.2f}</td></tr>"
        for item in items
    )
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#26332e">
      <div style="background:#253b35;color:#fff;padding:24px"><h1 style="margin:0">EventPlanner</h1></div>
      <div style="padding:24px;border:1px solid #e8dfd5">
        <p>Hello {order['customer_name']},</p>
        <p>Your booking has been received.</p>
        <h2>Booking reference: {order['reference']}</h2>
        <p><strong>Event date:</strong> {order['event_date']}<br>
        <strong>Location:</strong> {order['event_location']}<br>
        <strong>Status:</strong> {order['status']}<br>
        <strong>Payment:</strong> {order['payment_status']} ({order['payment_method']})</p>
        {graduation_details}
        <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse">
          <thead><tr style="background:#f8f5f0"><th align="left">Item</th><th>Qty</th><th align="right">Price</th><th align="right">Total</th></tr></thead>
          <tbody>{item_rows}</tbody>
        </table>
        <p align="right">Subtotal: ${float(order['subtotal']):,.2f}<br>
        Discount: ${float(order['discount']):,.2f}<br>
        Tax: ${float(order['tax']):,.2f}<br>
        Fee: ${float(order['fee']):,.2f}<br><strong>Total: ${float(order['total']):,.2f}</strong></p>
        <p>Contact: support@eventplanner.local</p>
      </div>
    </div>
    """

    message = EmailMessage()
    message['Subject'] = subject
    message['From'] = os.getenv('SMTP_FROM')
    message['To'] = order['customer_email']
    message.set_content(f"EventPlanner booking {order['reference']} — total ${float(order['total']):,.2f}")
    message.add_alternative(html, subtype='html')

    try:
        host = os.getenv('SMTP_HOST', '')
        port = int(os.getenv('SMTP_PORT', '587'))
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            if os.getenv('SMTP_USE_TLS', 'true').lower() == 'true':
                smtp.starttls()
            smtp.login(os.getenv('SMTP_USERNAME', ''), os.getenv('SMTP_PASSWORD', ''))
            smtp.send_message(message)
        return {'delivered': True, 'reason': None}
    except Exception as exc:
        return {'delivered': False, 'reason': str(exc)}
