// Cliente HTTP fino sobre fetch. Nunca se guarda ningun token: la sesion vive en la cookie
// httpOnly que gestiona el navegador (credentials: "include"). La cabecera X-Requested-With
// es la mitigacion CSRF ligera que exige el backend en las rutas que cambian estado
// (ver docs/security.md) — se envia siempre, es inofensiva en peticiones de solo lectura.

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export type QueryValue = string | number | boolean | undefined | null;

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  query?: Record<string, QueryValue>;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  // Concatenacion simple en vez de "new URL(path, base)": permite que API_URL sea tanto una URL
  // absoluta (desarrollo: http://localhost:3000) como una ruta relativa al propio origen
  // (produccion: /api, detras del proxy de nginx) — "new URL()" exige una base absoluta y ademas
  // una ruta que empieza por "/" sustituye el path completo de la base, perdiendo el "/api".
  const base = API_URL.endsWith("/") ? API_URL.slice(0, -1) : API_URL;
  let url = base + path;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    }
    const queryString = params.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }
  return url;
}

function extractMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message: unknown }).message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  }
  return fallback;
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query } = options;
  const isFormData = body instanceof FormData;

  const response = await fetch(buildUrl(path, query), {
    method,
    credentials: "include",
    headers: {
      // FormData (subida de ficheros) fija su propio Content-Type con el boundary del
      // multipart; si lo fijamos nosotros a mano, el navegador no lo sustituye y la peticion
      // llega sin boundary.
      ...(body !== undefined && !isFormData ? { "Content-Type": "application/json" } : {}),
      "X-Requested-With": "XMLHttpRequest",
    },
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new ApiError(response.status, extractMessage(data, response.statusText), data);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Record<string, QueryValue>) => apiRequest<T>(path, { method: "GET", query }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
};
