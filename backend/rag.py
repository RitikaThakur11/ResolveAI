import os
import chromadb

from dotenv import load_dotenv
from google import genai
from google.genai import types


# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("GEMINI_API_KEY is missing from .env")

client = genai.Client(
    api_key=api_key
)


# ============================================================
# CHROMADB
# ============================================================

chroma_client = chromadb.PersistentClient(
    path="./chroma_db"
)

collection = chroma_client.get_or_create_collection(
    name="resolveai_knowledge"
)


# ============================================================
# EMBEDDING FUNCTIONS
# ============================================================

def create_document_embedding(text: str):
    """Create an embedding for a knowledge-base document."""

    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
            output_dimensionality=768
        )
    )

    return result.embeddings[0].values


def create_query_embedding(text: str):
    """Create an embedding for a user search query."""

    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=768
        )
    )

    return result.embeddings[0].values


# ============================================================
# LOAD POLICY DOCUMENT
# ============================================================

def load_policy_document():
    """Load company policies from the text file."""

    path = "knowledge_base/company_policies.txt"

    with open(
        path,
        "r",
        encoding="utf-8"
    ) as file:

        return file.read()


# ============================================================
# CREATE CHUNKS
# ============================================================

def create_chunks(text: str):
    """
    Split the policy file into individual sections.

    Each policy becomes its own searchable document.
    """

    sections = [
        section.strip()
        for section in text.split("\n\n")
        if section.strip()
    ]

    chunks = []

    for section in sections:

        if len(section) >= 50:
            chunks.append(section)

    return chunks


# ============================================================
# INDEX KNOWLEDGE BASE
# ============================================================

def index_knowledge_base():
    """
    Create embeddings for policy sections
    and store them in ChromaDB.
    """

    global collection

    document = load_policy_document()

    chunks = create_chunks(document)

    # --------------------------------------------------------
    # Check existing collection
    # --------------------------------------------------------

    existing = collection.count()

    # If everything is already indexed
    if existing == len(chunks):

        return existing

    # --------------------------------------------------------
    # Rebuild collection if necessary
    # --------------------------------------------------------

    if existing > 0:

        chroma_client.delete_collection(
            name="resolveai_knowledge"
        )

        collection = chroma_client.create_collection(
            name="resolveai_knowledge"
        )

    # --------------------------------------------------------
    # Add policy sections
    # --------------------------------------------------------

    for index, chunk in enumerate(chunks):

        print(
            f"Creating embedding for policy {index + 1}/{len(chunks)}..."
        )

        embedding = create_document_embedding(
            chunk
        )

        collection.add(

            ids=[
                f"policy_{index}"
            ],

            documents=[
                chunk
            ],

            embeddings=[
                embedding
            ],

            metadatas=[
                {
                    "source": "company_policies.txt",
                    "type": "company_policy"
                }
            ]
        )

    return len(chunks)


# ============================================================
# KEYWORD SCORING
# ============================================================

def keyword_score(
    query: str,
    document: str
):
    """
    Give additional relevance points when important
    support-related words appear in the document.
    """

    query_lower = query.lower()

    document_lower = document.lower()

    keywords = [
        "refund",
        "return",
        "shipping",
        "delivery",
        "cancel",
        "cancellation",
        "payment",
        "damaged",
        "defective",
        "warranty",
        "policy",
        "order"
    ]

    score = 0

    for keyword in keywords:

        if keyword in query_lower:

            if keyword in document_lower:

                score += 10

    return score


# ============================================================
# SEARCH KNOWLEDGE BASE
# ============================================================

def search_knowledge_base(
    query: str,
    n_results: int = 3
):
    """
    Search the knowledge base using:

    1. Gemini semantic similarity
    2. Keyword relevance

    Combining both makes retrieval more reliable
    for our small company-policy knowledge base.
    """

    global collection

    # --------------------------------------------------------
    # Make sure knowledge base exists
    # --------------------------------------------------------

    if collection.count() == 0:

        index_knowledge_base()

    # --------------------------------------------------------
    # Semantic search
    # --------------------------------------------------------

    query_embedding = create_query_embedding(
        query
    )

    result_count = min(
        n_results,
        collection.count()
    )

    vector_results = collection.query(

        query_embeddings=[
            query_embedding
        ],

        n_results=result_count,

        include=[
            "documents",
            "distances"
        ]
    )

    vector_documents = (
        vector_results
        .get("documents", [[]])[0]
    )

    vector_distances = (
        vector_results
        .get("distances", [[]])[0]
    )

    # --------------------------------------------------------
    # Get every document
    # --------------------------------------------------------

    all_documents_result = collection.get()

    all_documents = (
        all_documents_result
        .get("documents", [])
    )

    # --------------------------------------------------------
    # Calculate combined scores
    # --------------------------------------------------------

    scored_documents = []

    for document in all_documents:

        # Keyword score
        keyword = keyword_score(
            query,
            document
        )

        # Semantic score
        semantic = 0

        if document in vector_documents:

            position = vector_documents.index(
                document
            )

            distance = vector_distances[position]

            # Smaller distance = more relevant
            semantic = max(
                0,
                1 - distance
            )

        # Keyword score is intentionally stronger
        # for our small policy database.
        final_score = (
            keyword + semantic
        )

        scored_documents.append(
            (
                final_score,
                document
            )
        )

    # --------------------------------------------------------
    # Sort by relevance
    # --------------------------------------------------------

    scored_documents.sort(
        key=lambda item: item[0],
        reverse=True
    )

    # --------------------------------------------------------
    # Return best documents
    # --------------------------------------------------------

    return [
        document
        for score, document
        in scored_documents[:n_results]
    ]


# ============================================================
# GET POLICY CONTEXT
# ============================================================

def get_policy_context(
    query: str
):
    """
    Retrieve relevant policies and combine them
    into context that can be given to Gemini.
    """

    documents = search_knowledge_base(
        query
    )

    if not documents:

        return ""

    return "\n\n---\n\n".join(
        documents
    )


# ============================================================
# TEST RAG
# ============================================================

if __name__ == "__main__":

    print()
    print("==========================================")
    print("      ResolveAI RAG Knowledge Base")
    print("==========================================")
    print()

    count = index_knowledge_base()

    print()
    print(
        f"Knowledge base ready with {count} documents."
    )

    # --------------------------------------------------------
    # Test 1
    # --------------------------------------------------------

    queries = [
        "What is the refund policy?",
        "How long does standard shipping take?",
        "Can I cancel my order after it has shipped?"
    ]

    for query in queries:

        print()
        print("------------------------------------------")
        print(
            f"QUESTION: {query}"
        )
        print("------------------------------------------")

        context = get_policy_context(
            query
        )

        print()
        print("RETRIEVED CONTEXT:")
        print()

        print(context)

    print()
    print("==========================================")
    print("             RAG TEST COMPLETE")
    print("==========================================")