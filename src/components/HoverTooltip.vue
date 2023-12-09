<script setup>
import { ref } from "vue";

const isVisible = ref(false);
let hideTimeout = null;

const showTooltip = () => {
	clearTimeout(hideTimeout);
	isVisible.value = true;
};

const hideTooltip = () => {
	isVisible.value = false;
};

const hideTooltipAfterDelay = () => {
	hideTimeout = setTimeout(() => {
		hideTooltip();
	}, 300); // Delay of 300 milliseconds
};
</script>

<template>
	<div
		class="relative flex"
		@mouseover="showTooltip"
		@mouseleave="hideTooltipAfterDelay"
	>
		<slot></slot>
		<div
			v-if="isVisible"
			class="absolute top-full left-1/2 transform -translate-x-1/2 bg-black text-white p-2 rounded-md z-10 mt-2 w-fit"
			@mouseover="showTooltip"
			@mouseleave="hideTooltipAfterDelay"
		>
			<slot name="tooltip-content"></slot>
		</div>
	</div>
</template>
