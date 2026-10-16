from datetime import datetime


def as_dict(obj) -> dict:
    """A database row as a plain dict with the column names as keys."""
    return {c.key: getattr(obj, c.key) for c in obj.__mapper__.column_attrs}


def now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds")


def clean_lang(lang: str) -> str:
    return lang if lang in ("en", "fr", "ar") else "en"
