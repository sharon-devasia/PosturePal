from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func
from datetime import date, timedelta, datetime
from database import get_db
from models import User, Session, SessionFrame
from schemas import FrameRequest, SessionResponse
from auth import get_current_user

router = APIRouter(
    prefix="/sessions",
    tags=["Sessions"]
)

# ==========================
# START SESSION
# POST /sessions/start
# ==========================
@router.post("/start")
def start_session(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    # Clear any unfinished previous frames
    db.query(SessionFrame).filter(
        SessionFrame.user_id == current_user.id
    ).delete()

    db.commit()

    return {
        "message": "Monitoring started"
    }


# ==========================
# SAVE FRAME
# POST /sessions/frame
# ==========================
@router.post("/frame")
def save_frame(
    request: FrameRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    frame = SessionFrame(
        user_id=current_user.id,
        status=request.status,
        blink_rate=request.blink_rate,
        confidence=request.confidence
    )

    db.add(frame)
    db.commit()

    return {
        "message": "Frame saved"
    }


# ==========================
# END SESSION
# POST /sessions/end
# ==========================
@router.post("/end", response_model=SessionResponse)
def end_session(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    frames = db.query(SessionFrame).filter(
        SessionFrame.user_id == current_user.id
    ).all()

    if not frames:
        raise HTTPException(
            status_code=400,
            detail="No session frames found"
        )

    total_frames = len(frames)

    good_frames = sum(
        1 for frame in frames
        if frame.status.lower() == "good"
    )

    bad_frames = total_frames - good_frames

    good_pct = round((good_frames / total_frames) * 100, 2)
    bad_pct = round((bad_frames / total_frames) * 100, 2)

    avg_blink_rate = round(
        sum(frame.blink_rate for frame in frames) / total_frames,
        2
    )

    avg_confidence = round(
        sum(frame.confidence for frame in frames) / total_frames,
        2
    )

    duration_mins = total_frames * 10 / 60

    posture_score = round(
        (good_pct * 0.7) + (avg_confidence * 30),
        2
    )

    alert_count = bad_frames

    today = date.today()

    existing_session = db.query(Session).filter(
        Session.user_id == current_user.id,
        Session.date == today
    ).first()

    if existing_session:
        existing_session.total_duration += int(duration_mins)
        existing_session.good_pct = good_pct
        existing_session.bad_pct = bad_pct
        existing_session.avg_blink_rate = avg_blink_rate
        existing_session.alert_count += alert_count
        existing_session.posture_score = posture_score
        existing_session.session_count += 1

        db.commit()
        db.refresh(existing_session)

        session_result = existing_session

    else:
        new_session = Session(
            user_id=current_user.id,
            date=today,
            total_duration=int(duration_mins),
            good_pct=good_pct,
            bad_pct=bad_pct,
            avg_blink_rate=avg_blink_rate,
            alert_count=alert_count,
            posture_score=posture_score,
            session_count=1
        )

        db.add(new_session)
        db.commit()
        db.refresh(new_session)

        session_result = new_session

    # Delete temporary frames
    db.query(SessionFrame).filter(
        SessionFrame.user_id == current_user.id
    ).delete()

    db.commit()

    return session_result


# ==========================
# TODAY SESSION
# GET /sessions/today
# ==========================
@router.get("/today", response_model=SessionResponse)
def get_today_session(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    today = date.today()

    session = db.query(Session).filter(
        Session.user_id == current_user.id,
        Session.date == today
    ).first()

    if not session:
        raise HTTPException(
            status_code=404,
            detail="No session found for today"
        )

    return session


# ==========================
# choose data form the calendar
# GET /sessions/history
# ==========================

@router.get("/history", response_model=SessionResponse)
def get_history_by_date(
    selected_date: str,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    try:
        chosen_date = datetime.strptime(
            selected_date,
            "%Y-%m-%d"
        ).date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Date must be in YYYY-MM-DD format"
        )

    session = db.query(Session).filter(
        Session.user_id == current_user.id,
        Session.date == chosen_date
    ).first()

    if not session:
        raise HTTPException(
            status_code=404,
            detail="No session data found for selected date"
        )

    return session
@router.get("/dashboard")
def get_dashboard_data(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    today = date.today()

    # completed sessions for today
    today_session = db.query(Session).filter(
        Session.user_id == current_user.id,
        Session.date == today
    ).first()

    # current live frames
    live_frames = db.query(SessionFrame).filter(
        SessionFrame.user_id == current_user.id
    ).all()

    # -------------------------
    # CURRENT STATS
    # from session_frames only
    # -------------------------
    current_stats = None

    if live_frames:
        total_live_frames = len(live_frames)

        good_live_frames = sum(
            1 for frame in live_frames
            if frame.status.lower() == "good"
        )

        bad_live_frames = total_live_frames - good_live_frames

        current_stats = {
            "current_status": live_frames[-1].status,
            "current_blink_rate": live_frames[-1].blink_rate,
            "current_confidence": live_frames[-1].confidence,
            "live_good_pct": round(
                (good_live_frames / total_live_frames) * 100,
                2
            ),
            "live_bad_pct": round(
                (bad_live_frames / total_live_frames) * 100,
                2
            ),
            "live_duration_mins": round(
                (total_live_frames * 10) / 60,
                2
            )
        }

    # -------------------------
    # TODAY TOTAL
    # from both tables
    # -------------------------
    saved_duration = (
        today_session.total_duration
        if today_session else 0
    )

    live_duration = round(
        (len(live_frames) * 10) / 60,
        2
    )

    today_total = {
        "total_duration_mins":
            round(saved_duration + live_duration, 2),

        "saved_score":
            today_session.posture_score
            if today_session else None,

        "saved_alerts":
            today_session.alert_count
            if today_session else 0,

        "session_count":
            (
                today_session.session_count + 1
                if today_session and live_frames
                else today_session.session_count
                if today_session
                else 1 if live_frames
                else 0
            )
    }

    return {
        "current_stats": current_stats,
        "today_total": today_total
    }