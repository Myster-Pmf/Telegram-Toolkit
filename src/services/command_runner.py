"""
Raw Command Runner Service

Execute raw Telethon/MTProto commands with a sandboxed environment.
Includes LLM-powered code generation for natural language to code conversion.
"""

import ast
import asyncio
import traceback
from typing import Optional, List, Dict, Any
from datetime import datetime
from dataclasses import dataclass, asdict
import httpx

from src.core.config import settings
from src.telegram.session_manager import session_manager


@dataclass
class ExecutionResult:
    """Result of executing a raw command."""
    success: bool
    output: Any
    error: Optional[str]
    execution_time_ms: float
    code: str
    timestamp: str
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class CodeValidator:
    """Validates and sanitizes code before execution."""
    
    # Dangerous operations that should be blocked
    BLOCKED_OPERATIONS = {
        'exec', 'eval', 'compile', '__import__',
        'open', 'file', 'input',
        'os.system', 'os.popen', 'subprocess',
        'shutil.rmtree', 'shutil.remove',
        '__builtins__', '__code__', '__globals__',
    }
    
    # Allowed modules for import
    ALLOWED_MODULES = {
        'telethon', 'telethon.tl', 'telethon.tl.types',
        'telethon.tl.functions', 'telethon.errors',
        'datetime', 'json', 'asyncio', 're', 'math',
    }
    
    @classmethod
    def validate(cls, code: str) -> tuple[bool, Optional[str]]:
        """
        Validate code for safety.
        
        Returns (is_safe, error_message)
        """
        # Check for blocked operations in raw code
        for blocked in cls.BLOCKED_OPERATIONS:
            if blocked in code:
                return False, f"Blocked operation detected: {blocked}"
        
        # Parse AST for deeper analysis
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            return False, f"Syntax error: {e}"
        
        # Check all nodes
        for node in ast.walk(tree):
            # Block dangerous function calls
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id in cls.BLOCKED_OPERATIONS:
                        return False, f"Blocked function call: {node.func.id}"
            
            # Check imports
            if isinstance(node, ast.Import):
                for alias in node.names:
                    module = alias.name.split('.')[0]
                    if module not in ['telethon', 'datetime', 'json', 'asyncio', 're', 'math']:
                        return False, f"Blocked import: {alias.name}"
            
            if isinstance(node, ast.ImportFrom):
                module = node.module.split('.')[0] if node.module else ''
                if module not in ['telethon', 'datetime', 'json', 'asyncio', 're', 'math']:
                    return False, f"Blocked import: {node.module}"
        
        return True, None


class CommandExecutor:
    """Execute raw Telethon commands in a sandboxed environment."""
    
    # Store execution history
    _history: List[ExecutionResult] = []
    
    @classmethod
    async def execute(
        cls,
        code: str,
        timeout_seconds: float = 30.0,
    ) -> ExecutionResult:
        """
        Execute raw code with the Telegram client.
        
        The `client` variable is automatically available in the execution context.
        """
        start_time = datetime.utcnow()
        
        # Validate code
        is_safe, error = CodeValidator.validate(code)
        if not is_safe:
            result = ExecutionResult(
                success=False,
                output=None,
                error=f"Code validation failed: {error}",
                execution_time_ms=0,
                code=code,
                timestamp=start_time.isoformat(),
            )
            cls._history.append(result)
            return result
        
        try:
            # Get client
            client = await session_manager.get_client()
            raw_client = client._client  # Get actual Telethon client
            
            # Build execution context
            exec_globals = {
                'client': raw_client,
                'asyncio': asyncio,
                'datetime': datetime,
                'json': __import__('json'),
                're': __import__('re'),
                'print': print,
            }
            
            # Add Telethon types
            try:
                from telethon import types, functions
                exec_globals['types'] = types
                exec_globals['functions'] = functions
            except ImportError:
                pass
            
            exec_locals = {}
            
            # Wrap code in async function
            wrapped_code = f"""
async def __execute__():
{chr(10).join('    ' + line for line in code.split(chr(10)))}

__result__ = asyncio.get_event_loop().run_until_complete(__execute__())
"""
            
            # For simpler code that's already an expression or simple statement
            # Try direct async execution first
            try:
                # Check if it's a simple expression/call
                if code.strip().startswith('await '):
                    # Direct await expression
                    result = await asyncio.wait_for(
                        cls._execute_async(code, exec_globals),
                        timeout=timeout_seconds
                    )
                else:
                    # Try as expression first
                    result = await asyncio.wait_for(
                        cls._execute_async(f"return {code}", exec_globals),
                        timeout=timeout_seconds
                    )
            except SyntaxError:
                # Fall back to statement execution
                result = await asyncio.wait_for(
                    cls._execute_async(code, exec_globals),
                    timeout=timeout_seconds
                )
            
            # Calculate execution time
            end_time = datetime.utcnow()
            exec_time = (end_time - start_time).total_seconds() * 1000
            
            # Format output
            if result is not None:
                output = cls._format_output(result)
            else:
                output = "Command executed successfully (no return value)"
            
            exec_result = ExecutionResult(
                success=True,
                output=output,
                error=None,
                execution_time_ms=exec_time,
                code=code,
                timestamp=start_time.isoformat(),
            )
            
        except asyncio.TimeoutError:
            exec_result = ExecutionResult(
                success=False,
                output=None,
                error=f"Execution timed out after {timeout_seconds}s",
                execution_time_ms=timeout_seconds * 1000,
                code=code,
                timestamp=start_time.isoformat(),
            )
        except Exception as e:
            exec_result = ExecutionResult(
                success=False,
                output=None,
                error=f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}",
                execution_time_ms=(datetime.utcnow() - start_time).total_seconds() * 1000,
                code=code,
                timestamp=start_time.isoformat(),
            )
        
        cls._history.append(exec_result)
        return exec_result
    
    @classmethod
    async def _execute_async(cls, code: str, exec_globals: dict) -> Any:
        """Execute code as async function."""
        # Wrap in async function
        if code.strip().startswith('return '):
            func_code = f"async def __exec__():\n    {code}"
        else:
            lines = code.split('\n')
            indented = '\n'.join('    ' + line for line in lines)
            func_code = f"async def __exec__():\n{indented}"
        
        exec_locals = {}
        exec(func_code, exec_globals, exec_locals)
        
        return await exec_locals['__exec__']()
    
    @classmethod
    def _format_output(cls, result: Any) -> Any:
        """Format execution result for JSON serialization."""
        if result is None:
            return None
        
        # Handle common Telethon types
        if hasattr(result, 'to_dict'):
            return result.to_dict()
        
        if isinstance(result, (list, tuple)):
            return [cls._format_output(item) for item in result[:100]]  # Limit
        
        if isinstance(result, dict):
            return {k: cls._format_output(v) for k, v in list(result.items())[:100]}
        
        if isinstance(result, (str, int, float, bool)):
            return result
        
        if isinstance(result, datetime):
            return result.isoformat()
        
        # For complex objects, get their string representation
        try:
            return str(result)
        except:
            return repr(result)
    
    @classmethod
    def get_history(cls, limit: int = 50) -> List[Dict[str, Any]]:
        """Get execution history."""
        return [r.to_dict() for r in cls._history[-limit:]]
    
    @classmethod
    def clear_history(cls) -> None:
        """Clear execution history."""
        cls._history = []


