USE event_planner;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role ENUM('customer', 'vendor', 'admin') NOT NULL DEFAULT 'customer';
