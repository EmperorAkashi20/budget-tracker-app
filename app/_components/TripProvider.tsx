/* eslint-disable @next/next/no-img-element */
"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import seedTrip from "@/app/seed/vietnam-jan-2026.json";
import { AppState, Trip, TripDay, DayTransaction, SummarySnapshot, CurrencyCode } from "@/app/lib/types";
import { generateId, loadAppState, saveAppState, upsertTrip, deleteTrip } from "@/app/lib/storage";
import { api } from "@/app/lib/api";

type TripContextValue = {
	state: AppState;
	activeTrip?: Trip;
	setActiveTripId: (tripId?: string) => void;
	createTrip: (trip: Omit<Trip, "id" | "createdAt" | "updatedAt" | "version">) => Trip;
	updateTrip: (trip: Trip) => void;
	removeTrip: (tripId: string) => void;
	updateExchangeRate: (vndPerUsd: number) => void;
	updateBudgetsForDay: (dayNumber: number, updater: (day: TripDay) => TripDay) => void;
	addCategoryToDay: (dayNumber: number, categoryName: string, budgetVnd?: number) => void;
	removeCategoryFromDay: (dayNumber: number, categoryName: string) => void;
	addTransaction: (dayNumber: number, tx: Omit<DayTransaction, "id" | "createdAt">) => void;
	removeTransaction: (dayNumber: number, txId: string) => void;
	updateDayNotes: (dayNumber: number, notes: string) => void;
	getSummarySnapshot: () => SummarySnapshot | undefined;
	exportBundle: () => string;
	importBundle: (json: string) => void;
};

const TripContext = createContext<TripContextValue | undefined>(undefined);

