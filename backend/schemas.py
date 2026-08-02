"""Pydantic request/response models for the Research Agent API.

These mirror the contract the Next.js frontend expects (see
frontend/lib/types.ts and frontend/lib/api.ts).
"""

from typing import List, Literal, Optional

from pydantic import BaseModel

AgentStatus = Literal["pending_review", "ready_to_stream", "rate_limited"]


class ChatRequest(BaseModel):
    thread_id: str
    query: str


class ResumeRequest(BaseModel):
    thread_id: str
    approved: bool


class ChatResponse(BaseModel):
    status: AgentStatus
    # Present when status == "pending_review": the findings to review.
    findings: Optional[str] = None
    # Present when status == "rate_limited": a human-readable explanation.
    message: Optional[str] = None


class NewChatResponse(BaseModel):
    thread_id: str


class DocumentList(BaseModel):
    documents: List[str]


class UploadResponse(BaseModel):
    filename: str
    chunks: int  # number of text chunks embedded into the vector store
