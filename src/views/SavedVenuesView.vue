<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import VueFeather from "vue-feather";
import { useEventsStore } from "@/stores/events.js";
import { useStarredVenuesStore } from "@/stores/starredVenues.js";
import StarVenueButton from "@/components/StarVenueButton.vue";

const events = useEventsStore();
const starredVenues = useStarredVenuesStore();

const isLoadingEvents = computed(() => {
	return (
		!events.items.length &&
		(events.fetchEventsStatus === "idle" ||
			events.fetchEventsStatus === "fetching")
	);
});

async function retryFetchEvents() {
	try {
		await events.fetchEvents();
	} catch {
		// The store exposes the failure below and keeps the retry available.
	}
}

// fallback details from this week's event locations, for venues missing in venues.json
const findEventLocationForVenue = (venueId) => {
	for (const item of events.items) {
		for (const location of item.locations || []) {
			if (location?.venue_id === venueId) {
				return location;
			}
		}
	}
	return null;
};

const savedVenues = computed(() => {
	return starredVenues.list.map(({ id, name }) => {
		const venue =
			events.venuesById.get(id) || findEventLocationForVenue(id) || {};
		const detailSegments = [];
		if (venue.approximate_region) {
			detailSegments.push(venue.approximate_region);
		}
		if (venue.approximate_nearest_mrt) {
			detailSegments.push(`Near ${venue.approximate_nearest_mrt}`);
		}
		return {
			id,
			name: events.venuesById.get(id)?.name || venue.venue_name || name,
			details: detailSegments.join(" • ") || null,
			mapUrl: venue.google_maps_url || null,
			eventCount: events.eventCountsByVenueId.get(id) || 0,
		};
	});
});
</script>

<template>
	<article
		class="mx-auto flex w-full max-w-6xl flex-col gap-6 rounded-[36px] border-4 border-black bg-white/80 px-4 py-6 font-sans text-base leading-relaxed text-[#1f1b2c] shadow-[8px_8px_0_#1f1b2c] backdrop-blur sm:px-10 sm:py-10 sm:text-lg sm:shadow-[16px_16px_0_#1f1b2c]">
		<div class="flex flex-col gap-3">
			<p class="text-sm uppercase tracking-[0.4em] text-[#f15a24]">Your list</p>
			<h1 class="text-3xl">Saved venues</h1>
			<p class="text-sm text-[#1f1b2c]/70 sm:text-base">
				Saved on this device only. Tap a venue to see what's on there.
			</p>
		</div>

		<div v-if="!savedVenues.length"
			class="rounded-2xl border-2 border-dashed border-[#1f1b2c]/40 bg-[#ffe066]/30 px-4 py-6 text-center sm:px-8 sm:py-8">
			<p class="font-serif text-lg sm:text-xl">No saved venues yet.</p>
			<p class="mt-3 text-sm text-[#1f1b2c]/80 sm:text-base">
				Tap the
				<vue-feather type="star" class="inline-block h-4 w-4 align-[-2px]" aria-hidden="true" />
				<span class="sr-only">star</span>
				next to a venue's name on any event to save it here.
			</p>
			<RouterLink to="/"
				class="mt-5 inline-block rounded-full border-2 border-black bg-[#ffe066] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#1f1b2c] shadow-[4px_4px_0_#1f1b2c] transition-transform hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#f15a24] sm:text-sm">
				Browse events
			</RouterLink>
		</div>

		<div v-if="events.fetchEventsStatus === 'error'" role="alert"
			class="rounded-2xl border-2 border-[#f15a24] bg-[#ffe066]/30 px-4 py-4 text-sm">
			<p>We couldn't check events right now. Try again to see what's on at your saved venues.</p>
			<button type="button" @click="retryFetchEvents"
				class="mt-3 rounded-full border-2 border-black bg-[#ffe066] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] shadow-[4px_4px_0_#1f1b2c] focus-visible:ring-4 focus-visible:ring-[#8ec5ff]/60">
				Retry
			</button>
		</div>

		<ul v-if="savedVenues.length" class="grid gap-4 sm:grid-cols-2">
			<li v-for="venue in savedVenues" :key="venue.id"
				class="flex items-start gap-3 rounded-2xl border-2 border-dashed border-[#1f1b2c]/40 bg-[#8ec5ff]/20 px-3 py-3 sm:px-4 sm:py-4">
				<RouterLink :to="{ path: '/', query: { venue: venue.id } }"
					class="group flex min-w-0 flex-1 flex-col gap-1 rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-[#8ec5ff]/60">
					<span
						class="break-words font-serif text-lg leading-snug text-[#1f1b2c] underline-offset-4 group-hover:text-[#f15a24] group-hover:underline sm:text-xl">
						{{ venue.name }}
					</span>
					<span v-if="venue.details" class="text-xs text-[#1f1b2c]/70">
						{{ venue.details }}
					</span>
					<span class="mt-1 text-xs uppercase tracking-[0.2em]"
						:class="venue.eventCount ? 'text-[#f15a24]' : 'text-[#1f1b2c]/60'">
						<template v-if="events.fetchEventsStatus === 'error'">Event counts unavailable</template>
						<template v-else-if="isLoadingEvents">Checking events…</template>
						<template v-else-if="venue.eventCount">
							{{ venue.eventCount }} event<span v-if="venue.eventCount > 1">s</span> listed
						</template>
						<template v-else>No events listed right now</template>
					</span>
				</RouterLink>
				<div class="flex shrink-0 items-center gap-4">
					<a v-if="venue.mapUrl" :href="venue.mapUrl" target="_blank" rel="noopener"
						class="relative flex shrink-0 items-center justify-center rounded-full border border-[#1f1b2c]/40 bg-white/70 p-1.5 text-[#1f1b2c] transition-colors after:absolute after:-inset-2 after:rounded-full after:content-[''] hover:bg-[#1f1b2c] hover:text-white">
						<vue-feather type="map-pin" class="h-4 w-4" aria-hidden="true" />
						<span class="sr-only">Open map for {{ venue.name }}</span>
					</a>
					<StarVenueButton :venue-id="venue.id" :venue-name="venue.name" />
				</div>
			</li>
		</ul>
	</article>
</template>
