<script setup>
import { ref, computed, onMounted } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { useEventsStore } from "@/stores/events.js";
import DropdownSelector from "@/components/DropdownSelector.vue";

const route = useRoute();
function isCurrentRoute(path) {
	return route.path === path;
}

const events = useEventsStore();
onMounted(() => {
	if (
		events.fetchEventsStatus === "idle" ||
		events.fetchEventsStatus === "error"
	) {
		events.fetchEvents();
	}
});
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
	events.triggerFakeLoading();
	activeTimeRange.value = newValue;
}

const categoryOptions = computed(() => {
	return ["all", ...events.categories];
});
const activeCategory = ref("all");
function handleCategoryChange(newValue) {
	events.triggerFakeLoading();
	activeCategory.value = newValue;
}

const preferredRegionOrder = [
	"Central",
	"East",
	"North-East",
	"North",
	"West",
	"Islands & Offshore",
];
const locationOptions = computed(() => {
	const options = {
		anywhere: "Singapore",
	};
	const regions = Array.isArray(events.regions) ? events.regions : [];
	const normalizedRegions = new Map(
		regions.map((region) => [region.toLowerCase(), region])
	);

	const orderedRegions = [];
	for (const regionName of preferredRegionOrder) {
		const match = normalizedRegions.get(regionName.toLowerCase());
		if (match) {
			orderedRegions.push(match);
			normalizedRegions.delete(regionName.toLowerCase());
		}
	}

	const remainingRegions = Array.from(normalizedRegions.values()).sort(
		(a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })
	);

	for (const region of [...orderedRegions, ...remainingRegions]) {
		options[region] = region;
	}

	options.nearMe = "your area";

	return options;
});
const activeLocation = ref("anywhere");
const userLocation = ref(null);
/**
 * @type {import('vue').Ref<'idle' | 'locating' | 'ready' | 'error' | 'unsupported'>}
 */
const locationStatus = ref("idle");
const locationErrorMessage = ref("");
const canRetryLocation = ref(false);

function handleLocationChange(newValue) {
	locationErrorMessage.value = "";
	canRetryLocation.value = false;
	if (newValue === "nearMe") {
		if (!("geolocation" in navigator)) {
			locationStatus.value = "unsupported";
			locationErrorMessage.value =
				"Location access isn't supported on this device. Showing all events instead.";
			activeLocation.value = "anywhere";
			events.triggerFakeLoading();
			return;
		}

		activeLocation.value = "nearMe";
		locationStatus.value = "locating";
		events.triggerFakeLoading();

		navigator.geolocation.getCurrentPosition(
			(position) => {
				userLocation.value = {
					lat: position.coords.latitude,
					lng: position.coords.longitude,
				};
				locationStatus.value = "ready";
				events.triggerFakeLoading();
			},
			(error) => {
				locationStatus.value = "error";
				canRetryLocation.value = true;
				if (error.code === error.PERMISSION_DENIED) {
					locationErrorMessage.value =
						"Location permission denied. Showing Singapore events instead.";
				} else {
					locationErrorMessage.value =
						"We couldn't fetch your location right now. Showing Singapore events instead.";
				}
				activeLocation.value = "anywhere";
				userLocation.value = null;
				events.triggerFakeLoading();
			},
			{
				enableHighAccuracy: false,
				timeout: 10000,
				maximumAge: 300000,
			}
		);
		return;
	}

	userLocation.value = null;
	locationStatus.value = "idle";
	activeLocation.value = newValue;
	events.triggerFakeLoading();
}

function retryLocationRequest() {
	handleLocationChange("nearMe");
}

const currentYear = new Date().getFullYear();
</script>

