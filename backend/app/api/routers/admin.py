from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.registration_log import RegistrationLog
from app.models.user import User

router = APIRouter()


@router.get("/registrations", dependencies=[Depends(require_admin)])
def registrations(db: Session = Depends(get_db)):
    """
    Лог регистраций: кто зарегистрировался и когда.
    Видно только админу.
    """
    rows = (
        db.query(RegistrationLog, User)
        .join(User, User.id == RegistrationLog.user_id)
        .order_by(RegistrationLog.registered_at.desc())
        .all()
    )
    return [
        {
            "user_id": u.id,
            "email": u.email,
            "fio": u.fio_short(),
            "registered_at": log.registered_at.isoformat(),
        }
        for log, u in rows
    ]