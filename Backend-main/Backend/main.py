import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from routers import admin, users, events, responses, search, tasks, checkout

load_dotenv()

app = FastAPI(title='EventPlanner API')
Path(os.getenv('UPLOAD_DIR', '/app/uploads')).mkdir(parents=True, exist_ok=True)
app.mount('/uploads', StaticFiles(directory=os.getenv('UPLOAD_DIR', '/app/uploads')), name='uploads')
from fastapi.middleware.cors import CORSMiddleware

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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(users.router, prefix='', tags=['users'])
app.include_router(admin.router, tags=['admin'])
app.include_router(events.router, prefix='/events', tags=['events'])
app.include_router(responses.router, prefix='/responses', tags=['responses'])
app.include_router(search.router, prefix='/search', tags=['search'])
app.include_router(tasks.router, prefix='/tasks', tags=['tasks'])
app.include_router(checkout.router)

@app.get('/')
def root():
    return {'status': 'EventPlanner API running'}


@app.get('/health/live')
def liveness():
    return {'status': 'ok'}


@app.get('/health/ready')
def readiness():
    from database import get_db

    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute('SELECT 1')
        cursor.fetchone()
        return {'status': 'ready'}
    finally:
        cursor.close()
        db.close()
