import os
import json

from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel

from google import genai
from google.genai import types
from google.genai import errors

import redis

from database import get_db_connection

from rag import (
    index_knowledge_base,
    get_policy_context
)


# ==================================================
# ENVIRONMENT
# ==================================================

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError(
        "GEMINI_API_KEY is missing from .env"
    )

client = genai.Client(
    api_key=api_key
)


# ==================================================
# REDIS
# ==================================================

redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    decode_responses=True
)


def check_redis():

    try:

        redis_client.ping()

        print("ResolveAI Redis connected")

        return True

    except Exception as error:

        print("Redis connection failed:")
        print(error)

        return False


# ==================================================
# FASTAPI
# ==================================================

app = FastAPI(
    title="ResolveAI API"
)


app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


# ==================================================
# REQUEST MODEL
# ==================================================

class ChatRequest(BaseModel):

    message: str

    session_id: str = "default-session"


# ==================================================
# ORDER LOOKUP
# ==================================================

def order_lookup(order_id: str):

    db = get_db_connection()

    cursor = db.cursor(
        dictionary=True
    )

    query = """
        SELECT
            order_id,
            customer_name,
            item,
            amount,
            status,
            expected_delivery
        FROM orders
        WHERE order_id = %s
    """

    cursor.execute(
        query,
        (order_id,)
    )

    order = cursor.fetchone()

    cursor.close()

    db.close()

    if not order:

        return {
            "found": False,
            "message":
                f"Order {order_id} was not found."
        }

    # Convert MySQL values to JSON-safe values

    order["amount"] = float(
        order["amount"]
    )

    if order["expected_delivery"]:

        order["expected_delivery"] = (
            order["expected_delivery"].isoformat()
        )

    return {
        "found": True,
        "order": order
    }


# ==================================================
# REDIS MEMORY
# ==================================================

def get_memory(session_id: str):

    key = f"resolveai:conversation:{session_id}"

    history = redis_client.lrange(
        key,
        0,
        -1
    )

    messages = []

    for item in history:

        try:

            messages.append(
                json.loads(item)
            )

        except Exception:

            continue

    return messages


def save_memory(
    session_id: str,
    role: str,
    text: str
):

    key = f"resolveai:conversation:{session_id}"

    message = {
        "role": role,
        "text": text
    }

    redis_client.rpush(
        key,
        json.dumps(message)
    )

    # Keep only latest 12 messages

    redis_client.ltrim(
        key,
        -12,
        -1
    )

    # Keep conversation for 24 hours

    redis_client.expire(
        key,
        86400
    )


def clear_memory(session_id: str):

    key = f"resolveai:conversation:{session_id}"

    redis_client.delete(key)


# ==================================================
# GEMINI TOOL
# ==================================================

order_lookup_tool = types.Tool(

    function_declarations=[

        types.FunctionDeclaration(

            name="order_lookup",

            description=(
                "Look up a customer's order "
                "using the order ID."
            ),

            parameters=types.Schema(

                type=types.Type.OBJECT,

                properties={

                    "order_id": types.Schema(

                        type=types.Type.STRING,

                        description=(
                            "Order ID such as ORD1001"
                        )
                    )
                },

                required=[
                    "order_id"
                ]
            )
        )
    ]
)


# ==================================================
# GEMINI ERROR HANDLER
# ==================================================

def handle_gemini_error(error):

    print("Gemini API error:")
    print(error)

    if isinstance(error, errors.ClientError):

        if error.code == 429:

            raise HTTPException(

                status_code=429,

                detail={
                    "success": False,

                    "error": "AI_QUOTA_EXCEEDED",

                    "message": (
                        "The AI service is temporarily "
                        "unavailable because the Gemini "
                        "API quota has been reached. "
                        "Please try again later or "
                        "contact human support."
                    )
                }
            )

    raise HTTPException(

        status_code=500,

        detail={
            "success": False,

            "error": "AI_SERVICE_ERROR",

            "message":
                "The AI service is temporarily unavailable."
        }
    )


# ==================================================
# STARTUP
# ==================================================

@app.on_event("startup")
def startup_event():

    check_redis()

    try:

        count = index_knowledge_base()

        print(
            f"ResolveAI Knowledge Base ready: "
            f"{count} chunks"
        )

    except Exception as error:

        print(
            "Knowledge base initialization failed:"
        )

        print(error)


