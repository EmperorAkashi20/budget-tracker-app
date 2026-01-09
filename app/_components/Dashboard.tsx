/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useMemo, useState } from "react";
import { useTrip } from "@/app/_components/TripProvider";
import { Trip, TripDay } from "@/app/lib/types";

function formatBase(amount: number, trip: Trip): string {
  const code = trip.currencies?.base || trip.baseCurrency || "VND";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  }).format(amount);
}

function calcDayTotals(day: TripDay) {
  const planned = day.categories.reduce((s, c) => s + c.budgetVnd, 0);
  const actual = day.categories.reduce((s, c) => s + c.actualVnd, 0);
  return { planned, actual };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function ProgressBar({ valuePct }: { valuePct: number }) {
  const pct = clamp(valuePct, 0, 100);
  const tone =
    pct >= 100
      ? "bg-red-600"
      : pct >= 90
      ? "bg-orange-500"
      : pct >= 80
      ? "bg-amber-400"
      : "bg-emerald-500";
  return (
    <div className="h-2 w-full rounded-full bg-zinc-200">
      <div
        className={`h-2 rounded-full ${tone}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function totalFundsBase(trip: Trip): number {
  if (trip.currencies) {
    return (trip.currencies.funds || []).reduce((s, f) => {
      const rate =
        f.code === trip.currencies!.base
          ? 1
          : trip.currencies!.rates[f.code] || 0;
      return s + f.amount * rate;
    }, 0);
  }
  return (
    trip.totalVndAvailable + trip.totalUsdAvailable * trip.exchangeRateVndPerUsd
  );
}

function BannerAlert({ trip }: { trip: Trip }) {
  const totalCashBase = totalFundsBase(trip);
  const totalActualVnd = trip.days.reduce(
    (sum, d) => sum + d.categories.reduce((s, c) => s + c.actualVnd, 0),
    0
  );
  const pct = totalCashBase > 0 ? (totalActualVnd / totalCashBase) * 100 : 0;
  if (pct < 80) return null;
  const tone =
    pct >= 100
      ? "bg-red-600 text-white"
      : pct >= 90
      ? "bg-orange-500 text-white"
      : "bg-amber-400 text-black";
  return (
    <div className={`sticky top-0 z-20 w-full px-4 py-3 ${tone}`}>
      <div className="mx-auto max-w-5xl text-sm">
        <strong>80% Alert:</strong> {pct.toFixed(1)}% used (
        {formatBase(totalActualVnd, trip)} / {formatBase(totalCashBase, trip)})
      </div>
    </div>
  );
}

function MobileHeader({
  trip,
  onOpenSettings,
}: {
  trip: Trip;
  onOpenSettings: () => void;
}) {
  const { state, setActiveTripId } = useTrip();
  return (
    <div className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
        <select
          className="h-10 flex-1 rounded-xl border bg-white px-3 text-sm"
          value={trip.id}
          onChange={(e) => setActiveTripId(e.target.value)}
        >
          {state.trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          className="h-10 rounded-xl border bg-white px-3 text-sm"
          onClick={onOpenSettings}
        >
          Settings
        </button>
      </div>
    </div>
  );
}

function SummaryCards({ trip }: { trip: Trip }) {
  const totalCashBase = totalFundsBase(trip);
  const totalPlannedVnd = trip.days.reduce(
    (sum, d) => sum + d.categories.reduce((s, c) => s + c.budgetVnd, 0),
    0
  );
  const totalActualVnd = trip.days.reduce(
    (sum, d) => sum + d.categories.reduce((s, c) => s + c.actualVnd, 0),
    0
  );
  const emergencyBufferVnd = Math.max(0, totalCashBase - totalPlannedVnd);
  const usedPct = percent(totalActualVnd, totalCashBase);
  const remainingVnd = Math.max(0, totalCashBase - totalActualVnd);
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-zinc-500">Total spent</div>
          <div className="mt-1 text-xl font-semibold">
            {formatBase(totalActualVnd, trip)}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            Budget: {formatBase(totalCashBase, trip)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500">Remaining</div>
          <div className="mt-1 text-lg font-semibold">
            {formatBase(remainingVnd, trip)}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {usedPct.toFixed(1)}% used
          </div>
        </div>
      </div>
      <div className="mt-3">
        <ProgressBar valuePct={usedPct} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-zinc-50 p-3">
          <div className="text-xs text-zinc-500">Planned total</div>
          <div className="mt-0.5 font-medium">
            {formatBase(totalPlannedVnd, trip)}
          </div>
        </div>
        <div className="rounded-xl bg-zinc-50 p-3">
          <div className="text-xs text-zinc-500">Emergency buffer</div>
          <div className="mt-0.5 font-medium">
            {formatBase(emergencyBufferVnd, trip)}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsSheet({
  open,
  onClose,
  trip,
}: {
  open: boolean;
  onClose: () => void;
  trip: Trip;
}) {
  const {
    updateTrip,
    removeTrip,
    exportBundle,
    importBundle,
    state,
    createTrip,
  } = useTrip();
  const [importText, setImportText] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center">
      <button
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Close settings"
        type="button"
      />
      <div className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl border bg-white p-4 shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white pb-2">
          <div className="text-sm font-semibold">Settings</div>
          <button
            className="h-8 w-8 rounded-full border text-sm"
            onClick={onClose}
            type="button"
          >
            X
          </button>
        </div>
        <div className="mt-2 space-y-4 pb-4">
          <div className="rounded-2xl border p-3">
            <div className="text-xs font-medium text-zinc-500">Trip basics</div>
            <div className="mt-2 grid grid-cols-1 gap-2">
              <input
                className="h-11 rounded-xl border px-3 text-sm"
                value={trip.name}
                onChange={(e) => updateTrip({ ...trip, name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  className="h-11 rounded-xl border px-3 text-sm"
                  value={trip.startDate}
                  onChange={(e) =>
                    updateTrip({ ...trip, startDate: e.target.value })
                  }
                />
                <input
                  type="date"
                  className="h-11 rounded-xl border px-3 text-sm"
                  value={trip.endDate}
                  onChange={(e) =>
                    updateTrip({ ...trip, endDate: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border p-3">
            <div className="text-xs font-medium text-zinc-500">Trip days</div>
            <div className="mt-2 text-xs text-zinc-500">
              Current days: {trip.days.length}. You can append or remove days at
              the end of the trip.
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="h-10 rounded-xl border px-3 text-sm"
                type="button"
                onClick={() => {
                  const lastDay = trip.days[trip.days.length - 1];
                  const newDayNumber = lastDay ? lastDay.dayNumber + 1 : 1;
                  const newDay: TripDay = {
                    dayNumber: newDayNumber,
                    dateLabel: `Day ${newDayNumber} (extra)`,
                    location: lastDay?.location || "Custom",
                    title: "Extra day",
                    categories: lastDay
                      ? lastDay.categories.map((c) => ({ ...c, actualVnd: 0 }))
                      : [
                          { name: "Food", budgetVnd: 0, actualVnd: 0 },
                          { name: "Transport", budgetVnd: 0, actualVnd: 0 },
                        ],
                    transactions: [],
                    notes: "",
                  };
                  const updatedTrip: Trip = {
                    ...trip,
                    days: [...trip.days, newDay],
                  };
                  updateTrip(updatedTrip);
                }}
              >
                Add extra day
              </button>
              <button
                className="h-10 rounded-xl border px-3 text-sm text-red-600 disabled:opacity-50"
                type="button"
                disabled={trip.days.length <= 1}
                onClick={() => {
                  if (trip.days.length <= 1) return;
                  const lastDay = trip.days[trip.days.length - 1];
                  const hasData =
                    lastDay.transactions?.length ||
                    lastDay.categories.some((c) => c.actualVnd > 0);
                  const ok =
                    !hasData ||
                    window.confirm(
                      `Remove Day ${lastDay.dayNumber}? This will delete its budgets, notes, and transactions.`
                    );
                  if (!ok) return;
                  const updatedTrip: Trip = {
                    ...trip,
                    days: trip.days.slice(0, -1),
                  };
                  updateTrip(updatedTrip);
                }}
              >
                Remove last day
              </button>
            </div>
          </div>

          <div className="rounded-2xl border p-3">
            <div className="text-xs font-medium text-zinc-500">
              Cash & exchange rate
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-zinc-500">VND</label>
                <input
                  type="number"
                  className="mt-1 h-11 w-full rounded-xl border px-3 text-sm"
                  value={trip.totalVndAvailable}
                  onChange={(e) =>
                    updateTrip({
                      ...trip,
                      totalVndAvailable: Number(e.target.value || 0),
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500">USD</label>
                <input
                  type="number"
                  className="mt-1 h-11 w-full rounded-xl border px-3 text-sm"
                  value={trip.totalUsdAvailable}
                  onChange={(e) =>
                    updateTrip({
                      ...trip,
                      totalUsdAvailable: Number(e.target.value || 0),
                    })
                  }
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-zinc-500">1 USD = VND</label>
                <input
                  type="number"
                  className="mt-1 h-11 w-full rounded-xl border px-3 text-sm"
                  value={trip.exchangeRateVndPerUsd}
                  onChange={(e) =>
                    updateTrip({
                      ...trip,
                      exchangeRateVndPerUsd: Number(e.target.value || 0),
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border p-3">
            <div className="text-xs font-medium text-zinc-500">
              Backup / reuse
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="h-11 rounded-xl border px-4 text-sm"
                onClick={() => {
                  const blob = new Blob([exportBundle()], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "trips-export.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Export JSON
              </button>
              <button
                className="h-11 rounded-xl border px-4 text-sm"
                onClick={() => {
                  const now = new Date().toISOString().slice(0, 10);
                  const resetDays = trip.days.map((d) => ({
                    ...d,
                    transactions: [],
                    categories: d.categories.map((c) => ({
                      ...c,
                      actualVnd: 0,
                    })),
                  }));
                  createTrip({
                    name: `${trip.name} (Copy)`,
                    startDate: now,
                    endDate: now,
                    baseCurrency: trip.baseCurrency,
                    secondaryCurrency: trip.secondaryCurrency,
                    exchangeRateVndPerUsd: trip.exchangeRateVndPerUsd,
                    totalVndAvailable: trip.totalVndAvailable,
                    totalUsdAvailable: trip.totalUsdAvailable,
                    days: resetDays,
                  });
                  onClose();
                }}
              >
                Duplicate trip
              </button>
              <button
                className="h-11 rounded-xl border px-4 text-sm text-red-600 disabled:opacity-50"
                disabled={state.trips.length <= 1}
                onClick={() => {
                  if (state.trips.length <= 1) return;
                  if (confirm("Delete this trip? This cannot be undone.")) {
                    removeTrip(trip.id);
                    onClose();
                  }
                }}
              >
                Delete trip
              </button>
            </div>
            <div className="mt-3">
              <textarea
                className="min-h-28 w-full rounded-xl border p-2 text-sm"
                placeholder="Paste import JSON here (from Export JSON)"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <div className="mt-2 flex gap-2">
                <button
                  className="h-10 rounded-xl border px-3 text-sm"
                  onClick={() => importBundle(importText)}
                >
                  Import
                </button>
                <button
                  className="h-10 rounded-xl border px-3 text-sm"
                  onClick={() => setImportText("")}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          <div className="text-xs text-zinc-500">
            Tip: keep using the Add expense card. It is optimized for quick
            one-handed entry.
          </div>
        </div>
      </div>
    </div>
  );
}

function getSuggestedDayNumber(trip: Trip): number {
  const todayIso = new Date().toISOString().slice(0, 10);
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const today = new Date(todayIso);
  if (today >= start && today <= end) {
    const diffDays = Math.floor(
      (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    return clamp(diffDays + 1, 1, trip.days.length);
  }
  return 1;
}

function QuickAddExpense({
  trip,
  preferredDayNumber,
}: {
  trip: Trip;
  preferredDayNumber?: number;
}) {
  const { addTransaction } = useTrip();
  const suggested = useMemo(() => getSuggestedDayNumber(trip), [trip]);
  const [dayNumber, setDayNumber] = useState<number>(
    preferredDayNumber ?? suggested
  );
  const day = trip.days.find((d) => d.dayNumber === dayNumber) || trip.days[0];
  const [categoryName, setCategoryName] = useState<string>(
    day?.categories?.[0]?.name || ""
  );
  const [amount, setAmount] = useState<string>("");
  const currencyOptions = useMemo<string[]>(
    () =>
      (trip.currencies?.funds?.map((f) => f.code) || ["VND", "USD"]).filter(
        (v, i, a) => a.indexOf(v) === i
      ),
    [trip.currencies]
  );
  const [currency, setCurrency] = useState<string>(
    trip.currencies?.base || trip.baseCurrency || "VND"
  );
  const [note, setNote] = useState<string>("");

  React.useEffect(() => {
    const d = trip.days.find((x) => x.dayNumber === dayNumber);
    if (!d) return;
    if (!d.categories.some((c) => c.name === categoryName)) {
      setCategoryName(d.categories[0]?.name || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayNumber, trip.days]);

  return (
    <div id="quick-add" className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold">Add expense</div>
      <form
        className="mt-3 grid grid-cols-1 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const amt = Number(amount || 0);
          if (!day) return;
          if (!categoryName) return;
          if (amt <= 0) return;
          addTransaction(day.dayNumber, {
            categoryName,
            originalAmount: amt,
            originalCurrency: currency,
            amountBase: amt,
            note: note.trim(),
          });
          setAmount("");
          setNote("");
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <select
            className="h-11 rounded-xl border bg-white px-3 text-sm"
            value={dayNumber}
            onChange={(e) => setDayNumber(Number(e.target.value))}
          >
            {trip.days.map((d) => (
              <option key={d.dayNumber} value={d.dayNumber}>
                Day {d.dayNumber} • {d.dateLabel} • {d.location}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-xl border bg-white px-3 text-sm"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          >
            {day.categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="number"
            inputMode="numeric"
            className="h-11 rounded-xl border px-3 text-sm"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            className="h-11 rounded-xl border bg-white px-3 text-sm"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {currencyOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="h-11 rounded-xl border px-3 text-sm"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <button
          className="h-11 rounded-xl bg-black px-4 text-sm font-medium text-white"
          type="submit"
        >
          Add
        </button>
      </form>
    </div>
  );
}

function DayAccordion({
  day,
  editBudgets,
  onQuickAddDay,
}: {
  day: TripDay;
  editBudgets: boolean;
  onQuickAddDay: (dayNumber: number) => void;
}) {
  const {
    updateBudgetsForDay,
    removeTransaction,
    updateDayNotes,
    addCategoryToDay,
    removeCategoryFromDay,
    activeTrip,
  } = useTrip();
  const totals = useMemo(() => calcDayTotals(day), [day]);
  const pct = percent(totals.actual, totals.planned);
  const tone =
    pct >= 100
      ? "border-red-400"
      : pct >= 90
      ? "border-orange-300"
      : pct >= 80
      ? "border-amber-300"
      : "border-zinc-200";
  return (
    <details className={`rounded-2xl border bg-white shadow-sm ${tone}`}>
      <summary className="cursor-pointer list-none px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">
              Day {day.dayNumber} • {day.dateLabel}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">
              {day.location} {day.title ? `— ${day.title}` : ""}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500">Actual / Planned</div>
            <div className="text-sm font-medium">
              {formatBase(totals.actual, activeTrip!)} /{" "}
              {formatBase(totals.planned, activeTrip!)}
            </div>
          </div>
        </div>
        <div className="mt-2">
          <ProgressBar valuePct={pct} />
        </div>
      </summary>
      <div className="border-t px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold">Categories</div>
          <button
            className="h-10 rounded-xl border bg-white px-3 text-sm"
            onClick={() => {
              onQuickAddDay(day.dayNumber);
              document
                .getElementById("quick-add")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            Add expense to this day
          </button>
        </div>
        <form
          className="mt-3 grid grid-cols-1 gap-2 rounded-xl border bg-white p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget as HTMLFormElement & {
              category: HTMLInputElement;
              budget: HTMLInputElement;
            };
            const name = form.category.value.trim();
            const budget = Number(form.budget.value || 0);
            if (!name) return;
            addCategoryToDay(day.dayNumber, name, budget);
            form.category.value = "";
            form.budget.value = "";
          }}
        >
          <div className="text-xs font-medium text-zinc-500">
            Add a category (for small activities, souvenirs, etc.)
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              name="category"
              type="text"
              className="h-11 rounded-xl border px-3 text-sm"
              placeholder="Category name"
            />
            <input
              name="budget"
              type="number"
              inputMode="numeric"
              className="h-11 rounded-xl border px-3 text-sm"
              placeholder="Budget (optional)"
            />
          </div>
          <button
            className="h-11 rounded-xl border bg-zinc-50 px-4 text-sm"
            type="submit"
          >
            Add category
          </button>
          <div className="text-xs text-zinc-500">
            You can remove a category only if it has{" "}
            <strong>no transactions</strong> and <strong>0 actual</strong>.
          </div>
        </form>
        <div className="mt-3 space-y-2">
          {day.categories.map((c, idx) => (
            <div
              key={c.name}
              className="flex items-start gap-3 rounded-xl bg-zinc-50 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.name}</div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  Actual: {formatBase(c.actualVnd, activeTrip!)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                <div className="text-right">
                  <div className="text-xs text-zinc-500">Budget</div>
                  {editBudgets ? (
                    <input
                      type="number"
                      className="mt-1 h-10 w-32 rounded-xl border bg-white px-3 text-sm"
                      value={c.budgetVnd}
                      onChange={(e) =>
                        updateBudgetsForDay(day.dayNumber, (d) => {
                          const next = [...d.categories];
                          next[idx] = {
                            ...next[idx],
                            budgetVnd: Number(e.target.value || 0),
                          };
                          return { ...d, categories: next };
                        })
                      }
                    />
                  ) : (
                    <div className="mt-1 text-sm font-medium">
                      {formatBase(c.budgetVnd, activeTrip!)}
                    </div>
                  )}
                </div>
                <button
                  className="h-10 rounded-xl border bg-white px-3 text-sm text-red-600 disabled:opacity-40"
                  disabled={
                    c.actualVnd > 0 ||
                    (day.transactions || []).some(
                      (tx) => tx.categoryName === c.name
                    )
                  }
                  onClick={() => {
                    if (confirm(`Remove category "${c.name}"?`)) {
                      removeCategoryFromDay(day.dayNumber, c.name);
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <div className="text-sm font-semibold">Transactions</div>
          {day.transactions?.length ? (
            <ul className="mt-2 space-y-2">
              {day.transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-start justify-between gap-2 rounded-xl border p-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      {tx.categoryName} •{" "}
                      {formatBase(
                        (tx as any).amountBase ?? (tx as any).amountVnd ?? 0,
                        activeTrip!
                      )}{" "}
                      ({tx.originalCurrency || "BASE"}{" "}
                      {tx.originalAmount ?? (tx as any).amountVnd ?? 0})
                    </div>
                    {tx.note ? (
                      <div className="mt-0.5 truncate text-xs text-zinc-500">
                        {tx.note}
                      </div>
                    ) : null}
                  </div>
                  <button
                    className="h-10 rounded-xl border px-3 text-sm text-red-600"
                    onClick={() => removeTransaction(day.dayNumber, tx.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-2 text-sm text-zinc-500">
              No transactions yet.
            </div>
          )}
        </div>

        <div className="mt-5">
          <div className="text-sm font-semibold">Notes</div>
          <textarea
            className="mt-2 w-full rounded-xl border p-3 text-sm"
            placeholder="Notes..."
            value={day.notes || ""}
            onChange={(e) => updateDayNotes(day.dayNumber, e.target.value)}
          />
        </div>
      </div>
    </details>
  );
}

export function Dashboard() {
  const { activeTrip } = useTrip();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editBudgets, setEditBudgets] = useState(false);
  const [quickAddDayOverride, setQuickAddDayOverride] = useState<
    number | undefined
  >(undefined);

  if (!activeTrip) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="text-center text-sm text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-zinc-50">
      <BannerAlert trip={activeTrip} />
      <MobileHeader
        trip={activeTrip}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        trip={activeTrip}
      />

      <div className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        <SummaryCards trip={activeTrip} />

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Plan</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                Tap a day to see details.
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editBudgets}
                onChange={(e) => setEditBudgets(e.target.checked)}
              />
              Edit budgets
            </label>
          </div>
        </div>

        <QuickAddExpense
          trip={{
            ...activeTrip,
            days: activeTrip.days,
          }}
          preferredDayNumber={quickAddDayOverride}
          key={`${activeTrip.id}-${quickAddDayOverride ?? "auto"}`}
        />

        <div className="space-y-3 pb-10">
          {activeTrip.days.map((day) => (
            <DayAccordion
              key={day.dayNumber}
              day={day}
              editBudgets={editBudgets}
              onQuickAddDay={(d) => setQuickAddDayOverride(d)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
