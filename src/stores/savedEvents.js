import { defineStore } from "pinia";

export const SAVED_EVENTS_STORAGE_KEY = "nowinsg:savedEvents:v1";

// Save only event content: source indices and thumbnail paths belong to a particular
// feed generation and cannot safely be reused after an event leaves that feed.
const text = (value) => typeof value === "string" ? value : null;
const eventId = (value) => typeof value === "string" ? value.trim() : "";
const snapshot = (event) => ({
	id: eventId(event.id),
	title: text(event.title) || "Untitled event",
	description: text(event.description),
	datetime: text(event.datetime),
	opening_hours: text(event.opening_hours),
	link: text(event.link),
	category: (Array.isArray(event.category) ? event.category : []).filter((value) => typeof value === "string"),
	daterange: Array.isArray(event.daterange) ? event.daterange.slice(0, 2).map(text) : null,
	locations: (Array.isArray(event.locations) ? event.locations : [])
		.filter((location) => location && typeof location === "object")
		.map((location) => ({
			name: text(location.name),
			venue_name: text(location.venue_name),
			venue_id: text(location.venue_id),
			approximate_region: text(location.approximate_region),
			approximate_nearest_mrt: text(location.approximate_nearest_mrt),
			approximate_gps: location.approximate_gps && typeof location.approximate_gps === "object" ? {
				lat: typeof location.approximate_gps.lat === "number" ? location.approximate_gps.lat : null,
				lng: typeof location.approximate_gps.lng === "number" ? location.approximate_gps.lng : null,
			} : null,
			google_maps_url: text(location.google_maps_url),
		})),
});

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
		if (!id || !entry.event || typeof entry.event.title !== "string" || seen.has(id)) {
			continue;
		}
		seen.add(id);
		result.push({
			id,
			event: snapshot({ ...entry.event, id }),
			savedAt:
				typeof entry.savedAt === "string" && entry.savedAt
					? entry.savedAt
					: new Date().toISOString(),
		});
	}
	return result;
};

const readFromStorage = () => {
	try {
		const raw = window.localStorage.getItem(SAVED_EVENTS_STORAGE_KEY);
		if (!raw) {
			return [];
		}
		return sanitizeEntries(JSON.parse(raw));
	} catch (error) {
		console.warn("Unable to read saved events from storage:", error);
		return null;
	}
};

const writeToStorage = (entries) => {
	try {
		window.localStorage.setItem(
			SAVED_EVENTS_STORAGE_KEY,
			JSON.stringify(entries)
		);
		return true;
	} catch (error) {
		console.warn("Unable to persist saved events to storage:", error);
		return false;
	}
};

// Nonreactive metadata and unsaved edits belong to each store, not each module/tab.
const storageContexts = new WeakMap();
const contextFor = (store) => {
	if (!storageContexts.has(store)) {
		storageContexts.set(store, { latest: new Map(), pending: [] });
	}
	return storageContexts.get(store);
};
const normalizeEntries = (entries, context) => sanitizeEntries(entries).map((entry) => ({
	...entry,
	event: context.latest.has(entry.id) ? snapshot(context.latest.get(entry.id)) : entry.event,
}));

export const useSavedEventsStore = defineStore("savedEvents", {
	state: () => ({
		// Each entry holds an ID, a content snapshot, and its original save time.
		items: readFromStorage() || [],
	}),
	getters: {
		list: (state) => [...state.items].sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
		savedIds: (state) => new Set(state.items.map(({ id }) => id)),
		isSaved() {
			return (eventIdValue) => Boolean(eventId(eventIdValue)) && this.savedIds.has(eventId(eventIdValue));
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
				const id = eventId(edit.id);
				entries = entries.filter((entry) => entry.id !== id);
				if (edit.type === "save") entries.push({ ...edit.entry, id });
			}
			this.items = normalizeEntries(entries, context);
		},
		persist() {
			if (writeToStorage(this.items)) contextFor(this).pending = [];
		},
		save(event) {
			this.refreshFromStorage();
			const context = contextFor(this);
			const id = eventId(event?.id);
			if (!id || !event.title || this.isSaved(id)) return;
			const entry = { id, event: snapshot(event), savedAt: new Date().toISOString() };
			context.pending.push({ type: "save", id, entry });
			this.items = [...this.items, entry];
			this.persist();
		},
		remove(eventIdValue) {
			this.refreshFromStorage();
			const context = contextFor(this);
			const id = eventId(eventIdValue);
			if (!id || !this.isSaved(id)) return;
			context.pending.push({ type: "remove", id });
			this.items = this.items.filter((entry) => entry.id !== id);
			this.persist();
		},
		toggle(event) {
			this.refreshFromStorage();
			const id = eventId(event?.id);
			if (this.isSaved(id)) this.remove(id);
			else this.save(event);
		},
		handleStorageChange(event) {
			if (event.key !== null && event.key !== SAVED_EVENTS_STORAGE_KEY) return;
			if (event.storageArea && event.storageArea !== window.localStorage) return;
			// Read current storage: queued events can contain superseded snapshots.
			this.refreshFromStorage();
		},
		refreshSnapshots(events) {
			const context = contextFor(this);
			context.latest = new Map(events.filter((event) => eventId(event.id)).map((event) => [eventId(event.id), event]));
			const before = JSON.stringify(this.items);
			this.refreshFromStorage();
			if (before !== JSON.stringify(this.items)) this.persist();
		},
	},
});
