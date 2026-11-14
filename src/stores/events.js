import { DATA_BASE_URL } from "@/constants.js";
import { defineStore } from "pinia";
import {
	getDateRanges,
	checkDateOverlap,
	getCheckpointTimestamp,
	resolveVenueId,
} from "@/utils.js";
import { useStarredVenuesStore } from "@/stores/starredVenues.js";

const VENUES_FETCH_TIMEOUT_MS = 15000;
const venueRequests = new WeakMap();

const filterLoadingTimers = new WeakMap();

export const useEventsStore = defineStore("events", {
	state: () => ({
		items: [],
		categories: [],
		regions: [],
		sources: [],
		generationTime: null,
		venues: [],
		/** @type {Object<string, string>} merged/retired venue ID -> surviving venue ID */
		venueRedirects: {},
		/** @type {'idle' | 'fetching' | 'success', 'error'} */
		fetchEventsStatus: "idle",
		isFilterLoading: false,
		/** @type {string || null} */
		lastFetchEventsTime: null,
	}),
	getters: {
		displayEventsStatus: (state) =>
			state.fetchEventsStatus === "success" && state.isFilterLoading
				? "fetching"
				: state.fetchEventsStatus,
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
		venuesById: (state) => {
			const map = new Map();
			for (const venue of state.venues) {
				if (venue?.id) {
					map.set(venue.id, venue);
				}
			}
			return map;
		},
		resolveVenueId: (state) => {
			return (venueId) => resolveVenueId(venueId, state.venueRedirects);
		},
		/** Number of loaded events listing each venue ID (counted once per event). */
		eventCountsByVenueId: (state) => {
			const counts = new Map();
			for (const item of state.items) {
				const venueIds = new Set(
					(item.locations || [])
						.map((location) => location?.venue_id)
						.filter(Boolean)
				);
				for (const venueId of venueIds) {
					counts.set(venueId, (counts.get(venueId) || 0) + 1);
				}
			}
			return counts;
		},
		/** Best known display name for a venue: venues.json, then any event location. */
		getVenueName() {
			return (venueId) => {
				if (!venueId) {
					return null;
				}
				const venue = this.venuesById.get(venueId);
				if (venue?.name) {
					return venue.name;
				}
				for (const item of this.items) {
					for (const location of item.locations || []) {
						if (location?.venue_id === venueId) {
							return location.venue_name || location.name || null;
						}
					}
				}
				return null;
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

				// get venues in parallel (optional: never blocks or fails the main load)
				void this.fetchVenues(DATA_URL, timestamp).catch((error) => {
					console.warn("Optional venue refresh failed:", error);
				});

				// get events
				const eventsUrl = `${DATA_URL}/events.json?${timestamp}`;
				const eventsResponse = await fetch(eventsUrl);
				if (!eventsResponse.ok) {
					throw new Error(`HTTP error! Status: ${eventsResponse.status}`);
				}
				const eventsData = await eventsResponse.json();

				const allCategories = new Set();
				const allRegions = new Set();
				this.items = eventsData.map((item) => {
					for (let categoryName of item.category) {
						allCategories.add(categoryName);
					}

					const normalizedLocations = Array.isArray(item.locations)
						? item.locations.filter(Boolean)
						: [];
					item.locations = normalizedLocations;
					for (let location of normalizedLocations) {
						const regionName = location?.approximate_region;
						if (regionName) {
							allRegions.add(regionName);
						}
						// normalise venue IDs so merged/retired venues map to their surviving ID
						location.venue_id = this.resolveVenueId(location.venue_id);
						location.venue_name = location.venue_name || null;
					}
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
				this.regions = Array.from(allRegions);

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
		async fetchVenues(DATA_URL, timestamp) {
			venueRequests.get(this)?.abort();
			const controller = new AbortController();
			venueRequests.set(this, controller);
			let timeout;
			try {
				const venuesUrl = `${DATA_URL}/venues.json?${timestamp}`;
				// Bound the background response and its body, and cancel stalled work.
				const request = async () => {
					const response = await fetch(venuesUrl, { signal: controller.signal });
					if (!response.ok) {
						throw new Error(`HTTP error! Status: ${response.status}`);
					}
					return response.json();
				};
				const deadline = new Promise((_, reject) => {
					timeout = setTimeout(() => {
						reject(new Error("Venues request timed out"));
						controller.abort();
					}, VENUES_FETCH_TIMEOUT_MS);
				});
				const venuesData = await Promise.race([request(), deadline]);
				// A newer refresh owns the registry, even if this endpoint ignored abort.
				if (venueRequests.get(this) !== controller) return;
				this.venues = Array.isArray(venuesData?.venues)
					? venuesData.venues.filter((venue) => venue && venue.id)
					: [];
				this.venueRedirects =
					venuesData?.redirects && typeof venuesData.redirects === "object"
						? venuesData.redirects
						: {};
				// Events can already be visible when the background metadata arrives.
				for (const item of this.items) {
					for (const location of item.locations || []) {
						location.venue_id = this.resolveVenueId(location.venue_id);
					}
				}
				const starredVenues = useStarredVenuesStore();
				starredVenues.applyRedirects(
					this.venueRedirects,
					(venueId) => this.venuesById.get(venueId)?.name || null
				);
			} catch (error) {
				if (venueRequests.get(this) === controller) {
					console.warn("Venues data unavailable, using last known venues:", error);
				}
			} finally {
				clearTimeout(timeout);
				if (venueRequests.get(this) === controller) venueRequests.delete(this);
			}
		},
		triggerFakeLoading() {
			if (this.fetchEventsStatus !== "success") return;
			clearTimeout(filterLoadingTimers.get(this));
			this.isFilterLoading = true;
			filterLoadingTimers.set(this, setTimeout(() => {
				this.isFilterLoading = false;
				filterLoadingTimers.delete(this);
			}, 600));
		},
	},
});
