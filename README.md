# ResolveAI

## Agentic Customer Support Platform

ResolveAI is an AI-powered customer support platform that combines
LLM-based assistance with company knowledge, real-time order information,
conversation memory, and human support escalation.

The goal is to provide customers with fast and reliable support while
ensuring that important issues can be transferred to a human support agent.

---

## Features

- AI-powered customer support using Google Gemini
- RAG-based company knowledge base
- Semantic search using ChromaDB
- Gemini tool calling for order lookup
- MySQL database for structured order data
- Redis-based conversation memory
- Human support escalation
- Admin Support Queue
- AI evaluation harness
- Dockerized backend infrastructure

---

## Architecture

```text
                         +---------------------+
                         |    React Frontend   |
                         |       Vite          |
                         +----------+----------+
                                    |
                                    v
                         +---------------------+
                         |   FastAPI Backend   |
                         +----------+----------+
                                    |
             +----------------------+----------------------+
             |                      |                      |
             v                      v                      v
      +-------------+        +-------------+       +-------------+
      |   Gemini    |        |    MySQL    |       |    Redis    |
      |     LLM     |        |   Orders    |       |   Memory    |
      +------+------+        +-------------+       +-------------+
             |
       +-----+------+
       |            |
       v            v
 +-----------+ +--------------+
 | ChromaDB  | | Tool Calling |
 |    RAG    | | Order Lookup |
 +-----------+ +--------------+
             |
             v
      +-----------------+
      | Human Escalation|
      +--------+--------+
               |
               v
      +-----------------+
      |  Support Queue  |
      +-----------------+
