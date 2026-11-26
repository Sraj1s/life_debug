"""Validated request and response types."""
from datetime import date, datetime, timezone
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator

Status = Literal["completed", "missed", "rescheduled", "skipped"]
Reason = Literal["outside", "tired", "distracted", "too_difficult", "other"]

class CommitmentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    scheduled_time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    frequency: Literal["daily", "weekdays", "weekly", "once"] = "daily"

    planned_date: date | None = None

    @model_validator(mode="after")
    def validate_plan(self):
        if (self.frequency == "once") != (self.planned_date is not None):
            raise ValueError("A planned date is required for one-time commitments only")
        return self

    @field_validator("title")
    @classmethod
    def clean_title(cls, title: str) -> str:
        title = title.strip()
        if not title:
            raise ValueError("Title cannot be blank")
        return title

class CommitmentRead(CommitmentCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    active: bool
    created_at: datetime

class CheckInCreate(BaseModel):
    status: Status
    reason: Reason | None = None
    note: str | None = Field(default=None, max_length=500)

class CheckInRead(CheckInCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    commitment_id: int
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, value: datetime) -> str:
        return (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).isoformat()


class InsightRead(BaseModel):
    checkins: int
    completed: int
    completion_rate: float | None
    top_obstacle: str | None
    reflection: str
    disclaimer: str = "Patterns are observations, not proof of causation or medical advice."
