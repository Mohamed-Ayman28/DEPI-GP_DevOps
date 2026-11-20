USE event_planner;

ALTER TABLE services
    ADD COLUMN event_date DATE NULL,
    ADD COLUMN event_time TIME NULL,
    ADD COLUMN guest_count INT NULL,
    ADD COLUMN included_services TEXT NULL,
    ADD COLUMN decorations TEXT NULL,
    ADD COLUMN additional_facilities TEXT NULL,
    ADD COLUMN event_theme VARCHAR(255) NULL,
    ADD COLUMN special_instructions TEXT NULL;

ALTER TABLE orders
    ADD COLUMN booking_type ENUM('service', 'graduation') NOT NULL DEFAULT 'service',
    ADD COLUMN event_category VARCHAR(100) NULL,
    ADD COLUMN service_snapshot LONGTEXT NULL,
    ADD COLUMN ticket_quantity INT NULL,
    ADD COLUMN ticket_holders LONGTEXT NULL,
    ADD COLUMN faculty VARCHAR(255) NULL,
    ADD COLUMN department VARCHAR(255) NULL,
    ADD COLUMN instapay_proof_path VARCHAR(1000) NULL;

ALTER TABLE orders MODIFY payment_method ENUM('cash', 'instapay', 'card_sandbox') NOT NULL;
ALTER TABLE orders MODIFY payment_status ENUM('pending', 'pending_verification', 'paid', 'failed', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending';
