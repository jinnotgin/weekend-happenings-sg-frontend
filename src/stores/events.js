import { DATA_BASE_URL } from "@/constants.js";
import { defineStore } from "pinia";
import {
	getDateRanges,
	checkDateOverlap,
	getCheckpointTimestamp,
} from "@/utils.js";

let timeout_fakeLoading;

export const useEventsStore = defineStore("events", {
	state: () => ({
		items: [],
		categories: [],
		sources: [],
		generationTime: null,
		/** @type {'idle' | 'fetching' | 'success', 'error'} */
		fetchEventsStatus: "idle",
		/** @type {string || null} */
		lastFetchEventsTime: null,
	}),
	getters: {
		getItemsInDateRangeAndCategory: (state) => {
			return (dateRangeKey, categoryKey) => {
				const dateRanges = getDateRanges();
				const targetDateRange = dateRanges[dateRangeKey];

				return state.items.filter(({ daterange, category }) => {
					const HAS_DATE_OVERLAP = checkDateOverlap(daterange, targetDateRange);
					const WITHIN_CATEGORY =
						categoryKey === "all" || category.includes(categoryKey);
					return HAS_DATE_OVERLAP && WITHIN_CATEGORY;
				});
			};
		},
		getSourcesData: (state) => {
			return (sourcesIndex) => {
				return sourcesIndex.map((index) => state.sources[index]);
			};
		},
	},
	actions: {
		async fetchEvents() {
			try {
				this.fetchEventsStatus = "fetching";
				const DATA_URL = `${DATA_BASE_URL}/latest`;

				// set checkpoint timestamp (the data is refreshed at certain timings)
				const timestamp = getCheckpointTimestamp();

				// get events
				const eventsUrl = `${DATA_URL}/events.json?${timestamp}`;
				const eventsResponse = await fetch(eventsUrl);
				if (!eventsResponse.ok) {
					throw new Error(`HTTP error! Status: ${eventsResponse.status}`);
				}
				const eventsData = await eventsResponse.json();

				const allCategories = new Set();
				this.items = eventsData.map((item) => {
					for (let categoryName of item.category) {
						allCategories.add(categoryName);
					}

					const normalizedLocations = Array.isArray(item.locations)
						? item.locations.filter(Boolean)
						: [];
					item.locations = normalizedLocations;
					if (!item.location) {
						const primaryLocation = normalizedLocations[0];
						item.location =
							primaryLocation?.name ||
							primaryLocation?.approximate_region ||
							primaryLocation?.approximate_nearest_mrt ||
							null;
					}

					item.thumbnail = item.thumbnail
						? `${DATA_URL}/${item.thumbnail}`
						: null;
					return item;
				});
				this.categories = Array.from(allCategories);

				// get sources
				const sourcesUrl = `${DATA_URL}/sources.json?${timestamp}`;
				const sourcesResponse = await fetch(sourcesUrl);
				if (!sourcesResponse.ok) {
					throw new Error(`HTTP error! Status: ${sourcesResponse.status}`);
				}
				const sourcesData = await sourcesResponse.json();
				this.sources = sourcesData;

				// get generationTime
				const generationTimeUrl = `${DATA_URL}/generationTime.json?${timestamp}`;
				const generationTimeResponse = await fetch(generationTimeUrl);
				if (!generationTimeResponse.ok) {
					throw new Error(
						`HTTP error! Status: ${generationTimeResponse.status}`
					);
				}
				const generationTimeData = await generationTimeResponse.json();
				this.generationTime = generationTimeData;

				this.fetchEventsStatus = "success";
				this.lastFetchEventsTime = new Date().toISOString();

				return true;
			} catch (error) {
				console.error("Error fetching data:", error);
				this.fetchEventsStatus = "error";
				throw error; // re-throw the error for caller to handle
			}
		},
		triggerFakeLoading() {
			clearTimeout(timeout_fakeLoading);
			this.fetchEventsStatus = "fetching";
			timeout_fakeLoading = setTimeout(() => {
				this.fetchEventsStatus = "success";
			}, 600);
		},
	},
});