<template>
	<header class="relative pl-4 pr-6 pt-8 pb-5 sm:pt-10">
		<div
			class="absolute inset-x-3 -top-10 h-48 rounded-[36px] bg-gradient-to-r from-[#ffe066] via-[#ff8ba7] to-[#8ec5ff] opacity-60 blur-3xl">
		</div>
		<div
			class="relative mx-auto flex w-full max-w-6xl flex-col gap-2 sm:gap-6 rounded-[32px] border-4 border-black bg-white/80 px-3 py-5 shadow-[8px_8px_0_#1f1b2c] backdrop-blur sm:gap-8 sm:px-6 sm:py-8 sm:shadow-[16px_16px_0_#1f1b2c]">
			<div
				class="grid items-start gap-3 [grid-template-columns:minmax(0,1fr)_auto] sm:flex sm:gap-6 sm:items-start sm:justify-between">
				<RouterLink to="/" class="block w-full">
					<h1
						class="flex items-center gap-2 text-3xl font-bold leading-tight text-[#1f1b2c] sm:gap-3 sm:text-5xl md:text-6xl">
						<span>
							<span>Now in </span>
							<span class="hidden sm:inline">Singapore</span>
						</span>
						<span aria-hidden="true" class="text-3xl sm:text-4xl">🇸🇬</span>
					</h1>
					<p class="mt-1 font-sans text-xs uppercase tracking-[0.2em] text-[#f15a24] sm:mt-3 sm:text-base">
						F<span class="hidden sm:inline">ast f</span>inds for your<span class="hidden sm:inline"> next</span>
						outing<span class="inline sm:hidden">s</span>.
					</p>
				</RouterLink>

				<nav class="flex flex-wrap justify-end gap-2 self-start sm:mt-0 sm:gap-3">
					<RouterLink to="/" v-show="!isCurrentRoute('/')">
						<button
							class="rounded-full border-2 border-black bg-[#ffe066] px-3 py-1 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-[#1f1b2c] shadow-[4px_4px_0_#1f1b2c] transition-transform hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#f15a24] sm:px-4 sm:py-2 sm:text-sm sm:tracking-widest">
							Home
						</button>
					</RouterLink>
					<RouterLink to="/about" v-show="!isCurrentRoute('/about')">
						<button
							class="rounded-full border-2 border-black bg-white px-3 py-1 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-[#1f1b2c] shadow-[4px_4px_0_#1f1b2c] transition-transform hover:-translate-y-0.5 hover:bg-[#ff8ba7] hover:shadow-[6px_6px_0_#f15a24] sm:px-4 sm:py-2 sm:text-sm sm:tracking-widest">
							About
						</button>
					</RouterLink>
				</nav>
			</div>

			<h3
				class="flex flex-wrap items-center justify-start gap-x-2 gap-y-1 leading-10 font-serif text-xs text-[#1f1b2c] sm:flex-nowrap sm:text-xl md:text-2xl"
				v-show="isCurrentRoute('/')">
				<span class="hidden lg:inline">Explore</span>
				<DropdownSelector class="text-xs sm:text-lg md:text-xl mr-1 sm:mr-2" :options="categoryOptions"
					:selectedValue="activeCategory" @update:selectedValue="handleCategoryChange" />
				<span>events</span>
				<DropdownSelector class="text-xs sm:text-lg md:text-xl mr-1 sm:mr-2" :options="timeRangeOptions"
					:selectedValue="activeTimeRange" @update:selectedValue="handleTimeRangeChange" />
				<span>in</span>
				<DropdownSelector class="text-xs sm:text-lg md:text-xl mr-1 sm:mr-2" :options="locationOptions"
					:selectedValue="activeLocation" @update:selectedValue="handleLocationChange" />
				<span class="hidden sm:inline">!</span>
			</h3>
			<p v-if="locationStatus === 'locating'"
				class="mt-1 font-sans text-[11px] uppercase tracking-[0.25em] text-[#1f1b2c]/70 sm:text-xs">
				Fetching events near you…
			</p>
			<div v-else-if="locationErrorMessage"
				class="mt-1 flex flex-wrap items-center gap-2 font-sans text-[11px] uppercase tracking-[0.25em] text-[#f15a24] sm:text-xs">
				<span>{{ locationErrorMessage }}</span>
				<button v-if="canRetryLocation" type="button"
					class="rounded-full border border-[#f15a24] px-2 py-1 font-semibold tracking-[0.2em] text-[#f15a24] transition-colors hover:bg-[#f15a24] hover:text-white sm:px-3"
					@click="retryLocationRequest">
					Try again
				</button>
			</div>
		</div>
	</header>

	<main class="pl-4 pr-6 pb-8 pt-4 sm:pb-14 sm:pt-8">
		<RouterView class="mx-auto w-full max-w-6xl" :activeTimeRange="activeTimeRange" :activeCategory="activeCategory"
			:activeLocation="activeLocation" :userLocation="userLocation" :locationStatus="locationStatus" />
	</main>
	<footer class="pl-4 pr-6 pb-24 lg:pb-14">
		<div
			class="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 rounded-[28px] border-4 border-black bg-white/80 px-5 py-5 font-serif text-sm sm:text-base shadow-[8px_8px_0_#1f1b2c] backdrop-blur sm:shadow-[16px_16px_0_#1f1b2c] md:flex-row md:items-center">
			<span class="font-sans text-xs sm:text-sm uppercase tracking-[0.3em] text-[#1f1b2c]">
				Made by
				<a href="https://jinn.me"
					class="underline decoration-2 decoration-[#f15a24] underline-offset-4 hover:text-[#f15a24]" target="_blank">
					Jin
				</a>
				· © 2024 - {{ currentYear }}
			</span>
			<VMenu placement="top">
				<a href="mailto:nowinsg@jinn.me"
					class="font-sans text-xs sm:text-sm uppercase tracking-[0.3em] text-[#1f1b2c] underline decoration-dotted underline-offset-4 hover:text-[#f15a24]">
					Submit your event
				</a>
				<template #popper>
					<div class="rounded-md bg-[#1f1b2c] px-3 py-2 font-sans text-xs text-white">
						nowinsg@jinn.me
					</div>
				</template>
			</VMenu>
		</div>
	</footer>
</template>

<style></style>