# ==================================================
# BASIC ROUTES
# ==================================================

@app.get("/")
def root():

    return {
        "message":
            "ResolveAI backend is running!"
    }


@app.get("/health")
def health():

    redis_status = check_redis()

    return {

        "status": "healthy",

        "redis":
            "connected"
            if redis_status
            else "disconnected"

    }


# ==================================================
# ORDERS
# ==================================================

@app.get("/orders/{order_id}")
def get_order(order_id: str):

    return order_lookup(order_id)


# ==================================================
# ESCALATION
# ==================================================

class EscalationRequest(BaseModel):

    session_id: str

    customer_message: str

    reason: str = (
        "AI unable to confidently resolve"
    )


@app.post("/escalate")
def escalate_support(
    request: EscalationRequest
):

    connection = get_db_connection()

    cursor = connection.cursor()

    query = """
        INSERT INTO support_escalations
        (session_id, customer_message, reason, status)
        VALUES (%s, %s, %s, %s)
    """

    cursor.execute(
        query,
        (
            request.session_id,
            request.customer_message,
            request.reason,
            "Open"
        )
    )

    connection.commit()

    escalation_id = cursor.lastrowid

    cursor.close()

    connection.close()

    return {

        "success": True,

        "escalation_id":
            escalation_id,

        "status": "Open",

        "message":
            "Conversation escalated to human support."

    }


# ==================================================
# MEMORY API
# ==================================================

@app.get("/memory/{session_id}")
def get_session_memory(
    session_id: str
):

    memory = get_memory(
        session_id
    )

    return {

        "session_id":
            session_id,

        "messages":
            memory

    }


@app.delete("/memory/{session_id}")
def delete_session_memory(
    session_id: str
):

    clear_memory(
        session_id
    )

    return {

        "message":
            "Conversation memory cleared.",

        "session_id":
            session_id

    }


# ==================================================
# CHAT AGENT
# ==================================================

