import { DATA_BASE_URL } from "@/constants.js";
import { defineStore } from "pinia";
import { getDateRanges, checkDateOverlap } from "@/utils.js";

export const useEventsStore = defineStore("events", {
	state: () => ({
		items: [],
		sources: [],
		generationTime: null,
		/** @type {'idle' | 'loading' | 'success', 'error'} */
		fetchEventsStatus: "idle",
		/** @type {string || null} */
		lastFetchEventsTime: null,
	}),
	getters: {
		getItemsInDateRange: (state) => {
			return (dateRangeKey) => {
				const dateRanges = getDateRanges();
				const targetDateRange = dateRanges[dateRangeKey];

				return state.items.filter(({ daterange }) =>
					checkDateOverlap(daterange, targetDateRange)
				);
			};
		},
	},
	actions: {
		async fetchEvents() {
			try {
				this.fetchEventsStatus = "loading";
				const DATA_URL = `${DATA_BASE_URL}/latest`;

				// get events
				const eventsUrl = `${DATA_URL}/events.json`;
				const eventsResponse = await fetch(eventsUrl);
				if (!eventsResponse.ok) {
					throw new Error(`HTTP error! Status: ${eventsResponse.status}`);
				}
				const eventsData = await eventsResponse.json();

				this.items = eventsData.map((item) => {
					item.thumbnail = item.thumbnail
						? `${DATA_URL}/${item.thumbnail}`
						: null;
					return item;
				});

				// get sources
				const sourcesUrl = `${DATA_URL}/sources.json`;
				const sourcesResponse = await fetch(sourcesUrl);
				if (!sourcesResponse.ok) {
					throw new Error(`HTTP error! Status: ${sourcesResponse.status}`);
				}
				const sourcesData = await sourcesResponse.json();
				this.sources = sourcesData;

				// get generationTime
				const generationTimeUrl = `${DATA_URL}/generationTime.json`;
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
	},
});
