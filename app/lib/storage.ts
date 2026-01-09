import { AppState, Trip } from "@/app/lib/types";

const STORAGE_KEY = "budget-tracker:state:v1";

export function loadAppState(): AppState | undefined {
	if (typeof window === "undefined") return undefined;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return undefined;
		const parsed = JSON.parse(raw) as AppState;
		return parsed;
	} catch {
		return undefined;
	}
}

export function saveAppState(state: AppState): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// ignore write errors
	}
}

export function upsertTrip(state: AppState, trip: Trip): AppState {
	const idx = state.trips.findIndex((t) => t.id === trip.id);
	const trips = [...state.trips];
	if (idx >= 0) {
		trips[idx] = trip;
	} else {
		trips.push(trip);
	}
	return { ...state, trips, activeTripId: trip.id };
}

export function deleteTrip(state: AppState, tripId: string): AppState {
	const trips = state.trips.filter((t) => t.id !== tripId);
	const activeTripId =
		state.activeTripId === tripId ? trips[0]?.id : state.activeTripId;
	return { ...state, trips, activeTripId };
}

export function generateId(prefix: string = "id"): string {
	const rand = Math.random().toString(36).slice(2, 8);
	const time = Date.now().toString(36);
	return `${prefix}_${time}_${rand}`;
}





