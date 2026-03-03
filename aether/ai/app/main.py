"""
Aether Sentiment Analysis Microservice

Asynchronous NLP service that analyzes message sentiment using VADER
and updates the PostgreSQL database via Supabase client.

Fire-and-forget architecture: NestJS dispatches requests without awaiting responses.
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from supabase import create_client, Client

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# Initialize VADER sentiment analyzer (lexicon-based, no ML model loading)
analyzer = SentimentIntensityAnalyzer()

# Supabase client (initialized lazily)
supabase: Client | None = None


def get_supabase_client() -> Client:
    """Lazily initialize and return Supabase client."""
    global supabase
    if supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        supabase = create_client(url, key)
        logger.info("Supabase client initialized")
    return supabase


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    logger.info("Sentiment Analysis Microservice starting up...")
    # Pre-initialize Supabase client on startup
    try:
        get_supabase_client()
    except RuntimeError as e:
        logger.error(f"Failed to initialize Supabase: {e}")
    yield
    logger.info("Sentiment Analysis Microservice shutting down...")


app = FastAPI(
    title="Aether Sentiment Heuristics",
    description="Asynchronous NLP microservice for message sentiment analysis",
    version="1.0.0",
    lifespan=lifespan,
)


class SentimentRequest(BaseModel):
    """Request payload for sentiment analysis."""
    message_id: str = Field(..., description="UUID of the message to analyze")
    text: str = Field(..., description="Message content to analyze")


class SentimentResponse(BaseModel):
    """Response payload after sentiment analysis."""
    message_id: str
    compound_score: float = Field(..., description="VADER compound score (-1.0 to 1.0)")
    status: str


def analyze_sentiment(text: str) -> float:
    """
    Analyze text sentiment using VADER.

    Returns compound score: -1.0 (most negative) to 1.0 (most positive)
    """
    if not text or not text.strip():
        return 0.0
    scores = analyzer.polarity_scores(text)
    return scores["compound"]


def update_message_sentiment(message_id: str, score: float) -> bool:
    """
    Update the sentiment_score column in the messages table.

    Returns True on success, False on failure.
    """
    try:
        client = get_supabase_client()
        response = (
            client.table("messages")
            .update({"sentiment_score": score})
            .eq("id", message_id)
            .execute()
        )
        # Check if update affected any rows
        if response.data:
            logger.info(f"Updated message {message_id[:8]}... with sentiment {score:.3f}")
            return True
        else:
            logger.warning(f"Message {message_id} not found in database")
            return False
    except Exception as e:
        logger.error(f"Database update failed for {message_id}: {e}")
        return False


def process_sentiment_background(message_id: str, text: str):
    """
    Background task: analyze sentiment and update database.

    This runs asynchronously after the HTTP response is sent.
    """
    score = analyze_sentiment(text)
    update_message_sentiment(message_id, score)


@app.post("/analyze_sentiment", response_model=SentimentResponse)
async def analyze_sentiment_endpoint(
    request: SentimentRequest,
    background_tasks: BackgroundTasks,
):
    """
    Analyze message sentiment and update database asynchronously.

    This endpoint returns immediately after queuing the analysis task,
    implementing the fire-and-forget pattern for non-blocking operation.
    """
    if not request.message_id:
        raise HTTPException(status_code=400, detail="message_id is required")

    # Queue background task for actual processing
    background_tasks.add_task(
        process_sentiment_background,
        request.message_id,
        request.text,
    )

    # Calculate score synchronously for response (fast operation)
    score = analyze_sentiment(request.text)

    logger.info(f"Queued sentiment analysis for message {request.message_id[:8]}...")

    return SentimentResponse(
        message_id=request.message_id,
        compound_score=score,
        status="processing",
    )


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy", "service": "sentiment-heuristics"}


@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": "Aether Sentiment Heuristics",
        "version": "1.0.0",
        "endpoints": {
            "POST /analyze_sentiment": "Analyze message sentiment",
            "GET /health": "Health check",
        },
    }
