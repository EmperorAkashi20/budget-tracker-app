const BASE_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) ||
  "http://35.154.226.176:4000";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
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
  return (await res.json()) as T;
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
  getTrip: (id: string) => http(`/api/trips/${id}`),
  saveTrip: (trip: unknown) =>
    http<{ ok: true; id: string }>("/api/trips", {
      method: "POST",
      body: JSON.stringify(trip),
    }),
  deleteTrip: (id: string) =>
    http<{ ok: true }>(`/api/trips/${id}`, { method: "DELETE" }),
  health: () => http<{ ok: boolean }>("/health"),
};
