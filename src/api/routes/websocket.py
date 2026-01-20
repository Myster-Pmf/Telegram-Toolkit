"""
WebSocket Routes

Real-time message streaming via WebSocket.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
import asyncio
import json
from telethon import events

from src.telegram.session_manager import session_manager

router = APIRouter()

# Active WebSocket connections
active_connections: List[WebSocket] = []


@router.websocket("/messages")
async def websocket_messages(websocket: WebSocket):
    """
    WebSocket endpoint for real-time message updates.
    
    Clients connect here to receive new messages in real-time.
    """
    await websocket.accept()
    active_connections.append(websocket)
    
    # Flag to track if we're still connected
    is_connected = True
    
    # Get the client and set up event handler
    try:
        client = await session_manager.get_client()
        raw_client = client.raw_client
        
        # Event handler for new messages
        @raw_client.on(events.NewMessage)
        async def handler(event):
            if not is_connected:
                return
                
            try:
                message = event.message
                sender = await event.get_sender()
                
                # Build message data
                msg_data = {
                    "type": "new_message",
                    "data": {
                        "id": message.id,
                        "chat_id": event.chat_id,
                        "sender_id": sender.id if sender else None,
                        "sender_name": getattr(sender, 'first_name', '') or getattr(sender, 'title', 'Unknown') if sender else 'Unknown',
                        "text": message.text or '',
                        "date": message.date.isoformat() if message.date else None,
                        "has_media": message.media is not None,
                        "media_type": type(message.media).__name__ if message.media else None,
                        "is_outgoing": message.out,
                    }
                }
                
                # Broadcast to this connection
                await websocket.send_json(msg_data)
            except Exception as e:
                print(f"Error broadcasting message: {e}")
        
        # Keep connection alive with periodic pings
        while is_connected:
            try:
                # Wait for message from client (ping/pong or disconnect)
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                
                # Handle ping
                if data == "ping":
                    await websocket.send_text("pong")
                elif data == "subscribe":
                    # Client wants to start receiving messages
                    await websocket.send_json({"type": "subscribed", "message": "Now receiving real-time updates"})
            except asyncio.TimeoutError:
                # Send heartbeat
                try:
                    await websocket.send_json({"type": "heartbeat"})
                except:
                    break
            except WebSocketDisconnect:
                break
            except Exception as e:
                print(f"WebSocket error: {e}")
                break
                
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
    finally:
        is_connected = False
        if websocket in active_connections:
            active_connections.remove(websocket)
        try:
            await websocket.close()
        except:
            pass
