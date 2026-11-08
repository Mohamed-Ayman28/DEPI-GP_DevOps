-- Local development bootstrap. Production migrations will be managed separately.
CREATE DATABASE IF NOT EXISTS event_planner;
USE event_planner;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    role ENUM('customer', 'vendor', 'admin') NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Local development administrator: username admin, password admin123.
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

INSERT IGNORE INTO event_categories (name) VALUES
('Weddings'), ('Birthdays'), ('Corporate Events'), ('Graduations'),
('Baby Showers'), ('Engagements'), ('Private Parties'), ('Special Events');

INSERT IGNORE INTO service_categories (name) VALUES
('Venues'), ('Decoration'), ('Catering'), ('Photography'),
('Entertainment'), ('Invitations'), ('Furniture'), ('Event Planning');

CREATE TABLE IF NOT EXISTS events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    time TIME NOT NULL,
    location VARCHAR(255) NOT NULL,
    organizer_id INT NOT NULL,
    category_id INT NULL,
    cover_image VARCHAR(500) NULL,
    event_type ENUM('Public', 'Private') NOT NULL DEFAULT 'Public',
    ticket_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_attendees INT NULL,
    registration_deadline DATE NULL,
    duration VARCHAR(50) NULL,
    status ENUM('Draft', 'Published', 'Cancelled') NOT NULL DEFAULT 'Draft',
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    tags TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_attendees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('organizer', 'attendee') DEFAULT 'attendee',
    status ENUM('Going', 'Maybe', 'Not Going') DEFAULT 'Maybe',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_event_attendee (event_id, user_id),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE,
    assigned_to INT NULL,
    status ENUM('Pending', 'In Progress', 'Completed') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);
