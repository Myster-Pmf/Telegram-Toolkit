"""
Auto-Responder Service

Automatically responds to messages using persona cloning.
Can be configured per-chat with different response modes.
"""

import asyncio
from typing import Optional, List, Dict, Any, Callable
from datetime import datetime
from dataclasses import dataclass, asdict
import random

from src.core.config import settings
from src.telegram.session_manager import session_manager
from src.services.personality_service import PersonalityProfile, PersonaResponder, PersonalityAnalyzer


@dataclass
class AutoResponderConfig:
    """Configuration for auto-responder in a chat."""
    chat_id: int
    enabled: bool = False
    
    # Response mode
    mode: str = "persona"  # "persona" (clone style) or "custom" (use custom prompt)
    
    # Persona settings (for "persona" mode)
    persona_user_id: Optional[int] = None  # Whose style to clone
    
    # Custom settings (for "custom" mode)
    custom_prompt: Optional[str] = None  # Custom system prompt
    
    # Trigger settings
    trigger_keywords: List[str] = None  # Only respond to messages with these keywords
    trigger_mentions: bool = True  # Respond when mentioned
    trigger_dms: bool = True  # Respond to direct messages
    
    # Response settings
    min_delay_seconds: float = 1.0  # Min delay before responding
    max_delay_seconds: float = 5.0  # Max delay for natural feel
    typing_simulation: bool = True  # Show "typing..." indicator
    
    # Filters
    ignore_bots: bool = True
    ignore_users: List[int] = None  # User IDs to ignore
    only_users: List[int] = None  # Only respond to these users
    
    def __post_init__(self):
        if self.trigger_keywords is None:
            self.trigger_keywords = []
        if self.ignore_users is None:
            self.ignore_users = []
        if self.only_users is None:
            self.only_users = []
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class AutoResponder:
    """Manages automatic responses across chats."""
    
    # Store configurations per chat
    _configs: Dict[int, AutoResponderConfig] = {}
    
    # Store conversation history for context
    _conversation_history: Dict[int, List[Dict[str, Any]]] = {}
    
    # Active status
    _running: bool = False
    _handler_registered: bool = False
    
    @classmethod
    def configure_chat(
        cls,
        chat_id: int,
        config: AutoResponderConfig,
    ) -> None:
        """Configure auto-responder for a chat."""
        config.chat_id = chat_id
        cls._configs[chat_id] = config
        
        # Initialize conversation history
        if chat_id not in cls._conversation_history:
            cls._conversation_history[chat_id] = []
    
    @classmethod
    def get_config(cls, chat_id: int) -> Optional[AutoResponderConfig]:
        """Get config for a chat."""
        return cls._configs.get(chat_id)
    
    @classmethod
    def disable_chat(cls, chat_id: int) -> None:
        """Disable auto-responder for a chat."""
        if chat_id in cls._configs:
            cls._configs[chat_id].enabled = False
    
    @classmethod
    def enable_chat(cls, chat_id: int) -> None:
        """Enable auto-responder for a chat."""
        if chat_id in cls._configs:
            cls._configs[chat_id].enabled = True
    
    @classmethod
    def list_configs(cls) -> List[Dict[str, Any]]:
        """List all auto-responder configurations."""
        return [config.to_dict() for config in cls._configs.values()]
    
    @classmethod
    async def handle_message(
        cls,
        chat_id: int,
        sender_id: int,
        sender_name: str,
        message_text: str,
        is_mention: bool = False,
        is_dm: bool = False,
        is_bot: bool = False,
    ) -> Optional[str]:
        """
        Handle an incoming message and potentially generate a response.
        
        Returns the generated response text, or None if no response should be sent.
        """
        config = cls._configs.get(chat_id)
        if not config or not config.enabled:
            return None
        
        # Apply filters
        if config.ignore_bots and is_bot:
            return None
        
        if sender_id in config.ignore_users:
            return None
        
        if config.only_users and sender_id not in config.only_users:
            return None
        
        # Check triggers
        should_respond = False
        
        if config.trigger_mentions and is_mention:
            should_respond = True
        
        if config.trigger_dms and is_dm:
            should_respond = True
        
        if config.trigger_keywords:
            for keyword in config.trigger_keywords:
                if keyword.lower() in message_text.lower():
                    should_respond = True
                    break
        
        # If no specific triggers configured, respond to all
        if not config.trigger_keywords and not config.trigger_mentions:
            should_respond = True
        
        if not should_respond:
            return None
        
        # Add to conversation history
        cls._add_to_history(chat_id, sender_name, message_text, is_incoming=True)
        
        # Generate response
        try:
            if config.mode == "persona" and config.persona_user_id:
                response = await cls._generate_persona_response(
                    config, message_text, chat_id
                )
            elif config.mode == "custom" and config.custom_prompt:
                response = await cls._generate_custom_response(
                    config, message_text, chat_id
                )
            else:
                return None
            
            # Add delay for natural feel
            if config.min_delay_seconds > 0:
                delay = random.uniform(
                    config.min_delay_seconds, 
                    config.max_delay_seconds
                )
                await asyncio.sleep(delay)
            
            # Add response to history
            cls._add_to_history(chat_id, "Me", response, is_incoming=False)
            
            return response
            
        except Exception as e:
            print(f"Auto-responder error: {e}")
            return None
    
    @classmethod
    async def _generate_persona_response(
        cls,
        config: AutoResponderConfig,
        message: str,
        chat_id: int,
    ) -> str:
        """Generate response using persona cloning."""
        profile = PersonalityAnalyzer.get_profile(config.persona_user_id)
        if not profile:
            raise ValueError(f"No personality profile for user {config.persona_user_id}")
        
        # Get conversation context
        context = cls._get_conversation_context(chat_id)
        
        return await PersonaResponder.generate_response(
            profile=profile,
            conversation_context=context,
            incoming_message=message,
        )
    
    @classmethod
    async def _generate_custom_response(
        cls,
        config: AutoResponderConfig,
        message: str,
        chat_id: int,
    ) -> str:
        """Generate response using custom prompt."""
        import httpx
        
        context = cls._get_conversation_context(chat_id)
        
        prompt = f"""{config.custom_prompt}

Conversation context:
{context}

Message to respond to:
"{message}"

Generate a response:"""

        # Call LLM
        if settings.llm_provider == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.llm_model}:generateContent"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    params={"key": settings.llm_api_key},
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "temperature": 0.7,
                            "maxOutputTokens": 500,
                        }
                    },
                    timeout=30.0
                )
                
                data = response.json()
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        else:
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
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.7,
                        "max_tokens": 500,
                    },
                    timeout=30.0
                )
                
                data = response.json()
                return data["choices"][0]["message"]["content"].strip()
    
    @classmethod
    def _add_to_history(
        cls, 
        chat_id: int, 
        sender: str, 
        message: str, 
        is_incoming: bool
    ) -> None:
        """Add message to conversation history."""
        if chat_id not in cls._conversation_history:
            cls._conversation_history[chat_id] = []
        
        cls._conversation_history[chat_id].append({
            "sender": sender,
            "message": message,
            "is_incoming": is_incoming,
            "timestamp": datetime.utcnow().isoformat(),
        })
        
        # Keep only last 20 messages
        if len(cls._conversation_history[chat_id]) > 20:
            cls._conversation_history[chat_id] = cls._conversation_history[chat_id][-20:]
    
    @classmethod
    def _get_conversation_context(cls, chat_id: int, limit: int = 10) -> str:
        """Get recent conversation as context string."""
        history = cls._conversation_history.get(chat_id, [])[-limit:]
        
        if not history:
            return "(No recent messages)"
        
        lines = []
        for msg in history:
            prefix = "→" if msg["is_incoming"] else "←"
            lines.append(f"{prefix} {msg['sender']}: {msg['message']}")
        
        return "\n".join(lines)
    
    @classmethod
    def clear_history(cls, chat_id: int) -> None:
        """Clear conversation history for a chat."""
        if chat_id in cls._conversation_history:
            cls._conversation_history[chat_id] = []


# Singleton
auto_responder = AutoResponder()
