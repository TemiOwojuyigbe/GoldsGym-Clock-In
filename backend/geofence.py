"""
geofence.py — Gym location check for clock-in / clock-out.

Gold's Gym Bowie:
  12510 Fairwood Pkwy, Bowie, MD 20720
  Approx coords from map data for that address.

The backend (not just the browser) decides if a punch is allowed.
"""

from math import radians, sin, cos, sqrt, atan2

# --- Gym pin (center of the allowed circle) ---
GYM_NAME = "Gold's Gym Bowie"
GYM_ADDRESS = "12510 Fairwood Pkwy, Bowie, MD 20720"
GYM_LATITUDE = 38.9643582
GYM_LONGITUDE = -76.7871191

# How close you must be (meters). 200m covers parking lot + indoor GPS drift.
GYM_RADIUS_METERS = 200


def distance_meters(lat1, lon1, lat2, lon2):
    """
    Haversine formula — great-circle distance between two GPS points in meters.
    """
    r = 6371000  # Earth radius in meters
    phi1, phi2 = radians(lat1), radians(lat2)
    d_phi = radians(lat2 - lat1)
    d_lambda = radians(lon2 - lon1)

    a = sin(d_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(d_lambda / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return r * c


def check_at_gym(latitude, longitude):
    """
    Return (ok, payload).
      ok=True  → within radius; payload has distance_meters
      ok=False → too far or missing coords; payload has error message
    """
    if latitude is None or longitude is None:
        return False, {
            "error": "lat and long are required to verify you are at the gym.",
        }

    try:
        lat = float(latitude)
        lng = float(longitude)
    except (TypeError, ValueError):
        return False, {"error": "lat and long must be numbers."}

    dist = distance_meters(lat, lng, GYM_LATITUDE, GYM_LONGITUDE)

    if dist > GYM_RADIUS_METERS:
        return False, {
            "error": (
                f"You must be at {GYM_NAME} to clock in/out. "
                f"You are about {int(dist)}m away "
                f"(allowed: {GYM_RADIUS_METERS}m)."
            ),
            "distance_meters": round(dist, 1),
            "allowed_radius_meters": GYM_RADIUS_METERS,
            "gym": {
                "name": GYM_NAME,
                "address": GYM_ADDRESS,
                "latitude": GYM_LATITUDE,
                "longitude": GYM_LONGITUDE,
            },
        }

    return True, {
        "distance_meters": round(dist, 1),
        "allowed_radius_meters": GYM_RADIUS_METERS,
    }
