// HTTP client for the FastAPI analytics service. The service is stateless:
// it fetches and computes, and this backend persists what it returns.

// FastAPI gives each environmental provider up to 240 s, so a fetch can take
// several minutes. Keep below undici's 300 s default headers timeout.
const DEFAULT_TIMEOUT_MS = 270000;

class AnalyticsServiceError extends Error {
  constructor(message, { status = null, detail = null } = {}) {
    super(message);
    this.name = "AnalyticsServiceError";
    this.status = status;
    this.detail = detail;
  }
}

function baseUrl() {
  const url = process.env.ANALYTICS_SERVICE_URL;
  if (!url) throw new AnalyticsServiceError("ANALYTICS_SERVICE_URL is not configured.");
  return url.replace(/\/+$/, "");
}

async function postJson(path, payload) {
  const url = `${baseUrl()}${path}`;
  const timeoutMs = Number(process.env.ANALYTICS_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err.name === "TimeoutError") {
      throw new AnalyticsServiceError(`Analytics service did not respond within ${timeoutMs / 1000} s.`);
    }
    throw new AnalyticsServiceError("Analytics service is unreachable.", { detail: err.cause?.code || err.message });
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AnalyticsServiceError(`Analytics service returned HTTP ${response.status}.`, {
      status: response.status,
      detail: body?.detail ?? null,
    });
  }
  if (!body) {
    throw new AnalyticsServiceError("Analytics service returned an invalid response body.", { status: response.status });
  }
  return body;
}

// payload: { assessment_id, radius_km, location, project, assessment_inputs }
// (see analytics-service/app/schemas.py EnvironmentalDataRequest).
function fetchEnvironmentalData(payload) {
  return postJson("/api/environmental/fetch", payload);
}

module.exports = { fetchEnvironmentalData, AnalyticsServiceError };
