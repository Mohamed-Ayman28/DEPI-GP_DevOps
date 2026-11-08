from decimal import Decimal

from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str = Field(default='', max_length=1000)


class PackageCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: str = Field(default='', max_length=2000)
    price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    currency: str = Field(default='USD', min_length=3, max_length=3)


class ServiceCreate(BaseModel):
    category_id: int
    name: str = Field(min_length=2, max_length=200)
    description: str = Field(min_length=1, max_length=5000)
    base_price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    currency: str = Field(default='USD', min_length=3, max_length=3)
    location: str = Field(min_length=2, max_length=255)

