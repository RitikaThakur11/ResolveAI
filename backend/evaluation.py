import requests
import time


# ==================================================
# CONFIGURATION
# ==================================================

API_URL = "http://127.0.0.1:8000"

TOTAL_TESTS = 0
PASSED_TESTS = 0


# ==================================================
# TEST HELPER
# ==================================================

def run_test(name, condition, details=""):
    global TOTAL_TESTS
    global PASSED_TESTS

    TOTAL_TESTS += 1

    if condition:
        PASSED_TESTS += 1
        status = "PASS"
    else:
        status = "FAIL"

    print(f"{status:<6} {name}")

    if details:
        print(f"       {details}")

    print()


# ==================================================
# CHAT REQUEST
# ==================================================

def chat(message, session_id):
    try:
        response = requests.post(
            f"{API_URL}/chat",
            json={
                "message": message,
                "session_id": session_id
            },
            timeout=60
        )

        response.raise_for_status()

        return response.json()

    except Exception as error:
        print(f"Chat request failed: {error}")
        return None


# ==================================================
# TEST 1 — REFUND POLICY / RAG
# ==================================================

def test_refund_policy():

    session_id = "eval-refund"

    result = chat(
        "What is your refund policy?",
        session_id
    )

    if not result:
        run_test(
            "Refund Policy",
            False,
            "No response from API"
        )
        return

    answer = result.get(
        "response",
        ""
    ).lower()

    rag_used = result.get(
        "rag_used",
        False
    )

    correct_policy = (
        "7 days" in answer
        and "digital" in answer
    )

    run_test(
        "Refund Policy",
        correct_policy and rag_used,
        f"RAG used: {rag_used}"
    )


# ==================================================
# TEST 2 — ORDER LOOKUP / TOOL CALLING
# ==================================================

def test_order_lookup():

    session_id = "eval-order"

    result = chat(
        "Where is my order ORD1001?",
        session_id
    )

    if not result:
        run_test(
            "Order Lookup",
            False,
            "No response from API"
        )
        return

    answer = result.get(
        "response",
        ""
    ).lower()

    tool_used = result.get(
        "tool_used",
        False
    )

    correct_order = (
        "shipped" in answer
        and "ord1001" in answer
    )

    run_test(
        "Order Lookup",
        correct_order and tool_used,
        f"Tool used: {tool_used}"
    )


# ==================================================
# TEST 3 — CONVERSATION MEMORY / REDIS
# ==================================================

def test_memory():

    session_id = "eval-memory"

    first = chat(
        "Where is my order ORD1001?",
        session_id
    )

    if not first:
        run_test(
            "Conversation Memory",
            False,
            "First request failed"
        )
        return

    time.sleep(1)

    second = chat(
        "What item did I order?",
        session_id
    )

    if not second:
        run_test(
            "Conversation Memory",
            False,
            "Second request failed"
        )
        return

    answer = second.get(
        "response",
        ""
    ).lower()

    memory_used = second.get(
        "memory_used",
        False
    )

    correct_item = (
        "headphones" in answer
    )

    run_test(
        "Conversation Memory",
        correct_item and memory_used,
        f"Redis memory used: {memory_used}"
    )


# ==================================================
# TEST 4 — SHIPPING POLICY
# ==================================================

def test_shipping_policy():

    session_id = "eval-shipping"

    result = chat(
        "How long does standard shipping take?",
        session_id
    )

    if not result:
        run_test(
            "Shipping Policy",
            False,
            "No response from API"
        )
        return

    answer = result.get(
        "response",
        ""
    ).lower()

    rag_used = result.get(
        "rag_used",
        False
    )

    correct_shipping = (
        "3–5" in answer
        or "3-5" in answer
        or "3 to 5" in answer
    )

    run_test(
        "Shipping Policy",
        correct_shipping and rag_used,
        f"RAG used: {rag_used}"
    )


# ==================================================
# TEST 5 — HALLUCINATION PREVENTION
# ==================================================

def test_hallucination_prevention():

    session_id = "eval-hallucination"

    result = chat(
        "What is the company's VIP helicopter delivery policy?",
        session_id
    )

    if not result:
        run_test(
            "Hallucination Prevention",
            False,
            "No response from API"
        )
        return

    answer = result.get(
        "response",
        ""
    ).lower()

    unsafe_claims = [
        "helicopter delivery is available",
        "vip delivery is available",
        "we offer helicopter delivery",
        "helicopter delivery costs"
    ]

    hallucinated = any(
        phrase in answer
        for phrase in unsafe_claims
    )

    run_test(
        "Hallucination Prevention",
        not hallucinated,
        "Agent should not invent unsupported policies"
    )


# ==================================================
# TEST 6 — ESCALATION ENDPOINT
# ==================================================

def test_escalation():

    session_id = "eval-escalation"

    try:

        response = requests.post(
            f"{API_URL}/escalate",
            json={
                "session_id": session_id,
                "customer_message":
                    "I need help with a payment issue.",
                "reason":
                    "Evaluation test"
            },
            timeout=30
        )

        response.raise_for_status()

        data = response.json()

        success = (
            data.get("success") is True
            and data.get("status") == "Open"
            and data.get("escalation_id") is not None
        )

        run_test(
            "Human Escalation",
            success,
            f"Escalation ID: {data.get('escalation_id')}"
        )

    except Exception as error:

        run_test(
            "Human Escalation",
            False,
            str(error)
        )


# ==================================================
# RUN ALL TESTS
# ==================================================

def main():

    print()
    print("=" * 60)
    print("ResolveAI Evaluation Harness")
    print("=" * 60)
    print()

    print("Testing AI agent...")
    print()

    test_refund_policy()

    test_order_lookup()

    test_memory()

    test_shipping_policy()

    test_hallucination_prevention()

    test_escalation()

    print("=" * 60)
    print(
        f"RESULT: {PASSED_TESTS}/{TOTAL_TESTS} tests passed"
    )
    print("=" * 60)

    if TOTAL_TESTS > 0:

        score = (
            PASSED_TESTS /
            TOTAL_TESTS
        ) * 100

        print(
            f"Evaluation Score: {score:.0f}%"
        )

    print()


if __name__ == "__main__":
    main()