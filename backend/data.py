orders = {
    "ORD1001": {
        "customer": "Aarav",
        "status": "Shipped",
        "item": "Wireless Headphones",
        "amount": 2499,
        "expected_delivery": "September 12, 2026"
    },
    "ORD1002": {
        "customer": "Riya",
        "status": "Processing",
        "item": "Mechanical Keyboard",
        "amount": 5499,
        "expected_delivery": "September 15, 2026"
    },
    "ORD1003": {
        "customer": "Karan",
        "status": "Delivered",
        "item": "Smart Watch",
        "amount": 3999,
        "expected_delivery": "September 8, 2026"
    },
    "ORD1004": {
        "customer": "Neha",
        "status": "Cancelled",
        "item": "USB-C Hub",
        "amount": 1299,
        "expected_delivery": "Cancelled"
    }
}


def get_order(order_id: str):
    return orders.get(order_id)