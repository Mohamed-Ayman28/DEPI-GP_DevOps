USE event_planner;

CREATE TABLE IF NOT EXISTS carts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cart_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cart_id INT NOT NULL,
    service_id INT NOT NULL,
    package_id INT NULL,
    quantity INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cart_service_package (cart_id, service_id, package_id),
    FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    FOREIGN KEY (package_id) REFERENCES service_packages(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reference VARCHAR(32) NOT NULL UNIQUE,
    customer_id INT NOT NULL,
    status ENUM('pending', 'awaiting_payment', 'paid', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded')
        NOT NULL DEFAULT 'awaiting_payment',
    payment_status ENUM('pending', 'paid', 'failed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
    payment_method ENUM('card_sandbox', 'cash') NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) NOT NULL DEFAULT 0,
    fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    customer_name VARCHAR(200) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(30) NOT NULL,
    billing_address VARCHAR(500) NOT NULL,
    event_date DATE NOT NULL,
    event_location VARCHAR(500) NOT NULL,
    guest_count INT NULL,
    special_instructions TEXT,
    idempotency_key VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_order_customer_idempotency (customer_id, idempotency_key),
    INDEX idx_orders_customer (customer_id, created_at),
    INDEX idx_orders_status (status, payment_status),
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    service_id INT NOT NULL,
    package_id INT NULL,
    provider_id INT NOT NULL,
    service_name VARCHAR(200) NOT NULL,
    package_name VARCHAR(150),
    provider_name VARCHAR(200),
    unit_price DECIMAL(12,2) NOT NULL,
    quantity INT NOT NULL,
    requirements TEXT,
    service_date DATE NOT NULL,
    service_time TIME NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id),
    FOREIGN KEY (package_id) REFERENCES service_packages(id) ON DELETE SET NULL,
    FOREIGN KEY (provider_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payment_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    provider VARCHAR(40) NOT NULL,
    provider_reference VARCHAR(100),
    status ENUM('pending', 'paid', 'failed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
    amount DECIMAL(12,2) NOT NULL,
    failure_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_payment_provider_reference (provider, provider_reference),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

SET @guest_count_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'guest_count'
);
SET @guest_count_sql := IF(
    @guest_count_exists = 0,
    'ALTER TABLE orders ADD COLUMN guest_count INT NULL AFTER event_location',
    'SELECT 1'
);
PREPARE guest_count_statement FROM @guest_count_sql;
EXECUTE guest_count_statement;
DEALLOCATE PREPARE guest_count_statement;
