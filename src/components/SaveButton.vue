<script setup>
import { computed } from "vue";
import VueFeather from "vue-feather";
import { useSavedEventsStore } from "@/stores/savedEvents.js";

const props = defineProps({ event: { type: Object, required: true } });
const savedEvents = useSavedEventsStore();
const isSaved = computed(() => savedEvents.isSaved(props.event.id));
const canSave = computed(() => typeof props.event.id === "string" && Boolean(props.event.id.trim()));
const label = computed(() => canSave.value ? (isSaved.value ? "Saved" : "Save") : "Save unavailable");
const handleClick = (event) => {
	event.stopPropagation();
	event.preventDefault();
	if (canSave.value) savedEvents.toggle(props.event);
};
</script>

<template>
	<!-- Invisible ::after halo extends the button to at least a 48px touch target -->
	<button type="button"
		class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[#1f1b2c] shadow-[4px_4px_0_#1f1b2c] sm:h-9 sm:w-9 transition-colors disabled:cursor-not-allowed disabled:opacity-40 after:absolute after:-inset-2 after:rounded-full after:content-[''] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#8ec5ff]/60"
		:class="isSaved
			? 'border-[#1f1b2c] bg-[#ffe066] text-[#f15a24] hover:bg-[#ffe066]/70'
			: 'border-[#1f1b2c] bg-white text-[#f15a24] hover:bg-[#ffe066]/60'
			" :disabled="!canSave" :aria-pressed="isSaved ? 'true' : 'false'" :aria-label="label" :title="label" @click="handleClick">
		<vue-feather type="star" class="h-4 w-4" :fill="isSaved ? 'currentColor' : 'none'" aria-hidden="true" />
	</button>
</template>
