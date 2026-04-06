from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
from models import User
from dotenv import load_dotenv
import os

load_dotenv()

# ==========================
# CONFIG
# ==========================
SECRET_KEY               = os.getenv("SECRET_KEY")
ALGORITHM                = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_DAYS = int(os.getenv("ACCESS_TOKEN_EXPIRE_DAYS"))

# ==========================
# PASSWORD HASHING
# ==========================
pwd_context = CryptContext(
    schemes    = ["bcrypt"],
    deprecated = "auto"
)

# ==========================
# OAuth2 SCHEME
# Tells FastAPI to look for
# token in Authorization header
# ==========================
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl = "/auth/login"
)

# ==========================
# HASH PASSWORD
# ==========================
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

# ==========================
# VERIFY PASSWORD
# ==========================
def verify_password(
    plain_password  : str,
    hashed_password : str
) -> bool:
    return pwd_context.verify(
        plain_password,
        hashed_password
    )

# ==========================
# CREATE JWT TOKEN
# ==========================
def create_access_token(data: dict) -> str:
    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(
        days = ACCESS_TOKEN_EXPIRE_DAYS
    )
    to_encode.update({"exp": expire})

    token = jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm = ALGORITHM
    )
    return token

# ==========================
# VERIFY JWT TOKEN
# ==========================
def verify_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms = [ALGORITHM]
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail      = "Invalid or expired token"
        )

# ==========================
# GET CURRENT USER
# Used as dependency in
# protected routes
# ==========================
def get_current_user(
    token : str     = Depends(oauth2_scheme),
    db    : Session = Depends(get_db)
) -> User:

    payload = verify_token(token)

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail      = "Invalid token payload"
        )

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail      = "User not found"
        )

    return user