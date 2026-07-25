"""
models.py — Database table definitions for Gold's Gym Clock-In.

Tables:
  - employees, clock_events, shifts
  - edit_requests — staff punch-fix requests awaiting manager approval
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

db = SQLAlchemy()


class Employee(db.Model):
    """
    One row per gym staff member.
    role: \"employee\" | \"admin\"
    """

    __tablename__ = "employees"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="employee")

    clock_events = db.relationship("ClockEvent", backref="employee", lazy=True)
    shifts = db.relationship("Shift", backref="employee", lazy=True)
    edit_requests = db.relationship(
        "EditRequest",
        backref="employee",
        lazy=True,
        foreign_keys="EditRequest.employee_id",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
        }


class ClockEvent(db.Model):
    """One row per clock-in or clock-out punch."""

    __tablename__ = "clock_events"

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(
        db.Integer, db.ForeignKey("employees.id"), nullable=False
    )
    type = db.Column(db.String(20), nullable=False)  # in | out | break_start | break_end
    timestamp = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "employee_name": self.employee.name if self.employee else None,
            "type": self.type,
            "timestamp": self.timestamp.isoformat(),
            "latitude": self.latitude,
            "longitude": self.longitude,
        }


class Shift(db.Model):
    """One row per scheduled shift (manager creates these)."""

    __tablename__ = "shifts"

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(
        db.Integer, db.ForeignKey("employees.id"), nullable=False
    )
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    notes = db.Column(db.String(255), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "employee_name": self.employee.name if self.employee else None,
            "employee_role": self.employee.role if self.employee else None,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "notes": self.notes,
        }


class EditRequest(db.Model):
    """
    Staff request to fix or add a punch — managers approve/reject.

    request_type:
      - fix_time  → change an existing clock_event's time (and optionally type)
      - add_punch → create a missing punch (no GPS; manager-approved)
    status: pending | approved | rejected
    """

    __tablename__ = "edit_requests"

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(
        db.Integer, db.ForeignKey("employees.id"), nullable=False
    )
    clock_event_id = db.Column(
        db.Integer, db.ForeignKey("clock_events.id"), nullable=True
    )
    request_type = db.Column(db.String(20), nullable=False)
    punch_type = db.Column(db.String(10), nullable=False)  # in | out
    proposed_timestamp = db.Column(db.DateTime, nullable=False)
    reason = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="pending")
    reviewer_id = db.Column(
        db.Integer, db.ForeignKey("employees.id"), nullable=True
    )
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    reviewed_at = db.Column(db.DateTime, nullable=True)

    clock_event = db.relationship("ClockEvent", foreign_keys=[clock_event_id])
    reviewer = db.relationship("Employee", foreign_keys=[reviewer_id])

    def to_dict(self):
        return {
            "id": self.id,
            "employee_id": self.employee_id,
            "employee_name": self.employee.name if self.employee else None,
            "clock_event_id": self.clock_event_id,
            "request_type": self.request_type,
            "punch_type": self.punch_type,
            "proposed_timestamp": self.proposed_timestamp.isoformat(),
            "reason": self.reason,
            "status": self.status,
            "reviewer_id": self.reviewer_id,
            "reviewer_name": self.reviewer.name if self.reviewer else None,
            "created_at": self.created_at.isoformat(),
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "original_event": self.clock_event.to_dict() if self.clock_event else None,
        }
