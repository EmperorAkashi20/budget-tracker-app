const BASE_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) ||
  "http://35.154.226.176:4000";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const errorMsg = `Request failed ${res.status}: ${text}`;
      console.error(`API Error [${path}]:`, errorMsg);
      throw new Error(errorMsg);
    }

    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await res.text().catch(() => "");
      console.error(
        `API Error [${path}]: Expected JSON but got ${contentType}`,
        text
      );
      throw new Error(
        `Invalid response format: expected JSON, got ${contentType}`
      );
    }

    const data = await res.json();
    return data as T;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`API Error [${path}]:`, error.message);
      throw error;
    }
    console.error(`API Error [${path}]:`, error);
    throw new Error(`Request failed: ${String(error)}`);
  }
}

export type TripListItem = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  updated_at: string;
};

export const api = {
  listTrips: () => http<{ trips: TripListItem[] }>("/api/trips"),
  getTrip: (id: string) => http<unknown>(`/api/trips/${id}`),
  saveTrip: (trip: unknown) =>
    http<{ ok: true; id: string }>("/api/trips", {
      method: "POST",
      body: JSON.stringify(trip),
    }),
  deleteTrip: (id: string) =>
    http<{ ok: true }>(`/api/trips/${id}`, { method: "DELETE" }),
  health: () => http<{ ok: boolean }>("/health"),
};
