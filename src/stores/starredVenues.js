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
		return null;
	}
};

const writeToStorage = (entries) => {
	try {
		window.localStorage.setItem(
			STARRED_VENUES_STORAGE_KEY,
			JSON.stringify(entries)
		);
		return true;
	} catch (error) {
		console.warn("Unable to save starred venues to storage:", error);
		return false;
	}
};

// Nonreactive metadata and unsaved edits belong to each store, not each module/tab.
const storageContexts = new WeakMap();
const contextFor = (store) => {
	if (!storageContexts.has(store)) {
		storageContexts.set(store, { redirects: {}, getLatestName: null, pending: [] });
	}
	return storageContexts.get(store);
};
const canonicalId = (id, context) =>
	resolveVenueId(typeof id === "string" ? id.trim() : null, context.redirects);
const normalizeEntries = (entries, context) => {
	const remapped = sanitizeEntries(entries).map((entry) => {
		const id = canonicalId(entry.id, context);
		return { ...entry, id, name: context.getLatestName?.(id) || entry.name };
	});
	// When aliases merge, preserve the original time the venue was saved.
	remapped.sort((a, b) => a.starredAt.localeCompare(b.starredAt));
	return sanitizeEntries(remapped);
};

export const useStarredVenuesStore = defineStore("starredVenues", {
	state: () => ({
		/** @type {StarredVenue[]} */
		items: readFromStorage() || [],
	}),
	getters: {
		list: (state) => [...state.items].sort((a, b) => b.starredAt.localeCompare(a.starredAt)),
		starredIds: (state) => new Set(state.items.map(({ id }) => id)),
		isStarred() {
			return (venueId) => Boolean(venueId) && this.starredIds.has(venueId);
		},
		count: (state) => state.items.length,
	},
	actions: {
		refreshFromStorage() {
			const context = contextFor(this);
			let entries = normalizeEntries(readFromStorage() ?? this.items, context);
			// Failed writes remain usable locally and are replayed over the next
			// readable snapshot rather than silently discarded by reconciliation.
			for (const edit of context.pending) {
				const id = canonicalId(edit.id, context);
				entries = entries.filter((entry) => entry.id !== id);
				if (edit.type === "star") entries.push({ ...edit.entry, id });
			}
			this.items = normalizeEntries(entries, context);
		},
		persist() {
			if (writeToStorage(this.items)) contextFor(this).pending = [];
		},
		star(venueId, venueName) {
			this.refreshFromStorage();
			const context = contextFor(this);
			const id = canonicalId(venueId, context);
			if (!id || this.isStarred(id)) return;
			const entry = { id, name: context.getLatestName?.(id) || venueName || id, starredAt: new Date().toISOString() };
			context.pending.push({ type: "star", id, entry });
			this.items = [...this.items, entry];
			this.persist();
		},
		unstar(venueId) {
			this.refreshFromStorage();
			const context = contextFor(this);
			const id = canonicalId(venueId, context);
			if (!id || !this.isStarred(id)) return;
			context.pending.push({ type: "unstar", id });
			this.items = this.items.filter((entry) => entry.id !== id);
			this.persist();
		},
		toggle(venueId, venueName) {
			this.refreshFromStorage();
			const id = canonicalId(venueId, contextFor(this));
			if (this.isStarred(id)) this.unstar(id);
			else this.star(id, venueName);
		},
		handleStorageChange(event) {
			if (event.key !== null && event.key !== STARRED_VENUES_STORAGE_KEY) return;
			if (event.storageArea && event.storageArea !== window.localStorage) return;
			// Read current storage: queued events can contain superseded snapshots.
			this.refreshFromStorage();
		},
		applyRedirects(redirects = {}, getLatestName = null) {
			const context = contextFor(this);
			context.redirects = { ...context.redirects, ...redirects };
			context.getLatestName = getLatestName;
			// Reconcile before migrating, so a background refresh cannot resurrect
			// venues another tab removed or discard venues it just added.
			const before = readFromStorage();
			this.refreshFromStorage();
			if (JSON.stringify(before) !== JSON.stringify(this.items)) this.persist();
		},
	},
});
