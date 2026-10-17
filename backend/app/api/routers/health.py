from fastapi import APIRouter

from ...schemas.responses import Ok

router = APIRouter()


@router.get("/api/health", response_model=Ok)
def health():
    return {"ok": True}
