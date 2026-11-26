"""Life Debug local development API. NOT ready for public internet access."""
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session
from .database import Base, SessionLocal, engine
from .models import Commitment, CheckIn
from .schemas import CommitmentCreate, CommitmentRead, CheckInCreate, CheckInRead, InsightRead
from .insights import summarize
from .auth import current_user

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="Life Debug API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:8081", "http://127.0.0.1:8081"], allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

def db_session():
    with SessionLocal() as session:
        yield session

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/commitments", response_model=CommitmentRead, status_code=201)
def create_commitment(payload: CommitmentCreate, user_id: str = Depends(current_user), db: Session = Depends(db_session)):
    item = Commitment(user_id=user_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@app.get("/commitments", response_model=list[CommitmentRead])
def list_commitments(user_id: str = Depends(current_user), db: Session = Depends(db_session)):
    return db.scalars(select(Commitment).where(Commitment.active.is_(True), Commitment.user_id == user_id).order_by(Commitment.scheduled_time, Commitment.id)).all()

@app.post("/commitments/{commitment_id}/checkins", response_model=CheckInRead, status_code=201)
def create_checkin(commitment_id: int, payload: CheckInCreate, user_id: str = Depends(current_user), db: Session = Depends(db_session)):
    item = db.get(Commitment, commitment_id)
    if item is None or not item.active or item.user_id != user_id:
        raise HTTPException(404, "Commitment not found")
    event = CheckIn(commitment_id=commitment_id, **payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event

@app.get("/checkins", response_model=list[CheckInRead])
def list_checkins(user_id: str = Depends(current_user), db: Session = Depends(db_session)):
    return db.scalars(select(CheckIn).join(Commitment).where(Commitment.user_id == user_id).order_by(CheckIn.created_at.desc(), CheckIn.id.desc())).all()

@app.get("/insights", response_model=InsightRead)
def get_insights(user_id: str = Depends(current_user), db: Session = Depends(db_session)):
    return summarize(list(db.scalars(select(CheckIn).join(Commitment).where(Commitment.user_id == user_id).order_by(CheckIn.created_at.desc(), CheckIn.id.desc()))))
