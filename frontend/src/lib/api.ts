import type {
  Assessment,
  AssessmentDetail,
  AssessmentInput,
  AuthResponse,
  Coefficient,
  EnvironmentalFetchResult,
  NewAssessmentInput,
  NewProjectRequest,
  Project,
  Role,
  Rule,
  Standard,
  StoredEnvironmentalData,
  User,
} from "./types";

// Empty by default: the Vite dev server proxies /api to the backend, so
// relative URLs are same-origin and no CORS preflight happens. Point
// VITE_API_BASE_URL at an absolute URL only when that proxy is not in play.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

const TOKEN_KEY = "eia.token";

// The backend's error middleware always answers { error: "..." }, so a failed
// request carries a message worth showing. ApiError keeps the status too,
// because 401 means "log in again" while 400 means "fix the form".
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Sessions survive a page reload, which matters because fetching the
// environmental baseline takes minutes and people navigate away. Reading
// localStorage throws in some privacy modes, so every access is guarded.
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token === null) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // A session that cannot be persisted still works until the page reloads.
  }
}

// Fired when the backend rejects the stored token, so the auth provider can
// clear it and show the sign-in screen without every caller handling 401.
export const UNAUTHORIZED_EVENT = "eia:unauthorized";

interface RequestOptions {
  method?: string;
  body?: unknown;
  // Fetching the baseline calls a dozen external providers and routinely
  // takes over a minute, so it passes its own ceiling.
  timeoutMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 30_000;

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Honour a caller's own cancellation (component unmount) as well as the timeout.
  if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    // An aborted request is not a server problem, so it says so plainly.
    if (controller.signal.aborted) {
      throw new ApiError(0, "The request was cancelled or timed out.");
    }
    throw new ApiError(
      0,
      "Could not reach the backend. Check that it is running on the port the dev server proxies to."
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) {
    setToken(null);
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(401, "Your session has expired. Please sign in again.");
  }

  // 204 from DELETE has no body to parse.
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // A non-JSON body means something other than the API answered,
      // most often the dev proxy failing to reach the backend.
      throw new ApiError(
        response.status,
        `The server returned a response that was not JSON (HTTP ${response.status}).`
      );
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed with HTTP ${response.status}.`;
    throw new ApiError(response.status, message);
  }

  return payload as T;
}

export const api = {
  // ---- auth -------------------------------------------------------------
  register(input: {
    name: string;
    email: string;
    password: string;
    role: Role;
    organization?: string;
  }) {
    return request<AuthResponse>("/api/auth/register", { method: "POST", body: input });
  },

  login(input: { email: string; password: string }) {
    return request<AuthResponse>("/api/auth/login", { method: "POST", body: input });
  },

  me() {
    return request<{ user: User }>("/api/auth/me");
  },

  // ---- projects ---------------------------------------------------------
  listProjects() {
    return request<{ projects: Project[] }>("/api/projects");
  },

  getProject(id: string) {
    return request<{ project: Project }>(`/api/projects/${id}`);
  },

  createProject(input: NewProjectRequest) {
    return request<{ project: Project }>("/api/projects", { method: "POST", body: input });
  },

  // updateProject takes the column names, not the camelCase the create route
  // uses; see updateProject's allow-list in backend projectModel.js.
  updateProject(id: string, fields: Record<string, unknown>) {
    return request<{ project: Project }>(`/api/projects/${id}`, { method: "PUT", body: fields });
  },

  deleteProject(id: string) {
    return request<void>(`/api/projects/${id}`, { method: "DELETE" });
  },

  // ---- assessments ------------------------------------------------------
  listAssessments(projectId: string) {
    return request<{ assessments: Assessment[] }>(`/api/projects/${projectId}/assessments`);
  },

  createAssessment(projectId: string, methodologyVersion?: string) {
    return request<{ assessment: Assessment }>(`/api/projects/${projectId}/assessments`, {
      method: "POST",
      body: { methodologyVersion },
    });
  },

  getAssessment(id: string) {
    return request<{ assessment: AssessmentDetail }>(`/api/assessments/${id}`);
  },

  addInputs(assessmentId: string, inputs: NewAssessmentInput[]) {
    return request<{ inputs: AssessmentInput[] }>(`/api/assessments/${assessmentId}/inputs`, {
      method: "POST",
      body: { inputs },
    });
  },

  listInputs(assessmentId: string) {
    return request<{ inputs: AssessmentInput[] }>(`/api/assessments/${assessmentId}/inputs`);
  },

  // ---- environmental baseline -------------------------------------------
  // Calls a dozen external providers through FastAPI. Minutes, not seconds.
  fetchEnvironmentalData(assessmentId: string, radiusKm?: number, signal?: AbortSignal) {
    return request<EnvironmentalFetchResult>(
      `/api/assessments/${assessmentId}/environmental-data`,
      {
        method: "POST",
        body: radiusKm === undefined ? {} : { radiusKm },
        timeoutMs: 300_000,
        signal,
      }
    );
  },

  getEnvironmentalData(assessmentId: string) {
    return request<StoredEnvironmentalData>(`/api/assessments/${assessmentId}/environmental-data`);
  },

  // ---- reference data ---------------------------------------------------
  listCoefficients(params: { industry?: string; factor?: string } = {}) {
    const q = new URLSearchParams();
    if (params.industry) q.set("industry", params.industry);
    if (params.factor) q.set("factor", params.factor);
    const suffix = q.toString() ? `?${q}` : "";
    return request<{ coefficients: Coefficient[] }>(`/api/reference/coefficients${suffix}`);
  },

  listStandards(
    params: { category?: string; parameter?: string; zone?: string; verified?: boolean } = {}
  ) {
    const q = new URLSearchParams();
    if (params.category) q.set("category", params.category);
    if (params.parameter) q.set("parameter", params.parameter);
    if (params.zone) q.set("zone", params.zone);
    if (params.verified) q.set("verified", "true");
    const suffix = q.toString() ? `?${q}` : "";
    return request<{ standards: Standard[]; unverified_count: number }>(
      `/api/reference/standards${suffix}`
    );
  },

  listRules(factor?: string) {
    const suffix = factor ? `?factor=${encodeURIComponent(factor)}` : "";
    return request<{ rules: Rule[] }>(`/api/reference/rules${suffix}`);
  },
};
