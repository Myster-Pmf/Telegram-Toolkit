/**
 * Auth API Client
 * 
 * Handles all authentication API calls to the backend.
 */

const API_BASE = '/api/auth';

export interface SessionInfo {
    id: number;
    name: string;
    auth_type: string;
    telegram_user_id: number | null;
    username: string | null;
    phone: string | null;
    first_name: string | null;
    last_name: string | null;
    is_bot: boolean;
    is_active: boolean;
    is_connected: boolean;
}

export interface RequestCodeResponse {
    success: boolean;
    phone: string;
    message: string;
}

export interface ApiError {
    detail: string | { code: string; message: string };
}

/**
 * Request OTP code for phone authentication
 */
export async function requestCode(phone: string, name?: string): Promise<RequestCodeResponse> {
    const response = await fetch(`${API_BASE}/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name }),
    });

    if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(typeof error.detail === 'string' ? error.detail : error.detail.message);
    }

    return response.json();
}

/**
 * Verify OTP code and complete authentication
 */
export async function verifyCode(
    phone: string,
    code: string,
    password?: string
): Promise<SessionInfo> {
    const response = await fetch(`${API_BASE}/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, password }),
    });

    if (!response.ok) {
        const error: ApiError = await response.json();
        // Check for 2FA required
        if (response.status === 401) {
            const err = new Error('2FA_REQUIRED');
            (err as any).code = '2FA_REQUIRED';
            throw err;
        }
        throw new Error(typeof error.detail === 'string' ? error.detail : error.detail.message);
    }

    return response.json();
}

/**
 * Import a Telethon session string
 */
export async function importSessionString(
    sessionString: string,
    name?: string
): Promise<SessionInfo> {
    const response = await fetch(`${API_BASE}/import-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_string: sessionString, name }),
    });

    if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(typeof error.detail === 'string' ? error.detail : error.detail.message);
    }

    return response.json();
}

/**
 * Get the currently active session
 */
export async function getCurrentSession(): Promise<SessionInfo | null> {
    const response = await fetch(`${API_BASE}/me`);

    if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to get current session');
    }

    const data = await response.json();
    return data || null;
}

/**
 * List all stored sessions
 */
export async function listSessions(): Promise<SessionInfo[]> {
    const response = await fetch('/api/sessions');

    if (!response.ok) {
        throw new Error('Failed to list sessions');
    }

    const data = await response.json();
    return data.sessions || [];
}

/**
 * Switch to a different session
 */
export async function switchSession(sessionId: number): Promise<SessionInfo> {
    const response = await fetch(`/api/sessions/${sessionId}/switch`, {
        method: 'POST',
    });

    if (!response.ok) {
        throw new Error('Failed to switch session');
    }

    return response.json();
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: number): Promise<void> {
    const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error('Failed to delete session');
    }
}

/**
 * Export a session as string
 */
export async function exportSession(sessionId: number): Promise<string> {
    const response = await fetch(`/api/sessions/${sessionId}/export`);

    if (!response.ok) {
        throw new Error('Failed to export session');
    }

    const data = await response.json();
    return data.session_string;
}


// QR Code Login Types
export interface QRGenerateResponse {
    token: string;
    url: string;
}

export interface QRStatusResponse {
    status: 'pending' | 'scanned' | 'success' | 'expired' | 'error';
    session?: SessionInfo;
    message?: string;
}

/**
 * Generate a QR code login token
 */
export async function generateQR(): Promise<QRGenerateResponse> {
    const response = await fetch(`${API_BASE}/qr/generate`, {
        method: 'POST',
    });

    if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(typeof error.detail === 'string' ? error.detail : error.detail.message);
    }

    return response.json();
}

/**
 * Poll QR code login status
 */
export async function pollQRStatus(token: string): Promise<QRStatusResponse> {
    const response = await fetch(`${API_BASE}/qr/status/${token}`);

    if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(typeof error.detail === 'string' ? error.detail : error.detail.message);
    }

    return response.json();
}

/**
 * Import a session file (base64 encoded)
 */
export async function importSessionFile(sessionData: string, name?: string): Promise<SessionInfo> {
    const response = await fetch(`${API_BASE}/import-session-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_data: sessionData, name }),
    });

    if (!response.ok) {
        const error: ApiError = await response.json();
        throw new Error(typeof error.detail === 'string' ? error.detail : error.detail.message);
    }

    return response.json();
}
