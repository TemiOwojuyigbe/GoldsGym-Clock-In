"""
app.py — Flask entry point for Gold's Gym Clock-In.

Run:
    python app.py

What this file does:
1. Creates the Flask app
2. Configures SQLite (swap URI later for Postgres)
3. Registers clock + shift routes
4. Creates tables and seeds a test employee
5. Starts the server on port 5000
"""

from flask import Flask
from flask_cors import CORS

from models import db, Employee
from routes.clock import clock_bp
from routes.shifts import shift_bp

# Hardcoded test employee so you can demo without auth yet.
TEST_EMPLOYEE = {
    "name": "Alex Trainer",
    "email": "alex@goldsgym.local",
}


def create_app():
    """Application factory — builds and configures the Flask app."""
    app = Flask(__name__)

    # SQLite file is created next to this script as gym_clock.db
    # For Postgres later:
    #   app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://user:pass@localhost/gym"
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///gym_clock.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Allow the React frontend (localhost:5173) to call this API
    CORS(app)

    db.init_app(app)

    app.register_blueprint(clock_bp)
    app.register_blueprint(shift_bp)

    with app.app_context():
        db.create_all()
        _seed_test_employee()

    @app.route("/")
    def health():
        """Simple check that the server is running."""
        return {
            "status": "ok",
            "message": "Gold's Gym Clock-In API is running",
            "test_employee_id": 1,
        }

    return app


def _seed_test_employee():
    """Insert the test employee if the employees table is empty."""
    if Employee.query.count() == 0:
        employee = Employee(
            name=TEST_EMPLOYEE["name"],
            email=TEST_EMPLOYEE["email"],
        )
        db.session.add(employee)
        db.session.commit()
        print(f"Seeded test employee: id={employee.id} ({employee.name})")


if __name__ == "__main__":
    app = create_app()
    # debug=True auto-reloads on code changes (dev only)
    app.run(debug=True, port=5000)
