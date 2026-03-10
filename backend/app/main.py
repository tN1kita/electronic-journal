from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routers.auth import router as auth_router
from app.api.routers.users import router as users_router
from app.api.routers.journals import router as journals_router
from app.api.routers.admin import router as admin_router

app = FastAPI(title="EJour API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(users_router, prefix="/api/users", tags=["users"])
app.include_router(journals_router, prefix="/api/journals", tags=["journals"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])