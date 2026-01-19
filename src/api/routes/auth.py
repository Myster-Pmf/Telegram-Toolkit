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
