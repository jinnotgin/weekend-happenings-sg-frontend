<script setup>
import { ref } from "vue";
import { RouterLink, RouterView } from "vue-router";
import DropdownSelector from "@/components/DropdownSelector.vue";

const timeRangeOptions = {
	thisWeek: "this week",
	thisWeekend: "this weekend",
	nextWeek: "next week",
	nextWeekend: "next weekend",
	thisMonth: "this month",
	nextMonth: "next month",
};
const activeTimeRange = ref("thisWeekend");
function handleTimeRangeChange(newValue) {
	activeTimeRange.value = newValue;
}
</script>

<template>
	<header
		class="font-serif pt-10 max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto flex justify-between"
	>
		<div>
			<h1 class="text-5xl font-semibold text-orange-700">
				What's Happening 🍔🛍️🌳
			</h1>
			<h3 class="text-2xl mt-4 flex">
				in Singapore 🇸🇬,
				<DropdownSelector
					class="mx-3 text-2xl border-b-2 border-orange-700 transition hover:scale-105 hover:bg-red-100"
					:options="timeRangeOptions"
					:selectedValue="activeTimeRange"
					@update:selectedValue="handleTimeRangeChange"
				/>!
			</h3>
		</div>
		<nav>
			<RouterLink to="/">Home</RouterLink>
			<RouterLink to="/about">About</RouterLink>
		</nav>
	</header>

	<RouterView class="font-serif py-12" :activeTimeRange="activeTimeRange" />
</template>

<style>
body {
	background: #fcf8f7;
}
</style>
