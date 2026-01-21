"""
Personality Analysis Service

Analyzes user communication patterns and writing style using LLM.
Enables persona cloning for auto-responses.
"""

import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from dataclasses import dataclass, asdict

from src.core.config import settings


@dataclass
class PersonalityProfile:
    """Represents a user's communication personality."""
    user_id: int
    username: Optional[str]
    
    # Communication style
    tone: str  # formal, casual, friendly, professional, aggressive, etc.
    vocabulary_level: str  # simple, moderate, advanced, academic
    emoji_usage: str  # none, minimal, moderate, heavy
    sentence_length: str  # short, medium, long, mixed
    
    # Content patterns
    common_topics: List[str]
    common_phrases: List[str]
    greeting_style: str
    sign_off_style: str
    
    # Behavioral patterns
    response_speed: str  # instant, quick, delayed
    message_frequency: str  # rare, moderate, frequent
    question_response_style: str  # direct, elaborate, evasive
    
    # Language
    primary_language: str
    uses_slang: bool
    uses_abbreviations: bool
    
    # Emotional traits
    expressiveness: str  # reserved, moderate, expressive
    humor_style: str  # none, dry, playful, sarcastic
    
    # Raw data
    sample_messages: List[str]
    analyzed_at: str
    message_count: int
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    def to_prompt_context(self) -> str:
        """Generate context for LLM prompts."""
        return f"""Communication Style Profile:
- Tone: {self.tone}
- Vocabulary: {self.vocabulary_level}
- Emoji usage: {self.emoji_usage}
- Sentence length: {self.sentence_length}
- Greeting style: {self.greeting_style}
- Sign-off style: {self.sign_off_style}
- Expressiveness: {self.expressiveness}
- Humor: {self.humor_style}
- Uses slang: {self.uses_slang}
- Uses abbreviations: {self.uses_abbreviations}
- Common phrases: {', '.join(self.common_phrases[:5])}
- Common topics: {', '.join(self.common_topics[:5])}

Sample messages for style reference:
{chr(10).join(f'- "{msg}"' for msg in self.sample_messages[:5])}"""


class PersonalityAnalyzer:
    """Analyzes user messages to build personality profile."""
    
    # In-memory storage for profiles
    _profiles: Dict[int, PersonalityProfile] = {}
    
    @classmethod
    async def analyze_user(
        cls,
        user_id: int,
        username: Optional[str],
        messages: List[str],
    ) -> PersonalityProfile:
        """
        Analyze user messages to build personality profile.
        
        Uses LLM to extract communication patterns and style.
        """
        if not messages:
            raise ValueError("No messages provided for analysis")
        
        if not settings.llm_api_key:
            raise ValueError("LLM API key not configured")
        
        # Prepare message samples (limit to last 50)
        sample_messages = messages[-50:] if len(messages) > 50 else messages
        messages_text = "\n".join(f"- {msg}" for msg in sample_messages)
        
        # Build analysis prompt
        prompt = f"""Analyze the following messages from a user and extract their communication personality profile.

Messages:
{messages_text}

Analyze and respond with a JSON object containing:
{{
  "tone": "one of: formal, casual, friendly, professional, aggressive, neutral",
  "vocabulary_level": "one of: simple, moderate, advanced, academic",
  "emoji_usage": "one of: none, minimal, moderate, heavy",
  "sentence_length": "one of: short, medium, long, mixed",
  "common_topics": ["list of 3-5 topics they frequently discuss"],
  "common_phrases": ["list of 3-5 phrases or expressions they commonly use"],
  "greeting_style": "how they typically greet (e.g., 'Hey', 'Hello', 'Hi there', etc.)",
  "sign_off_style": "how they typically end messages (e.g., 'Thanks', 'Cheers', just stop, etc.)",
  "response_speed_impression": "one of: instant, quick, delayed",
  "question_response_style": "one of: direct, elaborate, evasive",
  "primary_language": "detected primary language",
  "uses_slang": true/false,
  "uses_abbreviations": true/false,
  "expressiveness": "one of: reserved, moderate, expressive",
  "humor_style": "one of: none, dry, playful, sarcastic, wholesome"
}}

Only output the JSON, no other text."""

        # Call LLM
        analysis = await cls._call_llm(prompt)
        
        try:
            data = json.loads(analysis)
        except json.JSONDecodeError:
            # Try to extract JSON from response
            import re
            match = re.search(r'\{[\s\S]*\}', analysis)
            if match:
                data = json.loads(match.group())
            else:
                raise ValueError("Failed to parse personality analysis")
        
        # Build profile
        profile = PersonalityProfile(
            user_id=user_id,
            username=username,
            tone=data.get("tone", "neutral"),
            vocabulary_level=data.get("vocabulary_level", "moderate"),
            emoji_usage=data.get("emoji_usage", "minimal"),
            sentence_length=data.get("sentence_length", "medium"),
            common_topics=data.get("common_topics", []),
            common_phrases=data.get("common_phrases", []),
            greeting_style=data.get("greeting_style", "Hello"),
            sign_off_style=data.get("sign_off_style", ""),
            response_speed=data.get("response_speed_impression", "quick"),
            message_frequency="moderate",
            question_response_style=data.get("question_response_style", "direct"),
            primary_language=data.get("primary_language", "English"),
            uses_slang=data.get("uses_slang", False),
            uses_abbreviations=data.get("uses_abbreviations", False),
            expressiveness=data.get("expressiveness", "moderate"),
            humor_style=data.get("humor_style", "none"),
            sample_messages=sample_messages[:10],
            analyzed_at=datetime.utcnow().isoformat(),
            message_count=len(messages),
        )
        
        # Store profile
        cls._profiles[user_id] = profile
        
        return profile
    
    @classmethod
    def get_profile(cls, user_id: int) -> Optional[PersonalityProfile]:
        """Get cached personality profile for a user."""
        return cls._profiles.get(user_id)
    
    @classmethod
    def list_profiles(cls) -> List[Dict[str, Any]]:
        """List all cached personality profiles."""
        return [
            {
                "user_id": p.user_id,
                "username": p.username,
                "tone": p.tone,
                "analyzed_at": p.analyzed_at,
                "message_count": p.message_count,
            }
            for p in cls._profiles.values()
        ]
    
    @classmethod
    async def _call_llm(cls, prompt: str) -> str:
        """Call configured LLM provider."""
        import httpx
        
        if settings.llm_provider == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.llm_model}:generateContent"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    params={"key": settings.llm_api_key},
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "temperature": 0.3,
                            "maxOutputTokens": 2048,
                        }
                    },
                    timeout=60.0
                )
                
                if response.status_code != 200:
                    raise Exception(f"Gemini API error: {response.text}")
                
                data = response.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
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
                        "temperature": 0.3,
                        "max_tokens": 2048,
                    },
                    timeout=60.0
                )
                
                if response.status_code != 200:
                    raise Exception(f"OpenAI API error: {response.text}")
                
                data = response.json()
                return data["choices"][0]["message"]["content"]


