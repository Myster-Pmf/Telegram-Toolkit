"""
LLM Routes

Translation and AI-powered text processing endpoints.
Includes personality analysis and auto-responder features.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
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


# ============================================================================
# PERSONALITY ANALYSIS
# ============================================================================

class AnalyzePersonalityRequest(BaseModel):
    user_id: int
    username: Optional[str] = None
    messages: List[str]


@router.post("/personality/analyze")
async def analyze_personality(request: AnalyzePersonalityRequest):
    """
    Analyze a user's messages to build their personality profile.
    
    Requires at least 10 messages for accurate analysis.
    """
    if not settings.llm_api_key:
        raise HTTPException(status_code=400, detail="LLM API key not configured")
    
    if len(request.messages) < 5:
        raise HTTPException(status_code=400, detail="Need at least 5 messages for analysis")
    
    try:
        from src.services.personality_service import PersonalityAnalyzer
        
        profile = await PersonalityAnalyzer.analyze_user(
            user_id=request.user_id,
            username=request.username,
            messages=request.messages,
        )
        
        return {
            "success": True,
            "profile": profile.to_dict(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/personality/profiles")
async def list_personality_profiles():
    """List all cached personality profiles."""
    from src.services.personality_service import PersonalityAnalyzer
    return {
        "profiles": PersonalityAnalyzer.list_profiles(),
    }


@router.get("/personality/profiles/{user_id}")
async def get_personality_profile(user_id: int):
    """Get personality profile for a specific user."""
    from src.services.personality_service import PersonalityAnalyzer
    
    profile = PersonalityAnalyzer.get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return {
        "profile": profile.to_dict(),
    }


class GenerateAsPersonaRequest(BaseModel):
    message: str
    conversation_context: Optional[str] = ""
    custom_instructions: Optional[str] = None


@router.post("/personality/profiles/{user_id}/generate")
async def generate_as_persona(user_id: int, request: GenerateAsPersonaRequest):
    """
    Generate a message in the style of a user's personality.
    
    The user must have been analyzed first.
    """
    from src.services.personality_service import PersonalityAnalyzer, PersonaResponder
    
    profile = PersonalityAnalyzer.get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found. Analyze user first.")
    
    try:
        response = await PersonaResponder.generate_response(
            profile=profile,
            conversation_context=request.conversation_context or "",
            incoming_message=request.message,
            custom_instructions=request.custom_instructions,
        )
        
        return {
            "response": response,
            "persona_user_id": user_id,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


class GenerateVariationsRequest(BaseModel):
    message: str
    count: int = 3


@router.post("/personality/profiles/{user_id}/variations")
async def generate_variations(user_id: int, request: GenerateVariationsRequest):
    """
    Generate multiple variations of a message in the user's style.
    """
    from src.services.personality_service import PersonalityAnalyzer, PersonaResponder
    
    profile = PersonalityAnalyzer.get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    try:
        variations = await PersonaResponder.generate_variations(
            profile=profile,
            message=request.message,
            count=request.count,
        )
        
        return {
            "variations": variations,
            "original": request.message,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


# ============================================================================
# AUTO-RESPONDER
# ============================================================================

class AutoResponderConfigRequest(BaseModel):
    enabled: bool = True
    mode: str = "persona"  # "persona" or "custom"
    persona_user_id: Optional[int] = None
    custom_prompt: Optional[str] = None
    trigger_keywords: List[str] = []
    trigger_mentions: bool = True
    trigger_dms: bool = True
    min_delay_seconds: float = 1.0
    max_delay_seconds: float = 5.0
    ignore_bots: bool = True
    ignore_users: List[int] = []
    only_users: List[int] = []


@router.post("/auto-responder/{chat_id}/configure")
async def configure_auto_responder(chat_id: int, request: AutoResponderConfigRequest):
    """
    Configure auto-responder for a chat.
    
    Modes:
    - "persona": Clone a user's personality (requires persona_user_id)
    - "custom": Use a custom system prompt
    """
    if request.mode == "persona" and not request.persona_user_id:
        raise HTTPException(status_code=400, detail="persona_user_id required for persona mode")
    
    if request.mode == "custom" and not request.custom_prompt:
        raise HTTPException(status_code=400, detail="custom_prompt required for custom mode")
    
    from src.services.auto_responder import AutoResponder, AutoResponderConfig
    
    config = AutoResponderConfig(
        chat_id=chat_id,
        enabled=request.enabled,
        mode=request.mode,
        persona_user_id=request.persona_user_id,
        custom_prompt=request.custom_prompt,
        trigger_keywords=request.trigger_keywords,
        trigger_mentions=request.trigger_mentions,
        trigger_dms=request.trigger_dms,
        min_delay_seconds=request.min_delay_seconds,
        max_delay_seconds=request.max_delay_seconds,
        ignore_bots=request.ignore_bots,
        ignore_users=request.ignore_users,
        only_users=request.only_users,
    )
    
    AutoResponder.configure_chat(chat_id, config)
    
    return {
        "success": True,
        "chat_id": chat_id,
        "config": config.to_dict(),
    }


@router.get("/auto-responder/configs")
async def list_auto_responder_configs():
    """List all auto-responder configurations."""
    from src.services.auto_responder import AutoResponder
    return {
        "configs": AutoResponder.list_configs(),
    }


@router.get("/auto-responder/{chat_id}")
async def get_auto_responder_config(chat_id: int):
    """Get auto-responder config for a chat."""
    from src.services.auto_responder import AutoResponder
    
    config = AutoResponder.get_config(chat_id)
    if not config:
        raise HTTPException(status_code=404, detail="No config for this chat")
    
    return {
        "config": config.to_dict(),
    }


@router.post("/auto-responder/{chat_id}/enable")
async def enable_auto_responder(chat_id: int):
    """Enable auto-responder for a chat."""
    from src.services.auto_responder import AutoResponder
    
    config = AutoResponder.get_config(chat_id)
    if not config:
        raise HTTPException(status_code=404, detail="No config for this chat. Configure first.")
    
    AutoResponder.enable_chat(chat_id)
    return {"success": True, "chat_id": chat_id, "enabled": True}


@router.post("/auto-responder/{chat_id}/disable")
async def disable_auto_responder(chat_id: int):
    """Disable auto-responder for a chat."""
    from src.services.auto_responder import AutoResponder
    AutoResponder.disable_chat(chat_id)
    return {"success": True, "chat_id": chat_id, "enabled": False}


class TestAutoResponderRequest(BaseModel):
    message: str
    sender_name: str = "Test User"
    is_mention: bool = False
    is_dm: bool = False


@router.post("/auto-responder/{chat_id}/test")
async def test_auto_responder(chat_id: int, request: TestAutoResponderRequest):
    """
    Test auto-responder with a simulated message.
    
    Returns the response that would be generated.
    """
    from src.services.auto_responder import AutoResponder
    
    config = AutoResponder.get_config(chat_id)
    if not config:
        raise HTTPException(status_code=404, detail="No config for this chat")
    
    if not config.enabled:
        raise HTTPException(status_code=400, detail="Auto-responder is disabled for this chat")
    
    try:
        response = await AutoResponder.handle_message(
            chat_id=chat_id,
            sender_id=0,  # Test user
            sender_name=request.sender_name,
            message_text=request.message,
            is_mention=request.is_mention,
            is_dm=request.is_dm,
            is_bot=False,
        )
        
        if response:
            return {
                "would_respond": True,
                "response": response,
            }
        else:
            return {
                "would_respond": False,
                "reason": "Message did not match trigger conditions",
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")


@router.delete("/auto-responder/{chat_id}/history")
async def clear_auto_responder_history(chat_id: int):
    """Clear conversation history for auto-responder."""
    from src.services.auto_responder import AutoResponder
    AutoResponder.clear_history(chat_id)
    return {"success": True, "chat_id": chat_id}

