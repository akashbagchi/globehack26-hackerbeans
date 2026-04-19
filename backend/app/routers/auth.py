from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from app.services.auth import authenticate_mock, create_access_token
from app.dependencies import get_current_dispatcher

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    dispatcher_id: str
    name: str
    email: str
    fleet_id: str


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    dispatcher = authenticate_mock(body.email, body.password)
    if not dispatcher:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    token = create_access_token(dispatcher)
    return LoginResponse(access_token=token, **dispatcher)


@router.get("/me")
async def me(dispatcher: dict = Depends(get_current_dispatcher)):
    return dispatcher
