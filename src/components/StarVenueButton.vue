<script setup>
import { computed } from "vue";
import VueFeather from "vue-feather";
import { useStarredVenuesStore } from "@/stores/starredVenues.js";

const props = defineProps({
	venueId: {
		type: String,
		required: true,
	},
	venueName: {
		type: String,
		default: "",
	},
});

const starredVenues = useStarredVenuesStore();

const isStarred = computed(() => starredVenues.isStarred(props.venueId));
const displayName = computed(() => props.venueName || "this venue");
const label = computed(
	() => `${isStarred.value ? "Unstar" : "Star"} ${displayName.value}`
);

const handleClick = (event) => {
	// never let the star trigger a parent card's click/navigation
	event.stopPropagation();
	event.preventDefault();
	starredVenues.toggle(props.venueId, props.venueName);
};
</script>

<template>
	<!-- Invisible ::after halo extends the ~30px button to a ~46px touch target -->
	<button type="button"
		class="relative flex shrink-0 items-center justify-center rounded-full border p-1.5 transition-colors after:absolute after:-inset-2 after:rounded-full after:content-[''] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#8ec5ff]/60"
		:class="isStarred
			? 'border-[#1f1b2c] bg-[#ffe066] text-[#f15a24] hover:bg-[#ffe066]/70'
			: 'border-[#1f1b2c]/40 bg-white/70 text-[#1f1b2c] hover:bg-[#ffe066]/60'
			" :aria-pressed="isStarred ? 'true' : 'false'" :aria-label="label" :title="label" @click="handleClick">
		<vue-feather type="star" class="h-4 w-4" :fill="isStarred ? 'currentColor' : 'none'" aria-hidden="true" />
	</button>
</template>
