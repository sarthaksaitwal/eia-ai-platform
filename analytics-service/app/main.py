from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import environmental_data

# Stateless by design: this service fetches and computes, and returns
# structured JSON. The Node backend owns all database persistence.
app = FastAPI(
    title="EIA Platform - Analytical Service",
    description="Environmental data retrieval, GIS analysis, engineering calculations, and ML risk prediction.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(environmental_data.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
