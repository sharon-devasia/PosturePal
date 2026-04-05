from sqlalchemy import Column, String, Float, Integer, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from database import Base
import uuid

# ==========================
# USERS TABLE
# ==========================
class User(Base):
    __tablename__ = "users"

    id            = Column(UUID(as_uuid=True), 
                          primary_key=True, 
                          default=uuid.uuid4)
    name          = Column(String(100), nullable=False)
    email         = Column(String(255), unique=True, 
                          nullable=False)
    password_hash = Column(String(255), nullable=True)
    google_id     = Column(String(255), nullable=True)
    created_at    = Column(DateTime, 
                          server_default=func.now())


# ==========================
# SESSIONS TABLE
# One row per day per user
# ==========================
class Session(Base):
    __tablename__ = "sessions"

    id             = Column(UUID(as_uuid=True),
                           primary_key=True,
                           default=uuid.uuid4)
    user_id        = Column(UUID(as_uuid=True),
                           ForeignKey("users.id"),
                           nullable=False)
    date           = Column(Date, nullable=False)
    total_duration = Column(Integer, default=0)
    good_pct       = Column(Float, default=0)
    bad_pct        = Column(Float, default=0)
    avg_blink_rate = Column(Float, default=0)
    alert_count    = Column(Integer, default=0)
    posture_score  = Column(Float, default=0)
    session_count  = Column(Integer, default=1)


# ==========================
# SESSION FRAMES TABLE
# Live data during monitoring
# Deleted after session ends
# ==========================
class SessionFrame(Base):
    __tablename__ = "session_frames"

    id          = Column(UUID(as_uuid=True),
                        primary_key=True,
                        default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True),
                        ForeignKey("users.id"),
                        nullable=False)
    timestamp   = Column(DateTime,
                        server_default=func.now())
    status      = Column(String(10))
    blink_rate  = Column(Integer)
    confidence  = Column(Float)