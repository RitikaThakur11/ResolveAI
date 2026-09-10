CREATE DATABASE IF NOT EXISTS resolveai;

USE resolveai;

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(20) UNIQUE NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    item VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    expected_delivery DATE
);

-- Sample orders
INSERT IGNORE INTO orders
(order_id, customer_name, item, amount, status, expected_delivery)
VALUES
('ORD1001', 'Aarav', 'Wireless Headphones', 2499.00, 'Shipped', '2026-09-12'),
('ORD1002', 'Riya', 'Mechanical Keyboard', 5499.00, 'Processing', '2026-09-15'),
('ORD1003', 'Karan', 'Smart Watch', 3999.00, 'Delivered', '2026-09-08'),
('ORD1004', 'Neha', 'USB-C Hub', 1299.00, 'Cancelled', NULL);

-- Human escalation table
CREATE TABLE IF NOT EXISTS support_escalations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    customer_message TEXT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'Open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Existing escalation records
INSERT INTO support_escalations
(session_id, customer_message, reason, status)
VALUES
('test-session', 'charged twice', 'Payment issue requires human review', 'Open'),
('eval-escalation', 'payment issue', 'Evaluation test', 'Open');