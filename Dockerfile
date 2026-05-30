FROM python:3.12-slim

# Writable cache for the embedding model
ENV HF_HOME=/app/.cache \
    SENTENCE_TRANSFORMERS_HOME=/app/.cache \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install deps first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the embedding model so cold starts are fast
RUN mkdir -p /app/.cache && chmod -R 777 /app/.cache \
    && python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Copy the backend code
COPY . .

# Make /app writable for HF's runtime user (sqlite + uploads)
RUN chmod -R 777 /app

EXPOSE 7860
CMD ["uvicorn", "backend.api:app", "--host", "0.0.0.0", "--port", "7860"]
