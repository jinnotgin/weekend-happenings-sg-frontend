<script setup>
import { ref } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import DropdownSelector from "@/components/DropdownSelector.vue";

const route = useRoute();
function isCurrentRoute(path) {
	return route.path === path;
}

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
		class="font-serif pt-10 px-5 max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto"
	>
		<div class="flex justify-between">
			<h1 class="text-4xl sm:text-5xl font-semibold text-orange-700">
				Now in <span class="hidden sm:inline">Singapore</span> 🇸🇬
			</h1>

			<nav>
				<RouterLink to="/" v-show="!isCurrentRoute('/')"
					><button
						class="border-2 border-orange-700 px-3 py-1 rounded-xl text-orange-700 hover:bg-orange-700 hover:text-white"
					>
						Home
					</button></RouterLink
				>
				<RouterLink to="/about" v-show="!isCurrentRoute('/about')">
					<button
						class="border-2 border-orange-700 px-3 py-1 rounded-xl text-orange-700 hover:bg-orange-700 hover:text-white"
					>
						About
					</button></RouterLink
				>
			</nav>
		</div>

		<h3
			class="text-xl sm:text-2xl mt-4 flex flex-wrap"
			v-show="isCurrentRoute('/')"
		>
			<span class="mr-2">Explore what's happening 🍔🛍️🌳,</span>
			<DropdownSelector
				class="text-xl sm:text-2xl mr-1 border-b-2 border-orange-700 transition hover:scale-105 hover:bg-red-100"
				:options="timeRangeOptions"
				:selectedValue="activeTimeRange"
				@update:selectedValue="handleTimeRangeChange"
			/>!
		</h3>
	</header>

	<RouterView
		class="font-serif pt-4 sm:pt-12"
		:activeTimeRange="activeTimeRange"
	/>
	<footer
		class="font-serif pt-10 pb-14 px-5 max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto flex justify-between"
	>
		<span
			>Made by
			<a
				href="https://jinn.me"
				class="underline text-orange-700"
				target="_blank"
				>Jin</a
			>, © 2023</span
		>
		<VMenu placement="top">
			<a href="mailto:nowinsg@jinn.me" class="underline">Submit your event</a>
			<template #popper
				><div class="bg-orange-700 text-white p-2">
					nowinsg@jinn.me
				</div></template
			>
		</VMenu>
	</footer>
</template>

<style>
body {
	background: #fcf8f7;
}
</style>
