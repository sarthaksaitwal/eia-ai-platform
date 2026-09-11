from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8000
    cors_origins: str = "http://localhost:5000,http://localhost:3000"

    # Sent on every outbound request - public services such as Overpass ask
    # clients to identify themselves.
    user_agent: str = "eia-ai-platform-analytics/0.1"
    http_timeout_seconds: float = 60.0
    # Upper bound for any single provider (including retries/fallbacks), so one
    # slow service cannot hold the whole response hostage.
    provider_deadline_seconds: float = Field(default=240.0, gt=0)

    # Default radius for nearby monitoring stations and wide-area GIS features.
    # OpenAQ caps point+radius searches at 25 km.
    default_radius_km: float = Field(default=25.0, gt=0, le=25)
    # Station values older than this are dropped so a stale reading is never
    # presented as the current baseline.
    max_observation_age_days: int = Field(default=30, ge=1)

    # OpenAQ v3 requires an API key (X-API-Key). Without one OpenAQ is "skipped".
    openaq_api_key: Optional[str] = None
    openaq_max_locations: int = Field(default=3, ge=1, le=10)

    # data.gov.in (India OGD) key for the CPCB real-time air quality dataset.
    ogd_api_key: Optional[str] = None
    cpcb_max_stations: int = Field(default=3, ge=1, le=10)

    # Tried in order; the main public instance is frequently overloaded.
    overpass_endpoints: str = (
        "https://overpass-api.de/api/interpreter,"
        "https://overpass.private.coffee/api/interpreter,"
        "https://overpass.kumi.systems/api/interpreter"
    )
    overpass_timeout_seconds: int = 120

    # Number of full calendar years used for historical climate statistics.
    climate_history_years: int = Field(default=10, ge=1, le=40)

    earthquake_search_radius_km: float = Field(default=300.0, gt=0)
    earthquake_min_magnitude: float = 4.0
    earthquake_start_year: int = 1970

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def overpass_endpoint_list(self) -> list[str]:
        return [url.strip() for url in self.overpass_endpoints.split(",") if url.strip()]


settings = Settings()