class PersonaResponder:
    """Generate responses in the style of a user's personality."""
    
    @classmethod
    async def generate_response(
        cls,
        profile: PersonalityProfile,
        conversation_context: str,
        incoming_message: str,
        custom_instructions: Optional[str] = None,
    ) -> str:
        """
        Generate a response in the style of the given personality profile.
        
        Args:
            profile: The personality profile to mimic
            conversation_context: Recent conversation history for context
            incoming_message: The message to respond to
            custom_instructions: Optional additional instructions
        """
        if not settings.llm_api_key:
            raise ValueError("LLM API key not configured")
        
        # Build persona prompt
        prompt = f"""You are roleplaying as a person with the following communication style. 
Generate a response to the incoming message that perfectly matches this personality.

{profile.to_prompt_context()}

Conversation context:
{conversation_context}

Incoming message to respond to:
"{incoming_message}"

{f"Additional instructions: {custom_instructions}" if custom_instructions else ""}

Generate a natural response that:
1. Matches the tone and vocabulary level
2. Uses similar emoji patterns
3. Matches the sentence length preferences
4. Uses their typical greeting/sign-off style if appropriate
5. Incorporates their common phrases naturally if relevant
6. Matches their humor style

Response (only output the message, no quotes or explanation):"""

        response = await PersonalityAnalyzer._call_llm(prompt)
        return response.strip().strip('"').strip("'")
    
    @classmethod
    async def generate_variations(
        cls,
        profile: PersonalityProfile,
        message: str,
        count: int = 3,
    ) -> List[str]:
        """
        Generate multiple response variations in the persona's style.
        """
        if not settings.llm_api_key:
            raise ValueError("LLM API key not configured")
        
        prompt = f"""You are generating message variations in a specific person's communication style.

{profile.to_prompt_context()}

Original message to rewrite:
"{message}"

Generate {count} different ways this person would phrase the same message, matching their style exactly.
Format: Return each variation on a new line, numbered 1-{count}.
Only output the variations, no other text."""

        response = await PersonalityAnalyzer._call_llm(prompt)
        
        # Parse variations
        variations = []
        for line in response.strip().split('\n'):
            line = line.strip()
            if line and line[0].isdigit():
                # Remove numbering
                text = line.lstrip('0123456789.):- ').strip()
                if text:
                    variations.append(text)
        
        return variations[:count]


# Singleton instances
personality_analyzer = PersonalityAnalyzer()
persona_responder = PersonaResponder()
