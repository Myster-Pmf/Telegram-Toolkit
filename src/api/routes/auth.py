"""
Authentication Routes

Handles Telegram authentication flows:
- Phone + OTP
- QR Code login
- Session string import
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from src.telegram.session_manager import session_manager, SessionInfo

router = APIRouter()


class RequestCodeRequest(BaseModel):
    """Request body for OTP code request."""
    phone: str
    name: Optional[str] = None


class RequestCodeResponse(BaseModel):
    """Response for OTP code request."""
    success: bool
    phone: str
    message: str


class VerifyCodeRequest(BaseModel):
    """Request body for code verification."""
    phone: str
    code: str
    password: Optional[str] = None


class SessionStringRequest(BaseModel):
    """Request body for session string import."""
    session_string: str
    name: Optional[str] = None


class SessionResponse(BaseModel):
    """Response containing session info."""
    id: int
    name: str
    auth_type: str
    telegram_user_id: Optional[int]
    username: Optional[str]
    phone: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    is_bot: bool
    is_active: bool
    is_connected: bool


def session_to_response(session: SessionInfo) -> SessionResponse:
    """Convert SessionInfo to API response."""
    return SessionResponse(
        id=session.id,
        name=session.name,
        auth_type=session.auth_type,
        telegram_user_id=session.telegram_user_id,
        username=session.username,
        phone=session.phone,
        first_name=session.first_name,
        last_name=session.last_name,
        is_bot=session.is_bot,
        is_active=session.is_active,
        is_connected=session.is_connected,
    )


@router.post("/request-code", response_model=RequestCodeResponse)
async def request_code(request: RequestCodeRequest):
    """
    Request an OTP code for phone number authentication.
    
    Send a verification code to the provided phone number.
    """
    print(f"📱 [AUTH] Request code for phone: {request.phone}")
    try:
        print(f"📱 [AUTH] Calling session_manager.request_code...")
        code_request = await session_manager.request_code(
            phone=request.phone,
            name=request.name,
        )
        print(f"📱 [AUTH] Code sent successfully!")
        return RequestCodeResponse(
            success=True,
            phone=code_request.phone,
            message="Verification code sent to your Telegram app",
        )
    except ValueError as e:
        print(f"❌ [AUTH] ValueError: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ [AUTH] Exception: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to send code: {str(e)}")


@router.post("/verify-code", response_model=SessionResponse)
async def verify_code(request: VerifyCodeRequest):
    """
    Verify the OTP code and complete authentication.
    
    If 2FA is enabled, provide the password.
    """
    try:
        session = await session_manager.verify_code(
            phone=request.phone,
            code=request.code,
            password=request.password,
        )
        return session_to_response(session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        error_msg = str(e)
        if "password" in error_msg.lower() or "2fa" in error_msg.lower():
            raise HTTPException(
                status_code=401, 
                detail="Two-factor authentication required. Please provide password."
            )
        raise HTTPException(status_code=500, detail=f"Verification failed: {error_msg}")


@router.post("/import-session", response_model=SessionResponse)
async def import_session(request: SessionStringRequest):
    """
    Import an existing Telethon session string.
    
    Use this to add an account that was previously authenticated elsewhere.
    """
    try:
        session = await session_manager.import_session_string(
            session_string=request.session_string,
            name=request.name,
        )
        return session_to_response(session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@router.get("/me", response_model=Optional[SessionResponse])
async def get_current_session():
    """Get the currently active session."""
    session_id = session_manager.active_session_id
    if not session_id:
        return None
    
    session = await session_manager.get_session(session_id)
    if not session:
        return None
    
    return session_to_response(session)


# QR Code Login Storage (in-memory for simplicity)
_qr_login_states: dict = {}


class QRGenerateResponse(BaseModel):
    """Response for QR code generation."""
    token: str
    url: str  # The tg://login URL to encode in QR


class QRStatusResponse(BaseModel):
    """Response for QR code status check."""
    status: str  # 'pending', 'scanned', 'success', 'expired', 'error'
    session: Optional[SessionResponse] = None
    message: Optional[str] = None


@router.post("/qr/generate", response_model=QRGenerateResponse)
async def generate_qr_login():
    """
    Generate a QR code login token.
    
    Returns a URL that should be encoded as a QR code.
    The user scans this with their Telegram mobile app.
    """
    import uuid
    import asyncio
    from telethon import TelegramClient
    from telethon.sessions import StringSession
    from src.config import settings
    
    try:
        # Create a new client for QR login
        token = str(uuid.uuid4())
        client = TelegramClient(
            StringSession(),
            settings.api_id,
            settings.api_hash,
            device_model="Telegram Toolkit",
            system_version="Web",
            app_version="1.0.0"
        )
        
        await client.connect()
        
        # Start QR login
        qr_login = await client.qr_login()
        
        # Store the state
        _qr_login_states[token] = {
            'client': client,
            'qr_login': qr_login,
            'status': 'pending',
            'session': None,
        }
        
        # Schedule cleanup after 2 minutes
        async def cleanup():
            await asyncio.sleep(120)
            if token in _qr_login_states:
                state = _qr_login_states.pop(token, None)
                if state and state.get('client'):
                    await state['client'].disconnect()
        
        asyncio.create_task(cleanup())
        
        return QRGenerateResponse(
            token=token,
            url=qr_login.url
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate QR: {str(e)}")


@router.get("/qr/status/{token}", response_model=QRStatusResponse)
async def check_qr_status(token: str):
    """
    Check the status of a QR code login.
    
    Poll this endpoint until status becomes 'success' or 'expired'.
    """
    if token not in _qr_login_states:
        return QRStatusResponse(status='expired', message='QR code expired or not found')
    
    state = _qr_login_states[token]
    qr_login = state.get('qr_login')
    client = state.get('client')
    
    if not qr_login or not client:
        return QRStatusResponse(status='error', message='Invalid state')
    
    try:
        import asyncio
        
        # Wait briefly for scan
        try:
            await asyncio.wait_for(qr_login.wait(timeout=2), timeout=3)
        except asyncio.TimeoutError:
            # Still waiting for scan
            # Check if we need to recreate the QR (it expires every ~30 seconds)
            if qr_login.expired:
                await qr_login.recreate()
                return QRStatusResponse(
                    status='pending', 
                    message='QR refreshed, rescan required'
                )
            return QRStatusResponse(status='pending')
        
        # If we get here, login was successful
        session_string = client.session.save()
        
        # Import the session
        session = await session_manager.import_session_string(
            session_string=session_string,
            name="QR Login"
        )
        
        # Clean up
        state['status'] = 'success'
        state['session'] = session
        _qr_login_states.pop(token, None)
        
        await client.disconnect()
        
        return QRStatusResponse(
            status='success',
            session=session_to_response(session)
        )
    except Exception as e:
        _qr_login_states.pop(token, None)
        if client:
            await client.disconnect()
        return QRStatusResponse(status='error', message=str(e))


class SessionFileRequest(BaseModel):
    """Request body for session file import."""
    session_data: str  # Base64 encoded .session file content
    name: Optional[str] = None


@router.post("/import-session-file", response_model=SessionResponse)
async def import_session_file(request: SessionFileRequest):
    """
    Import a .session file (SQLite database).
    
    The session file should be base64 encoded.
    """
    import base64
    import tempfile
    import os
    from telethon import TelegramClient
    from telethon.sessions import StringSession
    from src.config import settings
    
    try:
        # Decode the base64 session file
        session_bytes = base64.b64decode(request.session_data)
        
        # Write to a temporary file
        with tempfile.NamedTemporaryFile(suffix='.session', delete=False) as f:
            f.write(session_bytes)
            temp_path = f.name
        
        try:
            # Create a client with this session file
            session_name = temp_path.replace('.session', '')
            client = TelegramClient(
                session_name,
                settings.api_id,
                settings.api_hash
            )
            
            await client.connect()
            
            # Check if authorized
            if not await client.is_user_authorized():
                await client.disconnect()
                raise ValueError("Session file is not authorized")
            
            # Convert to string session for storage
            session_string = StringSession.save(client.session)
            
            await client.disconnect()
            
            # Import the string session
            session = await session_manager.import_session_string(
                session_string=session_string,
                name=request.name or "Imported Session"
            )
            
            return session_to_response(session)
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