class LLMCodeGenerator:
    """Generate Telethon code from natural language using LLM."""
    
    SYSTEM_PROMPT = """You are a Telethon/MTProto expert code generator.
Given a natural language description, generate Python code that uses the Telethon library.

The code will be executed in a context where:
- `client` is the connected TelegramClient instance
- `types` contains Telethon types (telethon.tl.types)
- `functions` contains Telethon functions (telethon.tl.functions)
- Standard modules available: asyncio, datetime, json, re

Rules:
1. Always use `await` for async operations
2. Keep code concise and focused on the task
3. Return the result if the user wants data back
4. Handle errors gracefully
5. Do NOT use dangerous operations (exec, eval, os, subprocess, etc.)

Output ONLY the Python code, no explanations or markdown formatting."""

    @classmethod
    async def generate(cls, description: str) -> str:
        """
        Generate Telethon code from natural language description.
        """
        if not settings.llm_api_key:
            raise ValueError("LLM API key not configured")
        
        prompt = f"""Generate Telethon Python code for the following task:

{description}

Remember: `client` is already available. Use `await` for async calls. Return results."""

        if settings.llm_provider == "gemini":
            return await cls._generate_gemini(prompt)
        else:
            return await cls._generate_openai(prompt)
    
    @classmethod
    async def _generate_gemini(cls, prompt: str) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.llm_model}:generateContent"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                params={"key": settings.llm_api_key},
                json={
                    "contents": [{
                        "parts": [
                            {"text": cls.SYSTEM_PROMPT},
                            {"text": prompt}
                        ]
                    }],
                    "generationConfig": {
                        "temperature": 0.2,
                        "maxOutputTokens": 2048,
                    }
                },
                timeout=30.0
            )
            
            if response.status_code != 200:
                raise Exception(f"Gemini API error: {response.text}")
            
            data = response.json()
            code = data["candidates"][0]["content"]["parts"][0]["text"]
            
            # Clean up code (remove markdown blocks if present)
            code = cls._clean_code(code)
            return code
    
    @classmethod
    async def _generate_openai(cls, prompt: str) -> str:
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
                        {"role": "system", "content": cls.SYSTEM_PROMPT},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.2,
                    "max_tokens": 2048,
                },
                timeout=30.0
            )
            
            if response.status_code != 200:
                raise Exception(f"OpenAI API error: {response.text}")
            
            data = response.json()
            code = data["choices"][0]["message"]["content"]
            
            return cls._clean_code(code)
    
    @classmethod
    def _clean_code(cls, code: str) -> str:
        """Clean up generated code."""
        code = code.strip()
        
        # Remove markdown code blocks
        if code.startswith('```python'):
            code = code[9:]
        elif code.startswith('```'):
            code = code[3:]
        
        if code.endswith('```'):
            code = code[:-3]
        
        return code.strip()


# Singleton instances
code_validator = CodeValidator()
command_executor = CommandExecutor()
llm_code_generator = LLMCodeGenerator()
