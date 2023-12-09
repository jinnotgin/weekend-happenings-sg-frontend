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
 * If any date in the ranges is null, it returns true, assuming incomplete data to fully evaluate.
 */
export function checkDateOverlap(withinRange, findRange) {
	// Function to convert a date string to a Date object
	const parseDate = (dateStr) => {
		return dateStr ? new Date(dateStr) : null;
	};

	// Convert the date strings in each range to Date objects
	const [withinStart, withinEnd] = withinRange.map(parseDate);
	const [findStart, findEnd] = findRange.map(parseDate);

	// If any date is null, return true, as we cannot fully evaluate overlap
	if (!withinStart || !withinEnd || !findStart || !findEnd) {
		return true;
	}

	// Check if there is no overlap between the two ranges
	// No overlap if the end of one range is before the start of the other, or vice versa
	return !(withinEnd < findStart || withinStart > findEnd);
}
