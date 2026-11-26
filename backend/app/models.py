"""Persisted commitments and user-reported check-ins."""
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

class Commitment(Base):
    __tablename__ = "commitments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    scheduled_time: Mapped[str] = mapped_column(String(5), nullable=False)
    frequency: Mapped[str] = mapped_column(String(20), default="daily")
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    checkins: Mapped[list["CheckIn"]] = relationship(back_populates="commitment", cascade="all, delete-orphan")

class CheckIn(Base):
    __tablename__ = "checkins"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    commitment_id: Mapped[int] = mapped_column(ForeignKey("commitments.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(60), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    commitment: Mapped[Commitment] = relationship(back_populates="checkins")
