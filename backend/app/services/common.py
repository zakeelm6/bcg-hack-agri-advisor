from datetime import datetime


LANGS = ("en", "fr", "ar", "ary")   # ary = Moroccan Arabic (Darija), written in Arabic script


def lang_chain(lang: str) -> tuple:
    """Texts missing in Darija fall back to standard Arabic, then English."""
    return {"ary": ("ary", "ar", "en"), "ar": ("ar", "en"), "fr": ("fr", "en")}.get(lang, ("en",))


def ar_fallback(lang: str) -> str:
    """For texts that only exist in en, fr, ar: Darija reads the standard Arabic one."""
    return "ar" if lang == "ary" else lang


def pick(table: dict, lang: str, default: str) -> str:
    """table[lang] following the fallback chain, `default` (English) if nothing matches."""
    for l in lang_chain(lang):
        if l in table:
            return table[l]
    return default


def as_dict(obj) -> dict:
    """A database row as a plain dict with the column names as keys."""
    return {c.key: getattr(obj, c.key) for c in obj.__mapper__.column_attrs}


def now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds")


def clean_lang(lang: str) -> str:
    return lang if lang in LANGS else "en"
