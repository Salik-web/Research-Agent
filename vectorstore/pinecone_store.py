from pinecone import Pinecone, ServerlessSpec
from langchain_pinecone import PineconeVectorStore
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from typing import List
import os
import time

INDEX_NAME = "research-agent"

# Two separate Pinecone namespaces so the two kinds of data never mix:
#   - DOCUMENTS: user-uploaded PDF chunks. This is the knowledge base, and the
#     ONLY namespace that retrieval reads from.
#   - FINDINGS: web-research summaries cached by the graph. Kept isolated so they
#     can't pollute (and outrank) the real documents during retrieval.
DOCUMENTS_NAMESPACE = "documents"
FINDINGS_NAMESPACE = "findings"


def get_vectorstore(namespace: str = DOCUMENTS_NAMESPACE):
    pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

    existing_indexes = [index_info["name"] for index_info in pc.list_indexes()]
    if INDEX_NAME not in existing_indexes:
        pc.create_index(
            name=INDEX_NAME,
            dimension=384,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
        while not pc.describe_index(INDEX_NAME).status["ready"]:
            time.sleep(1)

    embeddings = HuggingFaceEmbeddings(model="all-MiniLM-L6-v2")
    return PineconeVectorStore(
        index_name=INDEX_NAME, embedding=embeddings, namespace=namespace
    )


def store_findings(texts: List[str]):
    # Cached web research -> isolated namespace (not used for document retrieval).
    vectorstore = get_vectorstore(namespace=FINDINGS_NAMESPACE)
    vectorstore.add_texts(texts)


def ingest_pdf(file_path: str) -> int:
    """Load, chunk, and embed a single PDF into the documents namespace.

    Called at upload time so the document is searchable immediately. Chunk IDs are
    derived from the filename, so re-uploading the same file upserts/overwrites
    rather than creating duplicates.

    Returns the number of chunks ingested.
    """
    loader = PyPDFLoader(file_path)
    docs = loader.load()

    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_documents(docs)
    if not chunks:
        # e.g. a scanned/image-only PDF with no extractable text
        return 0

    name = os.path.basename(file_path)
    ids = [f"{name}::chunk-{i}" for i in range(len(chunks))]

    vectorstore = get_vectorstore(namespace=DOCUMENTS_NAMESPACE)
    vectorstore.add_documents(chunks, ids=ids)
    return len(chunks)


def retrieve_related(query: str, k: int = 3):
    # Only retrieve from uploaded documents (the knowledge base).
    vectorstore = get_vectorstore(namespace=DOCUMENTS_NAMESPACE)
    docs = vectorstore.similarity_search(query, k=k)
    return [doc.page_content for doc in docs]


def is_index_empty():
    """True when the documents namespace has no vectors (controls bulk ingest)."""
    pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
    try:
        stats = pc.Index(INDEX_NAME).describe_index_stats()
        namespaces = getattr(stats, "namespaces", None) or {}
        ns = namespaces.get(DOCUMENTS_NAMESPACE)
        count = getattr(ns, "vector_count", None) if ns is not None else 0
        if count is None and isinstance(ns, dict):
            count = ns.get("vector_count", 0)
        return (count or 0) == 0
    except Exception:
        return True
