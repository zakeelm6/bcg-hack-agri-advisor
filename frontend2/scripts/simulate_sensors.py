"""Posts simulated soil-moisture readings to a running Farm Advisor server.

Usage:  python scripts/simulate_sensors.py [--url http://127.0.0.1:8000] [--dry]
These readings are SIMULATED. The app labels the sensors as simulated.
"""
import argparse
import random
import time

import httpx

ap = argparse.ArgumentParser()
ap.add_argument("--url", default="http://127.0.0.1:8000")
ap.add_argument("--dry", action="store_true", help="simulate a dry spell (moisture drops)")
ap.add_argument("--loops", type=int, default=3)
args = ap.parse_args()

base = {1: 0.30, 2: 0.26}  # sensor id -> typical moisture fraction
for i in range(args.loops):
    for sid, m in base.items():
        value = m - (0.08 * (i + 1) if args.dry else 0) + random.uniform(-0.01, 0.01)
        value = round(max(0.05, min(0.45, value)), 3)
        r = httpx.post(f"{args.url}/api/sensors/{sid}/readings", json={"moisture": value, "temp_c": 21.0}, timeout=10)
        print(f"sensor {sid}: {value} -> {r.status_code}")
    time.sleep(1.1)
