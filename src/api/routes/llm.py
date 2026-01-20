"""
LLM Routes

Translation and AI-powered text processing endpoints.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx

from src.core.config import settings

router = APIRouter()


class TranslateRequest(BaseModel):
    """Request body for translation."""
    text: str
    target_language: Optional[str] = None  # Uses config default if not specified
    source_language: Optional[str] = None  # Auto-detect if not specified


class TranslateResponse(BaseModel):
    """Response for translation."""
    original_text: str
    translated_text: str
    target_language: str
    detected_language: Optional[str] = None


@router.post("/translate", response_model=TranslateResponse)
async def translate_text(request: TranslateRequest):
    """
    Translate text using configured LLM provider.
    
    Supports OpenAI-compatible and Gemini APIs.
    """
    if not settings.llm_api_key:
        raise HTTPException(
            status_code=400, 
            detail="LLM API key not configured. Set LLM_API_KEY in .env"
        )
    
    target_lang = request.target_language or settings.translation_target_language
    
    # Build prompt
    prompt = f"""Translate the following text to {target_lang}. 
Only output the translated text, nothing else.
Do not add quotes or any formatting around the translation.

Text to translate:
{request.text}"""
    
    try:
        if settings.llm_provider == "gemini":
            translated = await _translate_with_gemini(prompt)
        else:
            translated = await _translate_with_openai(prompt)
        
        return TranslateResponse(
            original_text=request.text,
            translated_text=translated.strip(),
            target_language=target_lang,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


async def _translate_with_gemini(prompt: str) -> str:
    """Translate using Google Gemini API."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.llm_model}:generateContent"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            params={"key": settings.llm_api_key},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.1,
                    "maxOutputTokens": 2048,
                }
            },
            timeout=30.0
        )
        
        if response.status_code != 200:
            raise Exception(f"Gemini API error: {response.text}")
        
        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def _translate_with_openai(prompt: str) -> str:
    """Translate using OpenAI-compatible API."""
    url = f"{settings.llm_endpoint}/chat/completions"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {settings.llm_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.llm_model,
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.1,
                "max_tokens": 2048,
            },
            timeout=30.0
        )
        
        if response.status_code != 200:
            raise Exception(f"OpenAI API error: {response.text}")
        
        data = response.json()
        return data["choices"][0]["message"]["content"]


class LLMConfigResponse(BaseModel):
    """Response showing LLM configuration (without API key)."""
    provider: str
    model: str
    endpoint: str
    default_target_language: str
    is_configured: bool


@router.get("/config", response_model=LLMConfigResponse)
async def get_llm_config():
    """Get current LLM configuration (without exposing API key)."""
    return LLMConfigResponse(
        provider=settings.llm_provider,
        model=settings.llm_model,
        endpoint=settings.llm_endpoint,
        default_target_language=settings.translation_target_language,
        is_configured=settings.llm_api_key is not None,
    )