export function TripProvider({ children }: { children: React.ReactNode }) {
	const [state, setState] = useState<AppState>({ trips: [] });

	// initial load from localStorage or seed
	useEffect(() => {
		let cancelled = false;
		async function init() {
			// Try backend first
			try {
				await api.health();
				const list = await api.listTrips();
				if (!cancelled && list.trips.length > 0) {
					// load first trip fully
					const firstId = list.trips[0].id;
					const full = (await api.getTrip(firstId)) as Trip;
					setState({ trips: [full], activeTripId: full.id });
					return;
				}
				// if backend empty, seed and push to backend
				const seed: Trip = {
					...(seedTrip as unknown as Trip),
					id: (seedTrip as unknown as Trip).id || generateId("trip"),
					version: 1,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				};
				await api.saveTrip(seed);
				if (!cancelled) setState({ trips: [seed], activeTripId: seed.id });
				return;
			} catch {
				// Backend not reachable → localStorage fallback
				const loaded = loadAppState();
				if (loaded && loaded.trips?.length) {
					if (!cancelled) setState(loaded);
					return;
				}
				const seed: Trip = {
					...(seedTrip as unknown as Trip),
					id: (seedTrip as unknown as Trip).id || generateId("trip"),
					version: 1,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				};
				if (!cancelled) setState({ trips: [seed], activeTripId: seed.id });
			}
		}
		void init();
		return () => {
			cancelled = true;
		};
	}, []);

	// persist
	useEffect(() => {
		saveAppState(state);
	}, [state]);

	const activeTrip = useMemo(
		() => state.trips.find((t) => t.id === state.activeTripId),
		[state.trips, state.activeTripId]
	);

	function setActiveTripId(tripId?: string) {
		setState((s) => ({ ...s, activeTripId: tripId }));
	}

	function createTrip(
		tripWithoutIds: Omit<Trip, "id" | "createdAt" | "updatedAt" | "version">
	): Trip {
		const trip: Trip = {
			...tripWithoutIds,
			id: generateId("trip"),
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			version: 1
		};
		setState((s) => upsertTrip(s, trip));
		return trip;
	}

	function updateTrip(trip: Trip) {
		trip.updatedAt = new Date().toISOString();
		setState((s) => upsertTrip(s, trip));
		// fire-and-forget backend sync
		void api.saveTrip(trip).catch(() => {});
	}

	function removeTrip(tripId: string) {
		setState((s) => deleteTrip(s, tripId));
		void api.deleteTrip(tripId).catch(() => {});
	}

	function mutateActiveTrip(mutator: (trip: Trip) => Trip) {
		setState((s) => {
			const t = s.trips.find((x) => x.id === s.activeTripId);
			if (!t) return s;
			const next = mutator({ ...t, days: t.days.map((d) => ({ ...d })) });
			// sync to backend
			void api.saveTrip(next).catch(() => {});
			return upsertTrip(s, next);
		});
	}

	function getBaseCurrency(trip: Trip): CurrencyCode {
		return trip.currencies?.base || trip.baseCurrency || "VND";
	}

	function getRateToBase(trip: Trip, code: CurrencyCode): number {
		if (trip.currencies) {
			if (code === trip.currencies.base) return 1;
			return trip.currencies.rates[code] ?? 0;
		}
		// legacy: base is VND, secondary USD
		if (code === "VND") return 1;
		if (code === "USD") return trip.exchangeRateVndPerUsd;
		return 0;
	}

	function getTotalFundsInBase(trip: Trip): number {
		if (trip.currencies) {
			return (trip.currencies.funds || []).reduce((sum, f) => sum + f.amount * getRateToBase(trip, f.code), 0);
		}
		return trip.totalVndAvailable + trip.totalUsdAvailable * trip.exchangeRateVndPerUsd;
	}

	function updateExchangeRate(vndPerUsd: number) {
		mutateActiveTrip((t) => ({ ...t, exchangeRateVndPerUsd: vndPerUsd }));
	}

	function updateBudgetsForDay(dayNumber: number, updater: (day: TripDay) => TripDay) {
		mutateActiveTrip((t) => {
			const days = t.days.map((d) => (d.dayNumber === dayNumber ? updater({ ...d, categories: d.categories.map((c) => ({ ...c })) }) : d));
			return { ...t, days };
		});
	}

	function addCategoryToDay(dayNumber: number, categoryName: string, budgetVnd: number = 0) {
		const name = categoryName.trim();
		if (!name) return;
		mutateActiveTrip((t) => {
			const days = t.days.map((d) => {
				if (d.dayNumber !== dayNumber) return d;
				const exists = d.categories.some((c) => c.name.toLowerCase() === name.toLowerCase());
				if (exists) return d;
				return {
					...d,
					categories: [...d.categories, { name, budgetVnd, actualVnd: 0 }]
				};
			});
			return { ...t, days };
		});
	}

	function removeCategoryFromDay(dayNumber: number, categoryName: string) {
		const name = categoryName.trim();
		if (!name) return;
		mutateActiveTrip((t) => {
			const days = t.days.map((d) => {
				if (d.dayNumber !== dayNumber) return d;
				const cat = d.categories.find((c) => c.name === name);
				const hasTx = (d.transactions || []).some((tx) => tx.categoryName === name);
				// safety: only allow removing if no transactions and actual is zero
				if (hasTx || (cat?.actualVnd ?? 0) > 0) return d;
				return {
					...d,
					categories: d.categories.filter((c) => c.name !== name)
				};
			});
			return { ...t, days };
		});
	}

	function addTransaction(dayNumber: number, tx: Omit<DayTransaction, "id" | "createdAt">) {
		mutateActiveTrip((t) => {
			const days = t.days.map((d) => {
				if (d.dayNumber !== dayNumber) return d;
				const rate = getRateToBase(t, tx.originalCurrency);
				const amountBase = tx.amountBase ?? tx.originalAmount * (rate || 0);
				const newTx: DayTransaction = {
					categoryName: tx.categoryName,
					originalAmount: tx.originalAmount,
					originalCurrency: tx.originalCurrency,
					amountBase,
					id: generateId("tx"),
					createdAt: new Date().toISOString()
				};
				const categories = d.categories.map((c) =>
					c.name === tx.categoryName ? { ...c, actualVnd: c.actualVnd + amountBase } : c
				);
				return { ...d, categories, transactions: [newTx, ...(d.transactions || [])] };
			});
			return { ...t, days };
		});
	}

	function removeTransaction(dayNumber: number, txId: string) {
		mutateActiveTrip((t) => {
			const days = t.days.map((d) => {
				if (d.dayNumber !== dayNumber) return d;
				const tx = (d.transactions || []).find((x) => x.id === txId);
				let categories = d.categories;
				if (tx) {
					const delta = typeof (tx as any).amountBase === "number" ? (tx as any).amountBase : (tx as any).amountVnd || 0;
					categories = d.categories.map((c) =>
						c.name === tx.categoryName ? { ...c, actualVnd: Math.max(0, c.actualVnd - delta) } : c
					);
				}
				return {
					...d,
					categories,
					transactions: (d.transactions || []).filter((x) => x.id !== txId)
				};
			});
			return { ...t, days };
		});
	}

	function updateDayNotes(dayNumber: number, notes: string) {
		mutateActiveTrip((t) => {
			const days = t.days.map((d) => (d.dayNumber === dayNumber ? { ...d, notes } : d));
			return { ...t, days };
		});
	}

	function computeSummary(trip: Trip): SummarySnapshot {
		const totalPlannedVnd = trip.days.reduce(
			(sum, d) => sum + d.categories.reduce((s, c) => s + c.budgetVnd, 0),
			0
		);
		const totalActualVnd = trip.days.reduce(
			(sum, d) => sum + d.categories.reduce((s, c) => s + c.actualVnd, 0),
			0
		);
		const totalCashBase = getTotalFundsInBase(trip);
		const percentOfBudgetUsed = totalCashBase > 0 ? (totalActualVnd / totalCashBase) * 100 : 0;
		const emergencyBufferVnd = Math.max(0, totalCashBase - totalPlannedVnd);
		const approxSecondary =
			!trip.currencies && trip.exchangeRateVndPerUsd
				? totalCashBase / trip.exchangeRateVndPerUsd
				: undefined;
		return {
			totalCashAvailableBase: totalCashBase,
			totalCashAvailableSecondaryApprox: approxSecondary,
			totalRequiredVnd: totalPlannedVnd,
			emergencyBufferVnd,
			percentOfBudgetUsed,
			totalActualVnd
		};
	}

	function getSummarySnapshot(): SummarySnapshot | undefined {
		if (!activeTrip) return undefined;
		return computeSummary(activeTrip);
	}

	function exportBundle(): string {
		const bundle = {
			type: "budget-tracker-trips",
			version: 1,
			exportedAt: new Date().toISOString(),
			trips: state.trips
		};
		return JSON.stringify(bundle, null, 2);
	}

	function importBundle(json: string) {
		try {
			const parsed = JSON.parse(json) as { type: string; trips: Trip[] };
			if (parsed.type !== "budget-tracker-trips" || !Array.isArray(parsed.trips)) return;
			const withIds = parsed.trips.map((t) => ({
				...t,
				id: t.id || generateId("trip"),
				version: t.version || 1,
				createdAt: t.createdAt || new Date().toISOString(),
				updatedAt: new Date().toISOString()
			}));
			setState((s) => ({ ...s, trips: withIds, activeTripId: withIds[0]?.id }));
		} catch {
			// ignore
		}
	}

	const value = useMemo<TripContextValue>(
		() => ({
			state,
			activeTrip,
			setActiveTripId,
			createTrip,
			updateTrip,
			removeTrip,
			updateExchangeRate,
			updateBudgetsForDay,
			addCategoryToDay,
			removeCategoryFromDay,
			addTransaction,
			removeTransaction,
			updateDayNotes,
			getSummarySnapshot,
			exportBundle,
			importBundle
		}),
		[state, activeTrip]
	);

	return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip() {
	const ctx = useContext(TripContext);
	if (!ctx) throw new Error("useTrip must be used within TripProvider");
	return ctx;
}


