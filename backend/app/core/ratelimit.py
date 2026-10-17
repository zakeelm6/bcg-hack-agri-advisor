"""A simple sliding-window brake (per process). It protects paid services (model key, Azure Speech) from loops and abuse."""
import time
from collections import deque


class Brake:
    def __init__(self, limit: int, window: int = 60):
        self.limit, self.window, self._calls = limit, window, deque()

    def allow(self) -> bool:
        now = time.time()
        while self._calls and now - self._calls[0] > self.window:
            self._calls.popleft()
        if len(self._calls) >= self.limit:
            return False
        self._calls.append(now)
        return True


from .config import settings  # noqa: E402

copilot_brake = Brake(settings.copilot_calls_per_minute)   # shared by the Copilot, photo reading and the React chat route
voice_brake = Brake(settings.voice_calls_per_minute)
geo_brake = Brake(30)   # place-name lookups
device_brake = Brake(settings.new_devices_per_minute)   # new phones registered
