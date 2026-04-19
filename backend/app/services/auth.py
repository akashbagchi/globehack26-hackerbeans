from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
from jose import JWTError, jwt
from app.config import settings

# Pre-computed bcrypt hash of "demo1234"
_MARIA_HASH = "$2b$10$eJ.wYpNndnzQ8xX1/WztNeTpTs6wTmPb3ThTrgISTRPzB6zkpWnCe"

MOCK_DISPATCHERS = {
    "maria@sauron.fleet": {
        "dispatcher_id": "DISP001",
        "name": "Maria Santos",
        "email": "maria@sauron.fleet",
        "fleet_id": "FLEET001",
        "role": "dispatcher",
        "password_hash": _MARIA_HASH,
    }
}


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours)
    payload["exp"] = expire
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None


def authenticate_mock(email: str, password: str) -> Optional[dict]:
    dispatcher = MOCK_DISPATCHERS.get(email.lower())
    if not dispatcher:
        return None
    if not verify_password(password, dispatcher["password_hash"]):
        return None
    return {k: v for k, v in dispatcher.items() if k != "password_hash"}
