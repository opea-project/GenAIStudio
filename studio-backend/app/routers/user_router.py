# app/routers/user_router.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/users/{user_id}")
def read_user(user_id: int):
    return {"user_id": user_id}