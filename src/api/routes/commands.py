"""
Command Runner Routes

Execute raw Telethon/MTProto commands with LLM code generation support.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()


class ExecuteRequest(BaseModel):
    code: str
    timeout_seconds: float = 30.0


@router.post("/execute")
async def execute_command(request: ExecuteRequest):
    """
    Execute raw Telethon/Python code.
    
    The `client` variable is automatically available (Telethon TelegramClient).
    Also available: `types`, `functions`, `asyncio`, `datetime`, `json`, `re`
    
    Use `await` for async operations. Return values are serialized to JSON.
    
    Example:
    ```python
    await client.get_me()
    ```
    """
    from src.services.command_runner import CommandExecutor
    
    if not request.code.strip():
        raise HTTPException(status_code=400, detail="No code provided")
    
    result = await CommandExecutor.execute(
        code=request.code,
        timeout_seconds=request.timeout_seconds,
    )
    
    return result.to_dict()


class GenerateRequest(BaseModel):
    description: str


@router.post("/generate")
async def generate_code(request: GenerateRequest):
    """
    Generate Telethon code from natural language description using LLM.
    
    Example: "Get the last 10 messages from chat -1001234567890"
    """
    from src.services.command_runner import LLMCodeGenerator
    from src.core.config import settings
    
    if not settings.llm_api_key:
        raise HTTPException(status_code=400, detail="LLM API key not configured")
    
    try:
        code = await LLMCodeGenerator.generate(request.description)
        return {
            "code": code,
            "description": request.description,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code generation failed: {str(e)}")


class GenerateAndExecuteRequest(BaseModel):
    description: str
    auto_execute: bool = False
    timeout_seconds: float = 30.0


@router.post("/generate-and-execute")
async def generate_and_execute(request: GenerateAndExecuteRequest):
    """
    Generate code from description and optionally execute it.
    
    Set auto_execute=true to immediately run the generated code.
    """
    from src.services.command_runner import LLMCodeGenerator, CommandExecutor
    from src.core.config import settings
    
    if not settings.llm_api_key:
        raise HTTPException(status_code=400, detail="LLM API key not configured")
    
    try:
        # Generate code
        code = await LLMCodeGenerator.generate(request.description)
        
        result = {
            "code": code,
            "description": request.description,
        }
        
        # Execute if requested
        if request.auto_execute:
            exec_result = await CommandExecutor.execute(
                code=code,
                timeout_seconds=request.timeout_seconds,
            )
            result["execution"] = exec_result.to_dict()
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")


class ValidateRequest(BaseModel):
    code: str


@router.post("/validate")
async def validate_code(request: ValidateRequest):
    """
    Validate code without executing it.
    
    Checks for syntax errors and blocked operations.
    """
    from src.services.command_runner import CodeValidator
    
    is_safe, error = CodeValidator.validate(request.code)
    
    return {
        "valid": is_safe,
        "error": error,
        "code": request.code,
    }


@router.get("/history")
async def get_execution_history(limit: int = 50):
    """Get recent command execution history."""
    from src.services.command_runner import CommandExecutor
    
    return {
        "history": CommandExecutor.get_history(limit),
    }


@router.delete("/history")
async def clear_execution_history():
    """Clear execution history."""
    from src.services.command_runner import CommandExecutor
    
    CommandExecutor.clear_history()
    return {"success": True}


# ============================================================================
# BUILT-IN COMMAND TEMPLATES
# ============================================================================

@router.get("/templates")
async def get_command_templates():
    """Get common command templates for quick access."""
    return {
        "templates": [
            {
                "name": "Get My Info",
                "description": "Get information about the logged in user",
                "code": "await client.get_me()",
            },
            {
                "name": "List Dialogs",
                "description": "Get list of all chats",
                "code": "dialogs = await client.get_dialogs(limit=100)\nreturn [{'id': d.id, 'name': d.name} for d in dialogs]",
            },
            {
                "name": "Get Chat Info",
                "description": "Get information about a specific chat",
                "code": "# Replace CHAT_ID with actual ID\nchat = await client.get_entity(CHAT_ID)\nreturn {'id': chat.id, 'title': getattr(chat, 'title', chat.first_name)}",
            },
            {
                "name": "Get Recent Messages",
                "description": "Get last N messages from a chat",
                "code": "# Replace CHAT_ID and count\nmessages = await client.get_messages(CHAT_ID, limit=10)\nreturn [{'id': m.id, 'text': m.text, 'date': str(m.date)} for m in messages]",
            },
            {
                "name": "Send Message",
                "description": "Send a text message",
                "code": "# Replace CHAT_ID and message\nawait client.send_message(CHAT_ID, 'Hello World!')",
            },
            {
                "name": "Get Chat Members",
                "description": "Get members of a group/channel",
                "code": "# Replace CHAT_ID\nparticipants = await client.get_participants(CHAT_ID, limit=100)\nreturn [{'id': p.id, 'name': f'{p.first_name or \"\"} {p.last_name or \"\"}'.strip()} for p in participants]",
            },
            {
                "name": "Search Messages",
                "description": "Search for messages in a chat",
                "code": "# Replace CHAT_ID and search term\nmessages = await client.get_messages(CHAT_ID, search='keyword', limit=20)\nreturn [{'id': m.id, 'text': m.text} for m in messages]",
            },
            {
                "name": "Get User Info",
                "description": "Get information about a specific user",
                "code": "# Replace USER_ID or username\nuser = await client.get_entity('username')\nreturn {'id': user.id, 'first_name': user.first_name, 'username': user.username}",
            },
            {
                "name": "Forward Message",
                "description": "Forward a message to another chat",
                "code": "# Replace IDs\nawait client.forward_messages(TO_CHAT_ID, MESSAGE_ID, FROM_CHAT_ID)",
            },
            {
                "name": "Delete Messages",
                "description": "Delete messages from a chat",
                "code": "# Replace CHAT_ID and message IDs\nawait client.delete_messages(CHAT_ID, [MSG_ID_1, MSG_ID_2])",
            },
        ]
    }


@router.get("/help")
async def get_command_help():
    """Get help documentation for the command runner."""
    return {
        "overview": "Execute raw Telethon/Python code with the connected Telegram client",
        "available_objects": {
            "client": "TelegramClient instance - use for all Telegram operations",
            "types": "telethon.tl.types - Telegram type definitions",
            "functions": "telethon.tl.functions - Raw MTProto functions",
            "asyncio": "Python asyncio module",
            "datetime": "Python datetime module",
            "json": "Python json module",
            "re": "Python regex module",
        },
        "tips": [
            "Always use 'await' for async operations",
            "Use 'return' to get data back from your code",
            "The code runs in a sandboxed environment with limited imports",
            "Use LLM generation for complex tasks: describe what you want in plain English",
        ],
        "examples": [
            {
                "description": "Get your Telegram user info",
                "code": "await client.get_me()"
            },
            {
                "description": "Get last 5 messages from a chat",
                "code": "messages = await client.get_messages(-1001234567890, limit=5)\nreturn [m.text for m in messages if m.text]"
            },
        ],
        "security": {
            "blocked": "exec, eval, os, subprocess, file operations",
            "allowed_imports": "telethon, datetime, json, asyncio, re, math",
        }
    }
