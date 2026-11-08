from pydantic import BaseModel, Field
from typing import Optional, List

class SignupModel(BaseModel):
    name: str
    email: str
    password: str
    phone_number: str
    role: Optional[str] = 'customer'

class LoginModel(BaseModel):
    email: str
    password: str

class AdminLoginModel(BaseModel):
    username: str
    password: str

class EventCreateModel(BaseModel):
    title: str
    description: Optional[str] = ''
    date: str  # YYYY-MM-DD
    time: str  # HH:MM:SS or HH:MM
    location: str
    category_id: Optional[int] = None
    event_type: str = 'Public'
    ticket_price: float = Field(default=0, ge=0)
    max_attendees: Optional[int] = Field(default=None, gt=0)
    registration_deadline: Optional[str] = None
    duration: Optional[str] = None
    status: str = 'Draft'
    featured: bool = False
    tags: Optional[str] = ''

class CategoryModel(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    is_active: bool = True

class InviteModel(BaseModel):
    event_id: int
    user_ids: List[int]

class ResponseModel(BaseModel):
    user_id: int
    status: str  # Going, Maybe, Not Going


# Task models
class TaskCreateModel(BaseModel):
    event_id: int
    title: str
    description: Optional[str] = ''
    due_date: Optional[str] = None  # YYYY-MM-DD
    assigned_to: Optional[int] = None


class TaskUpdateModel(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    assigned_to: Optional[int] = None
    status: Optional[str] = None  # Pending, In Progress, Completed


class TaskModel(BaseModel):
    id: int
    event_id: int
    title: str
    description: Optional[str]
    due_date: Optional[str]
    assigned_to: Optional[int]
    status: str
    created_at: Optional[str]
