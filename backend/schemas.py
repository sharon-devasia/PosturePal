from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date, datetime
from uuid import UUID

# ==========================
# AUTH SCHEMAS
# ==========================

# Register request
class RegisterRequest(BaseModel):
    name     : str
    email    : EmailStr
    password : str

# Login request
class LoginRequest(BaseModel):
    email    : EmailStr
    password : str

# Token response
# Returned after login or register
class TokenResponse(BaseModel):
    access_token : str
    token_type   : str = "bearer"

# User response
# Returned when getting current user
class UserResponse(BaseModel):
    id         : UUID
    name       : str
    email      : str
    created_at : datetime

    class Config:
        from_attributes = True

# ==========================
# SESSION SCHEMAS
# ==========================

# When session ends
# Frontend sends this to backend
class SessionEndRequest(BaseModel):
    good_pct       : float
    bad_pct        : float
    avg_blink_rate : float
    alert_count    : int
    posture_score  : float
    duration_mins  : int

# Session response
# Returned when getting session data
class SessionResponse(BaseModel):
    id             : UUID
    date           : date
    total_duration : int
    good_pct       : float
    bad_pct        : float
    avg_blink_rate : float
    alert_count    : int
    posture_score  : float
    session_count  : int

    class Config:
        from_attributes = True

# ==========================
# SESSION FRAME SCHEMAS
# ==========================

# Frontend sends this every 10 seconds
class FrameRequest(BaseModel):
    status     : str
    blink_rate : int
    confidence : float

# ==========================
# STATS SCHEMAS
# ==========================
# Stats for a specific date
class DayStatsResponse(BaseModel):
    date           : date
    total_duration : int
    good_pct       : float
    bad_pct        : float
    avg_blink_rate : float
    alert_count    : int
    posture_score  : float
    session_count  : int

    class Config:
        from_attributes = True

# Overall all time stats
class OverallStatsResponse(BaseModel):
    total_days        : int
    total_duration    : int
    avg_posture_score : float
    avg_blink_rate    : float
    best_day          : Optional[date]
    best_score        : Optional[float]
    total_alerts      : int
