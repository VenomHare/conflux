export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (
      response.status === 401 &&
      typeof window !== "undefined" &&
      !location.pathname.startsWith("/login") &&
      !location.pathname.startsWith("/register")
    ) {
      location.assign(`/login?next=${encodeURIComponent(location.pathname)}`);
    }
    throw new ApiError(
      body?.error?.message ?? "Something went wrong. Please try again.",
      response.status,
      body?.error?.code ?? "request_failed",
    );
  }
  return body.data as T;
}

export const send = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
