USE event_planner;

SET @cart_event_column := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'cart_items' AND column_name = 'event_id'
);
SET @cart_event_sql := IF(
    @cart_event_column = 0,
    'ALTER TABLE cart_items ADD COLUMN event_id INT NULL AFTER service_id',
    'SELECT 1'
);
PREPARE cart_event_statement FROM @cart_event_sql;
EXECUTE cart_event_statement;
DEALLOCATE PREPARE cart_event_statement;

SET @cart_event_unique := (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'cart_items' AND index_name = 'uq_cart_event'
);
SET @cart_event_unique_sql := IF(
    @cart_event_unique = 0,
    'ALTER TABLE cart_items ADD UNIQUE KEY uq_cart_event (cart_id, event_id)',
    'SELECT 1'
);
PREPARE cart_event_unique_statement FROM @cart_event_unique_sql;
EXECUTE cart_event_unique_statement;
DEALLOCATE PREPARE cart_event_unique_statement;

SET @cart_event_fk := (
    SELECT COUNT(*) FROM information_schema.referential_constraints
    WHERE constraint_schema = DATABASE() AND table_name = 'cart_items' AND constraint_name = 'fk_cart_event'
);
SET @cart_event_fk_sql := IF(
    @cart_event_fk = 0,
    'ALTER TABLE cart_items ADD CONSTRAINT fk_cart_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE',
    'SELECT 1'
);
PREPARE cart_event_fk_statement FROM @cart_event_fk_sql;
EXECUTE cart_event_fk_statement;
DEALLOCATE PREPARE cart_event_fk_statement;

ALTER TABLE cart_items MODIFY service_id INT NULL;

SET @order_event_column := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'order_items' AND column_name = 'event_id'
);
SET @order_event_sql := IF(
    @order_event_column = 0,
    'ALTER TABLE order_items ADD COLUMN event_id INT NULL AFTER service_id',
    'SELECT 1'
);
PREPARE order_event_statement FROM @order_event_sql;
EXECUTE order_event_statement;
DEALLOCATE PREPARE order_event_statement;

ALTER TABLE order_items MODIFY service_id INT NULL;
ALTER TABLE order_items MODIFY provider_id INT NULL;

SET @order_event_fk := (
    SELECT COUNT(*) FROM information_schema.referential_constraints
    WHERE constraint_schema = DATABASE() AND table_name = 'order_items' AND constraint_name = 'fk_order_event'
);
SET @order_event_fk_sql := IF(
    @order_event_fk = 0,
    'ALTER TABLE order_items ADD CONSTRAINT fk_order_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE order_event_fk_statement FROM @order_event_fk_sql;
EXECUTE order_event_fk_statement;
DEALLOCATE PREPARE order_event_fk_statement;
