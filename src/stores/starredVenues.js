import { defineStore } from "pinia";
import { resolveVenueId } from "@/utils.js";

export const STARRED_VENUES_STORAGE_KEY = "nowinsg:starredVenues:v1";

/**
 * @typedef {Object} StarredVenue
 * @property {string} id - Stable venue ID, e.g. "v_esplanade".
 * @property {string} name - Snapshot of the venue name when it was starred.
 * @property {string} starredAt - ISO timestamp of when it was starred.
 */

const sanitizeEntries = (entries) => {
	if (!Array.isArray(entries)) {
		return [];
	}
	const seen = new Set();
	const result = [];
	for (const entry of entries) {
		if (!entry || typeof entry !== "object") {
			continue;
		}
		const id = typeof entry.id === "string" ? entry.id.trim() : "";
		if (!id || seen.has(id)) {
			continue;
		}
		seen.add(id);
		result.push({
			id,
			name: typeof entry.name === "string" && entry.name ? entry.name : id,
			starredAt:
				typeof entry.starredAt === "string" && entry.starredAt
					? entry.starredAt
					: new Date().toISOString(),
		});
	}
	return result;
};

const readFromStorage = () => {
	try {
		const raw = window.localStorage.getItem(STARRED_VENUES_STORAGE_KEY);
		if (!raw) {
			return [];
		}
		return sanitizeEntries(JSON.parse(raw));
	} catch (error) {
		console.warn("Unable to read starred venues from storage:", error);
		return [];
	}
};

const writeToStorage = (entries) => {
	try {
		window.localStorage.setItem(
			STARRED_VENUES_STORAGE_KEY,
			JSON.stringify(entries)
		);
	} catch (error) {
		console.warn("Unable to save starred venues to storage:", error);
	}
};

export const useStarredVenuesStore = defineStore("starredVenues", {
	state: () => ({
		/** @type {StarredVenue[]} */
		items: readFromStorage(),
	}),
	getters: {
		/** Starred venues, most recently starred first. */
		list: (state) => {
			return [...state.items].sort((a, b) =>
				(b.starredAt || "").localeCompare(a.starredAt || "")
			);
		},
		starredIds: (state) => new Set(state.items.map(({ id }) => id)),
		isStarred() {
			return (venueId) => Boolean(venueId) && this.starredIds.has(venueId);
		},
		count: (state) => state.items.length,
	},
	actions: {
		persist() {
			writeToStorage(this.items);
		},
		star(venueId, venueName) {
			if (!venueId || this.isStarred(venueId)) {
				return;
			}
			this.items = [
				...this.items,
				{
					id: venueId,
					name: venueName || venueId,
					starredAt: new Date().toISOString(),
				},
			];
			this.persist();
		},
		unstar(venueId) {
			if (!venueId) {
				return;
			}
			const next = this.items.filter(({ id }) => id !== venueId);
			if (next.length !== this.items.length) {
				this.items = next;
				this.persist();
			}
		},
		toggle(venueId, venueName) {
			if (this.isStarred(venueId)) {
				this.unstar(venueId);
			} else {
				this.star(venueId, venueName);
			}
		},
		/**
		 * Rewrites stored IDs that were merged/retired into their surviving IDs,
		 * dedupes, and persists if anything changed. Optionally refreshes the name
		 * snapshot from the latest known venue names.
		 *
		 * @param {Object<string, string>} redirects
		 * @param {(venueId: string) => string | null} [getLatestName]
		 */
		applyRedirects(redirects = {}, getLatestName = null) {
			let hasChanges = false;
			const remapped = this.items.map((entry) => {
				const resolvedId = resolveVenueId(entry.id, redirects) || entry.id;
				const latestName = getLatestName ? getLatestName(resolvedId) : null;
				const name = latestName || entry.name;
				if (resolvedId !== entry.id || name !== entry.name) {
					hasChanges = true;
				}
				return { ...entry, id: resolvedId, name };
			});
			// keep the earliest starredAt when two entries merge into one venue
			remapped.sort((a, b) =>
				(a.starredAt || "").localeCompare(b.starredAt || "")
			);
			const deduped = sanitizeEntries(remapped);
			if (deduped.length !== this.items.length) {
				hasChanges = true;
			}
			if (hasChanges) {
				this.items = deduped;
				this.persist();
			}
		},
	},
});
