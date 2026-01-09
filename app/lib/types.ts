export type CurrencyCode = string; // ISO currency code (e.g., "VND", "USD")

export type DayCategoryBudget = {
	name: string;
	budgetVnd: number; // planned budget in VND
	actualVnd: number; // actual spend in VND
	status?: "under" | "on" | "over";
};

export type DayTransaction = {
	id: string;
	categoryName: string;
	// Original amount/currency entered by user
	originalAmount: number;
	originalCurrency: CurrencyCode;
	// Amount converted into trip base currency at time of entry
	amountBase: number;
	note?: string;
	createdAt: string;
};

export type TripDay = {
	dayNumber: number;
	dateLabel: string;
	location: string;
	title?: string;
	categories: DayCategoryBudget[];
	transactions: DayTransaction[];
	notes?: string;
};

export type Trip = {
	id: string;
	name: string;
	startDate: string; // ISO
	endDate: string; // ISO
	// New flexible currency model
	currencies?: {
		base: CurrencyCode;
		// Map of currency -> rate to base (1 unit of key currency equals this many base units)
		rates: Record<CurrencyCode, number>;
		// Funds carried per currency
		funds: Array<{ code: CurrencyCode; amount: number }>;
	};
	// Legacy fields kept for backward compatibility with earlier seed/UI
	baseCurrency: CurrencyCode; // default base if currencies is absent
	secondaryCurrency: CurrencyCode; // default secondary if currencies is absent
	exchangeRateVndPerUsd: number; // default rate if currencies is absent
	totalVndAvailable: number; // default fund in VND
	totalUsdAvailable: number; // default fund in USD
	days: TripDay[];
	createdAt: string;
	updatedAt: string;
	version: number;
};

export type AppState = {
	trips: Trip[];
	activeTripId?: string;
};

export type SummarySnapshot = {
	totalCashAvailableBase: number;
	totalCashAvailableSecondaryApprox?: number;
	totalRequiredVnd: number;
	emergencyBufferVnd: number;
	percentOfBudgetUsed: number;
	totalActualVnd: number; // kept for display; represents base currency total
};

export type ImportExportBundle = {
	type: "budget-tracker-trips";
	version: number;
	exportedAt: string;
	trips: Trip[];
};



