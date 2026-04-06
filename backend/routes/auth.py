from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    UserResponse
)
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user
)
from google.oauth2 import id_token
from google.auth.transport import requests
import uuid

router = APIRouter(
    prefix = "/auth",
    tags   = ["Authentication"]
)

# ==========================
# REGISTER
# POST /auth/register
# ==========================
@router.post("/register", response_model=TokenResponse)
def register(
    request : RegisterRequest,
    db      : Session = Depends(get_db)
):
    # Check if email already exists
    existing_user = db.query(User).filter(
        User.email == request.email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail      = "Email already registered"
        )

    # Hash password
    hashed = hash_password(request.password)

    # Create new user
    new_user = User(
        id            = uuid.uuid4(),
        name          = request.name,
        email         = request.email,
        password_hash = hashed
    )

    # Save to database
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create JWT token
    token = create_access_token(data={
        "user_id" : str(new_user.id),
        "email"   : new_user.email
    })

    return TokenResponse(access_token=token)


# ==========================
# LOGIN
# POST /auth/login
# ==========================
from pydantic import BaseModel
from sqlalchemy import or_

class LoginRequestBody(BaseModel):
    identifier: str
    password: str

@router.post("/login", response_model=TokenResponse)
def login(
    request: LoginRequestBody,
    db: Session = Depends(get_db)
):
    identifier = request.identifier

    user = db.query(User).filter(
        or_(
            User.email == identifier,
            User.name == identifier
        )
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password"
        )

    if not verify_password(
        request.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password"
        )

    token = create_access_token(data={
        "user_id": str(user.id),
        "email": user.email
    })

    return TokenResponse(access_token=token)

# ==========================
# GET CURRENT USER
# GET /auth/me
# Protected route
# ==========================
@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user)
):
    return current_user


# ==========================
# CHECK EMAIL EXISTS
# GET /auth/check-email
# ==========================
@router.get("/check-email")
def check_email(
    email : str,
    db    : Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.email == email
    ).first()

    return {"exists": user is not None}


@router.post("/google")
def google_login(
    request: dict,
    db: Session = Depends(get_db)
):
    token = request["token"]

    try:
        info = id_token.verify_oauth2_token(
            token,
            requests.Request(),
            GOOGLE_CLIENT_ID
        )

        email = info["email"]
        name = info.get("name")
        google_id = info["sub"]

    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid Google token"
        )

    user = db.query(User).filter(
        User.email == email
    ).first()

    if not user:
        user = User(
            name=name,
            email=email,
            google_id=google_id
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    jwt_token = create_access_token({
        "user_id": str(user.id),
        "email": user.email
    })

    return {
        "access_token": jwt_token
    }