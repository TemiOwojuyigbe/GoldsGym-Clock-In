"""
models.py — Database table definitions for Gold's Gym Clock-In.

Tables:
  - employees: gym staff
  - clock_events: actual clock-in / clock-out punches (with GPS)
  - shifts: manager-scheduled shifts (planned work)

Swap SQLite for Postgres later by changing DATABASE_URI in app.py —
these models stay the same.
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

# Shared SQLAlchemy instance — app.py calls db.init_app(app)
db = SQLAlchemy()


class Employee(db.Model):
    """One row per gym staff member."""

    __tablename__ = "employees"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)

    clock_events = db.relationship("ClockEvent", backref="employee", lazy=True)
    shifts = db.relationship("Shift", backref="employee", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
        }


class ClockEvent(db.Model):
    """One row per clock-in or clock-out punch."""

    __tablename__ = "clock_events"

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(
        db.Integer, db.ForeignKey("employees.id"), nullable=False
    )
    type = db.Column(db.String(10), nullable=False)  # "in" or "out"
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
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "notes": self.notes,
        }
