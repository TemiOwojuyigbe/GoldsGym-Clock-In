"""
app.py — Flask entry point for Gold's Gym Clock-In.

Run:
    python app.py

What this file does:
1. Creates the Flask app + secret key (for login tokens)
2. Configures SQLite
3. Registers auth, clock, and shift routes
4. Creates tables and seeds demo employee + admin
5. Starts the server on port 5000
"""

from flask import Flask
from flask_cors import CORS
from sqlalchemy import inspect

from models import db, Employee
from auth import hash_password
from routes.auth import auth_bp
from routes.clock import clock_bp
from routes.shifts import shift_bp
from routes.admin_extras import admin_bp
from routes.requests import requests_bp
from geofence import GYM_NAME, GYM_ADDRESS, GYM_RADIUS_METERS

# Demo accounts (learning MVP — change passwords in real use)
SEED_USERS = [
    {
        "name": "Alex Trainer",
        "email": "alex@goldsgym.local",
        "password": "password123",
        "role": "employee",
    },
    {
        "name": "Jordan Manager",
        "email": "jordan@goldsgym.local",
        "password": "password123",
        "role": "admin",
    },
]


def create_app():
    """Application factory — builds and configures the Flask app."""
    app = Flask(__name__)

    # Used to sign login tokens — change this in production
    app.config["SECRET_KEY"] = "goldsgym-dev-secret-change-me"

    # SQLite file (Flask keeps it under instance/ by default for relative URIs)
    # For Postgres later:
    #   app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://user:pass@localhost/gym"
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///gym_clock.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Allow the React frontend to call this API
    CORS(app)

    db.init_app(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(clock_bp)
    app.register_blueprint(shift_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(requests_bp)

    with app.app_context():
        _ensure_schema()
        _seed_users()

    @app.route("/")
    def health():
        """Simple check that the server is running."""
        return {
            "status": "ok",
            "message": "Gold's Gym Clock-In API is running",
            "gym": GYM_NAME,
            "address": GYM_ADDRESS,
            "geofence_radius_meters": GYM_RADIUS_METERS,
            "demo_accounts": [
                {"email": u["email"], "role": u["role"], "password": u["password"]}
                for u in SEED_USERS
            ],
        }

    return app


def _ensure_schema():
    """
    Create tables. If an old DB is missing password_hash/role, rebuild it
    so the new auth schema applies (fine for this learning MVP).
    """
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()
    if "employees" in tables:
        cols = {c["name"] for c in inspector.get_columns("employees")}
        if "password_hash" not in cols or "role" not in cols:
            print("Old schema detected — rebuilding tables for auth support...")
            db.drop_all()
    db.create_all()


def _seed_users():
    """Insert demo employee + admin if the table is empty."""
    if Employee.query.count() > 0:
        return

    for user in SEED_USERS:
        employee = Employee(
            name=user["name"],
            email=user["email"],
            password_hash=hash_password(user["password"]),
            role=user["role"],
        )
        db.session.add(employee)

    db.session.commit()
    print("Seeded demo users:")
    for user in SEED_USERS:
        print(f"  - {user['email']} / {user['password']}  (role={user['role']})")


if __name__ == "__main__":
    app = create_app()
    # debug=True auto-reloads on code changes (dev only)
    app.run(debug=True, port=5000)
