from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.services.auth import decode_token

bearer = HTTPBearer()


def get_current_dispatcher(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    payload = decode_token(credentials.credentials)
    if not payload or "dispatcher_id" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {
        "dispatcher_id": payload["dispatcher_id"],
        "name": payload["name"],
        "email": payload["email"],
        "fleet_id": payload["fleet_id"],
    }
