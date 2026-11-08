# Catalog Service

The Catalog Service is the first independently deployable marketplace service.
It owns categories, vendors' service listings, packages, and catalog images.

## Endpoints

- `GET /health/live`
- `GET /health/ready`
- `GET /categories`
- `GET /services`
- `GET /services/{id}`
- `POST /services` for vendors and administrators
- `POST /services/{id}/packages` for service owners and administrators
- `POST /categories` for administrators

Service listings are created as `draft` and must be approved before they appear
in public search. The current authentication service issues the JWT consumed by
this service.
