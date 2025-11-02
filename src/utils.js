/**
 * Calculates date ranges for the current and next week, weekend, month, and next month,
 * based on the provided input date or the current date by default.
 *
 * @param {Date} inputDate - The date from which to calculate the date ranges. Defaults to the current date.
 * @returns {Object} An object containing formatted date ranges for the current and next week, current and next weekend, current and next month.
 */
export function getDateRanges(inputDate = new Date()) {
	// Helper function to format date
	const formatDate = (date) => {
		// const day = date.toLocaleString("default", { weekday: "long" });
		return `${date.getDate().toString().padStart(2, "0")} ${date.toLocaleString(
			"default",
			{ month: "short" }
		)} ${date.getFullYear()}`;
	};

	// Get start and end of this week (starting from Monday)
	const startOfThisWeek = new Date(inputDate);
	startOfThisWeek.setDate(
		inputDate.getDate() -
			(inputDate.getDay() === 0 ? 6 : inputDate.getDay() - 1)
	);
	const endOfThisWeek = new Date(startOfThisWeek);
	endOfThisWeek.setDate(startOfThisWeek.getDate() + 6);

	// Get this weekend dates (Saturday and Sunday)
	const thisWeekendStart = new Date(startOfThisWeek);
	thisWeekendStart.setDate(startOfThisWeek.getDate() + 5);
	const thisWeekendEnd = new Date(thisWeekendStart);
	thisWeekendEnd.setDate(thisWeekendStart.getDate() + 1);

	// Get start and end of next week
	const startOfNextWeek = new Date(endOfThisWeek);
	startOfNextWeek.setDate(endOfThisWeek.getDate() + 1);
	const endOfNextWeek = new Date(startOfNextWeek);
	endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);

	// Get next weekend dates
	const nextWeekendStart = new Date(startOfNextWeek);
	nextWeekendStart.setDate(startOfNextWeek.getDate() + 5);
	const nextWeekendEnd = new Date(nextWeekendStart);
	nextWeekendEnd.setDate(nextWeekendStart.getDate() + 1);

	// Get start and end of this month
	const startOfThisMonth = new Date(
		inputDate.getFullYear(),
		inputDate.getMonth(),
		1
	);
	const endOfThisMonth = new Date(
		inputDate.getFullYear(),
		inputDate.getMonth() + 1,
		0
	);

	// Get start and end of next month
	const startOfNextMonth = new Date(
		inputDate.getFullYear(),
		inputDate.getMonth() + 1,
		1
	);
	const endOfNextMonth = new Date(
		inputDate.getFullYear(),
		inputDate.getMonth() + 2,
		0
	);

	return {
		thisWeek: [formatDate(startOfThisWeek), formatDate(endOfThisWeek)],
		thisWeekend: [formatDate(thisWeekendStart), formatDate(thisWeekendEnd)],
		nextWeek: [formatDate(startOfNextWeek), formatDate(endOfNextWeek)],
		nextWeekend: [formatDate(nextWeekendStart), formatDate(nextWeekendEnd)],
		thisMonth: [formatDate(startOfThisMonth), formatDate(endOfThisMonth)],
		nextMonth: [formatDate(startOfNextMonth), formatDate(endOfNextMonth)],
	};
}

/**
 * Checks if there is an overlap between two date ranges.
 *
 * @param {Array<string>} withinRange - The date range within which to check for an overlap.
 * @param {Array<string>} findRange - The date range to check for an overlap within the withinRange.
 * @returns {boolean} True if there is an overlap between the date ranges, otherwise false.
 * If any date in the ranges is null, it returns false, excluding events with indeterminate ranges.
 */
export function checkDateOverlap(withinRange, findRange) {
	const normalizeRange = (range) => {
		if (Array.isArray(range)) {
			return range;
		}
		if (range && typeof range === "object") {
			const start =
				range.start ?? range.from ?? range.begin ?? range[0] ?? null;
			const end = range.end ?? range.to ?? range.finish ?? range[1] ?? null;
			return [start, end];
		}
		if (typeof range === "string" && range.trim().length > 0) {
			return [range, range];
		}
		if (range instanceof Date) {
			return [range, range];
		}
		return [null, null];
	};

	// Function to convert a date string to a Date object
	const parseDate = (dateStr) => {
		if (!dateStr) return null;
		if (dateStr instanceof Date) {
			return new Date(dateStr);
		}
		const parsed = new Date(dateStr);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	};

	// Convert the date strings in each range to Date objects
	const [withinStart, withinEnd] = normalizeRange(withinRange).map(parseDate);
	const [findStart, findEnd] = normalizeRange(findRange).map(parseDate);

	// If any date is null, exclude the range as it cannot be confidently matched
	if (!withinStart || !withinEnd || !findStart || !findEnd) {
		return false;
	}

	// Check if there is no overlap between the two ranges
	// No overlap if the end of one range is before the start of the other, or vice versa
	return !(withinEnd < findStart || withinStart > findEnd);
}

export function getCheckpointTimestamp() {
	const SGT_OFFSET = 8; // Singapore is GMT+8

	// convert to SGT and adjust to last Tuesday or Thursday
	let now = new Date();
	let dayOfWeek = now.getUTCDay();
	let hour = now.getUTCHours() + SGT_OFFSET; // Get hour in SGT

	let daysToAdjust;
	if (dayOfWeek > 2 || (dayOfWeek === 2 && hour >= 3)) {
		// After Tuesday 3 AM SGT
		daysToAdjust = dayOfWeek - 2;
	} else if (dayOfWeek < 2 || (dayOfWeek === 2 && hour < 3)) {
		// Before Tuesday 3 AM SGT
		daysToAdjust = 7 - (2 - dayOfWeek);
	}

	let lastDay = new Date(now);
	lastDay.setUTCDate(now.getUTCDate() - daysToAdjust);
	lastDay.setUTCHours(3 - SGT_OFFSET, 0, 0, 0); // Set to 3 AM SGT

	let timestamp = lastDay.getTime(); // Return Unix timestamp
	return `${timestamp}`;
}

export function calculateDistanceKm(pointA, pointB) {
	if (!pointA || !pointB) {
		return Number.POSITIVE_INFINITY;
	}

	const lat1 = Number(pointA.lat ?? pointA.latitude);
	const lon1 = Number(
		pointA.lng ?? pointA.lon ?? pointA.longitude ?? pointA.long
	);
	const lat2 = Number(pointB.lat ?? pointB.latitude);
	const lon2 = Number(
		pointB.lng ?? pointB.lon ?? pointB.longitude ?? pointB.long
	);

	if (
		Number.isNaN(lat1) ||
		Number.isNaN(lon1) ||
		Number.isNaN(lat2) ||
		Number.isNaN(lon2)
	) {
		return Number.POSITIVE_INFINITY;
	}

	const toRadians = (degrees) => (degrees * Math.PI) / 180;
	const R = 6371; // Earth's radius in km
	const dLat = toRadians(lat2 - lat1);
	const dLon = toRadians(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRadians(lat1)) *
			Math.cos(toRadians(lat2)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c;
}
