import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from routers import admin, users, events, responses, search, tasks

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
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(users.router, prefix='', tags=['users'])
app.include_router(admin.router, tags=['admin'])
app.include_router(events.router, prefix='/events', tags=['events'])
app.include_router(responses.router, prefix='/responses', tags=['responses'])
app.include_router(search.router, prefix='/search', tags=['search'])
app.include_router(tasks.router, prefix='/tasks', tags=['tasks'])

@app.get('/')
def root():
    return {'status': 'EventPlanner API running'}