@app.post("/chat")
def chat(
    request: ChatRequest
):

    message = request.message.strip()

    if not message:

        raise HTTPException(

            status_code=400,

            detail={
                "success": False,

                "message":
                    "Message cannot be empty."
            }

        )


    # ==================================================
    # GET PREVIOUS CONVERSATION
    # ==================================================

    memory = get_memory(
        request.session_id
    )


    # ==================================================
    # DECIDE WHETHER RAG IS NEEDED
    # ==================================================

    policy_keywords = [

        "refund",

        "return",

        "shipping",

        "delivery policy",

        "cancel",

        "cancellation",

        "payment",

        "damaged",

        "defective",

        "warranty",

        "policy"

    ]


    needs_rag = any(

        keyword in message.lower()

        for keyword in policy_keywords

    )


    policy_context = ""


    if needs_rag:

        try:

            policy_context = (
                get_policy_context(message)
            )

        except Exception as error:

            print(
                "RAG error:"
            )

            print(error)

            policy_context = ""


    # ==================================================
    # SYSTEM INSTRUCTION
    # ==================================================

    system_instruction = f"""

You are ResolveAI, an intelligent
customer support agent.

You help customers with:

- Orders
- Shipping
- Refunds
- Payments
- Account issues
- Company policies

Be professional, friendly,
and concise.

IMPORTANT RULES:

1. If the customer asks about an
order and provides an order ID,
use the order_lookup tool.

2. Never invent order information.

3. Only use information returned
by order_lookup when discussing
a specific order.

4. If the customer asks about an
order but does not provide an
order ID, ask for the order ID.

5. If company policy information
is provided below, use it to answer
policy questions.

6. Never invent company policies.

7. If the available information
is not enough, tell the customer
that human support can help.

8. Use relevant previous conversation
context when answering the current
question.

9. Do not expose internal tools,
database details, Redis, or
implementation details.

RETRIEVED KNOWLEDGE:

{policy_context}

"""


    # ==================================================
    # BUILD GEMINI CONVERSATION
    # ==================================================

    gemini_contents = []


    for old_message in memory:

        role = old_message.get("role")

        text = old_message.get("text")


        if not text:

            continue


        if role == "user":

            gemini_contents.append(

                types.Content(

                    role="user",

                    parts=[

                        types.Part(
                            text=text
                        )

                    ]

                )

            )


        elif role == "assistant":

            gemini_contents.append(

                types.Content(

                    role="model",

                    parts=[

                        types.Part(
                            text=text
                        )

                    ]

                )

            )


    # ==================================================
    # ADD CURRENT MESSAGE
    # ==================================================

    gemini_contents.append(

        types.Content(

            role="user",

            parts=[

                types.Part(
                    text=message
                )

            ]

        )

    )


    # ==================================================
    # FIRST GEMINI CALL
    # ==================================================

    try:

        response = client.models.generate_content(

            model="gemini-2.5-flash",

            contents=gemini_contents,

            config=types.GenerateContentConfig(

                system_instruction=
                    system_instruction,

                tools=[
                    order_lookup_tool
                ]

            )

        )

    except errors.ClientError as error:

        handle_gemini_error(error)

    except Exception as error:

        handle_gemini_error(error)


    # ==================================================
    # TOOL CALL
    # ==================================================

    if response.function_calls:

        function_call = (
            response.function_calls[0]
        )


        if function_call.name == "order_lookup":

            order_id = (
                function_call.args
                .get("order_id")
            )


            if not order_id:

                raise HTTPException(

                    status_code=400,

                    detail={
                        "success": False,

                        "message":
                            "Order ID was not provided."
                    }

                )


            tool_result = order_lookup(
                order_id
            )


            # ==================================================
            # SEND TOOL RESULT TO GEMINI
            # ==================================================

            final_contents = list(
                gemini_contents
            )


            final_contents.append(

                types.Content(

                    role="model",

                    parts=[

                        types.Part(

                            function_call=
                                function_call

                        )

                    ]

                )

            )


            final_contents.append(

                types.Content(

                    role="user",

                    parts=[

                        types.Part(

                            function_response=

                                types.FunctionResponse(

                                    name=
                                        "order_lookup",

                                    response=
                                        tool_result

                                )

                        )

                    ]

                )

            )


            # ==================================================
            # SECOND GEMINI CALL
            # ==================================================

            try:

                final_response = (
                    client.models.generate_content(

                        model="gemini-2.5-flash",

                        contents=
                            final_contents,

                        config=
                            types.GenerateContentConfig(

                                system_instruction=
                                    system_instruction,

                                tools=[
                                    order_lookup_tool
                                ]

                            )

                    )
                )

            except errors.ClientError as error:

                handle_gemini_error(error)

            except Exception as error:

                handle_gemini_error(error)


            answer = (
                final_response.text
            )


            # ==================================================
            # SAVE TO REDIS
            # ==================================================

            save_memory(

                request.session_id,

                "user",

                message

            )


            save_memory(

                request.session_id,

                "assistant",

                answer

            )


            return {

                "response":
                    answer,

                "tool_used":
                    "order_lookup",

                "rag_used":
                    False,

                "order_id":
                    order_id,

                "memory_used":
                    len(memory) > 0

            }


    # ==================================================
    # NORMAL RESPONSE
    # ==================================================

    answer = response.text


    # ==================================================
    # SAVE TO REDIS
    # ==================================================

    save_memory(

        request.session_id,

        "user",

        message

    )


    save_memory(

        request.session_id,

        "assistant",

        answer

    )


    return {

        "response":
            answer,

        "tool_used":
            None,

        "rag_used":
            bool(policy_context),

        "order_id":
            None,

        "memory_used":
            len(memory) > 0

    }


# ==================================================
# ESCALATION QUEUE
# ==================================================

@app.get("/escalations")
def get_escalations():

    connection = get_db_connection()

    cursor = connection.cursor(
        dictionary=True
    )


    cursor.execute("""

        SELECT
            id,
            session_id,
            customer_message,
            reason,
            status,
            created_at

        FROM support_escalations

        ORDER BY created_at DESC

    """)


    escalations = cursor.fetchall()


    cursor.close()

    connection.close()


    for escalation in escalations:

        if escalation["created_at"]:

            escalation["created_at"] = (
                escalation["created_at"].isoformat()
            )


    return {

        "success": True,

        "escalations":
            escalations

    }