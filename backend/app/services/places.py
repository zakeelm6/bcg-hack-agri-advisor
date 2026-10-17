"""Name of the place at a position, for the onboarding question "Where is your farm?".

The browser asks us instead of asking a map service directly: the farmer's exact position then goes from our server, not from
their phone, to the place-name service (BigDataCloud's keyless client endpoint), without their address or cookies. The result is
cached by rounded position. When the service does not answer we say so (place = null) and the app shows the coordinates.
"""
from collections import OrderedDict

import httpx

URL = "https://api.bigdatacloud.net/data/reverse-geocode-client"
LANGS = {"en": "en", "fr": "fr", "ar": "ar", "ary": "ar"}   # Darija asks for Arabic place names
TIMEOUT_S = 6.0
_cache: "OrderedDict[tuple, str]" = OrderedDict()
_CACHE_MAX = 256


def place_at(lat: float, lon: float, lang: str = "en") -> str | None:
    lang = LANGS.get(lang, "en")
    key = (round(lat, 2), round(lon, 2), lang)      # about one kilometre: good enough for a town name
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key]
    try:
        r = httpx.get(URL, params={"latitude": round(lat, 4), "longitude": round(lon, 4), "localityLanguage": lang}, timeout=TIMEOUT_S)
        r.raise_for_status()
        j = r.json()
    except (httpx.HTTPError, ValueError):
        return None
    name = j.get("city") or j.get("locality") or j.get("principalSubdivision") or None
    if name:
        _cache[key] = name
        while len(_cache) > _CACHE_MAX:
            _cache.popitem(last=False)
    return name
