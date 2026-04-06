from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func
from datetime import date, timedelta

from database import get_db
from models import User, Session, SessionFrame
from auth import get_current_user

router = APIRouter(
    prefix="/stats",
    tags=["Statistics"]
)

# ==========================
# OVERALL STATS
# GET /stats/overall
# ==========================
@router.get("/overall")
def get_overall_stats(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    total_days = db.query(Session).filter(
        Session.user_id == current_user.id
    ).count()

    total_duration = db.query(
        func.sum(Session.total_duration)
    ).filter(
        Session.user_id == current_user.id
    ).scalar() or 0

    avg_score = db.query(
        func.avg(Session.posture_score)
    ).filter(
        Session.user_id == current_user.id
    ).scalar() or 0

    return {
        "total_days": total_days,
        "total_duration": total_duration,
        "average_score": round(avg_score, 2)
    }


# ==========================
# CURRENT LIVE STATS
# GET /stats/current
# ==========================
@router.get("/current")
def get_current_live_stats(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    live_frames = db.query(SessionFrame).filter(
        SessionFrame.user_id == current_user.id
    ).all()

    if not live_frames:
        return {
            "live_status": None,
            "live_duration_mins": 0,
            "live_good_pct": 0,
            "live_bad_pct": 0
        }

    total_live_frames = len(live_frames)

    good_frames = sum(
        1 for frame in live_frames
        if frame.status.lower() == "good"
    )

    bad_frames = total_live_frames - good_frames

    return {
        "live_status": live_frames[-1].status,
        "live_duration_mins": round(
            (total_live_frames * 10) / 60,
            2
        ),
        "live_good_pct": round(
            (good_frames / total_live_frames) * 100,
            2
        ),
        "live_bad_pct": round(
            (bad_frames / total_live_frames) * 100,
            2
        )
    }


# ==========================
# LAST 30 DAYS GRAPH
# GET /stats/history
# ==========================
@router.get("/history")
def get_history_graph(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db)
):
    thirty_days_ago = date.today() - timedelta(days=30)

    sessions = db.query(Session).filter(
        Session.user_id == current_user.id,
        Session.date >= thirty_days_ago
    ).order_by(
        Session.date.asc()
    ).all()

    return [
        {
            "date": session.date,
            "score": session.posture_score
        }
        for session in sessions
    ]
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