USE event_planner;

-- Admin users are provisioned by an authorized backend/database operator.
ALTER TABLE users
    MODIFY COLUMN role ENUM('customer', 'vendor', 'admin') NOT NULL DEFAULT 'customer';

-- Development administrator: username admin, password admin123.
INSERT INTO users (name, email, password, phone_number, role)
SELECT 'Admin', 'admin', '$2b$12$qJtT5h.YCb4a2/9K5UsByO8W7E2oh3ftIZj1QlFeHYg1RsFQRLxh6', '0000000000', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin');

CREATE TABLE IF NOT EXISTS event_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE events ADD COLUMN category_id INT NULL;
ALTER TABLE events ADD COLUMN cover_image VARCHAR(500) NULL;
ALTER TABLE events ADD COLUMN event_type ENUM('Public', 'Private') NOT NULL DEFAULT 'Public';
ALTER TABLE events ADD COLUMN ticket_price DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN max_attendees INT NULL;
ALTER TABLE events ADD COLUMN registration_deadline DATE NULL;
ALTER TABLE events ADD COLUMN duration VARCHAR(50) NULL;
ALTER TABLE events ADD COLUMN status ENUM('Draft', 'Published', 'Cancelled') NOT NULL DEFAULT 'Draft';
ALTER TABLE events ADD COLUMN featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN tags TEXT NULL;

INSERT IGNORE INTO event_categories (name) VALUES
('Weddings'), ('Birthdays'), ('Corporate Events'), ('Graduations'),
('Baby Showers'), ('Engagements'), ('Private Parties'), ('Special Events');

INSERT IGNORE INTO service_categories (name) VALUES
('Venues'), ('Decoration'), ('Catering'), ('Photography'),
('Entertainment'), ('Invitations'), ('Furniture'), ('Event Planning');
