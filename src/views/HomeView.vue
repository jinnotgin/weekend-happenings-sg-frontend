<script setup>
import {
        computed,
        ref,
        onMounted,
        onBeforeUnmount,
        nextTick,
        watch,
} from "vue";
import { useEventsStore } from "@/stores/events.js";
import { calculateDistanceKm } from "@/utils.js";
import VueFeather from "vue-feather";
import CurvedLoop from "@/components/CurvedLoop.vue";
import NavigationPill from "@/components/NavigationPill.vue";

const events = useEventsStore();
const props = defineProps({
        activeTimeRange: String,
        activeCategory: String,
        activeLocation: String,
        userLocation: Object,
        locationStatus: String,
});

const NEAR_ME_RADIUS_KM = 10;
const SCROLL_EDGE_THRESHOLD_PX = 160; // Distance (px) from page edges to trigger snap-to-first/last events
const bounceDurationMs = 600;
const HOLD_EFFECT_DURATION_MS = 720;

const bounceState = ref(null);
const pressedDirection = ref(null);
const holdEffectDirection = ref(null);

let bounceTimeoutId = null;
let holdEffectTimeoutId = null;
// Prevents repeatedly snapping to the last event when the user is already at the bottom edge.
let hasBottomEdgeSnap = false;

const extractCoordinates = (coords) => {
        if (!coords || typeof coords !== "object") {
                return null;
        }
        const lat =
                typeof coords.lat === "number"
                        ? coords.lat
                        : typeof coords.latitude === "number"
                        ? coords.latitude
                        : null;
        const lng =
                typeof coords.lng === "number"
                        ? coords.lng
                        : typeof coords.longitude === "number"
                        ? coords.longitude
                        : null;
        if (lat === null || lng === null) {
                return null;
        }
        return { lat, lng };
};

const createLocationSummary = (event) => {
        const locationsArray = Array.isArray(event.locations)
                ? event.locations.filter(Boolean)
                : [];
        const fallbackName =
                event.location ||
                locationsArray[0]?.name ||
                locationsArray[0]?.approximate_region ||
                "Details coming soon";

        const summarizeLocation = (location, fallback) => {
                if (!location) {
                        return null;
                }
                const detailSegments = [];
                if (location.approximate_region) {
                        detailSegments.push(location.approximate_region);
                }
                if (location.approximate_nearest_mrt) {
                        detailSegments.push(
                                `Near ${location.approximate_nearest_mrt}`
                        );
                }
                return {
                        name:
                                location.name ||
                                location.approximate_region ||
                                fallback,
                        details: detailSegments.join(" • ") || null,
                        mapUrl: location.google_maps_url || null,
                };
        };

        if (!locationsArray.length) {
                return {
                        name: fallbackName,
                        details: null,
                        mapUrl: null,
                        additionalLocations: 0,
                        otherLocations: [],
                };
        }

        const [primaryLocation, ...otherLocationsRaw] = locationsArray;
        const primarySummary = summarizeLocation(primaryLocation, fallbackName);
        const otherLocations = otherLocationsRaw
                .map((location) => summarizeLocation(location, fallbackName))
                .filter(Boolean);

        return {
                name: primarySummary?.name || fallbackName,
                details: primarySummary?.details || null,
                mapUrl: primarySummary?.mapUrl || null,
                additionalLocations: otherLocations.length,
                otherLocations,
        };
};

const getScrollingElement = () => {
        if (typeof document === "undefined") {
                return null;
        }
        return document.scrollingElement || document.documentElement;
};

const isNearTopEdge = () => {
        if (typeof window === "undefined") {
                return false;
        }
        const scrollingElement = getScrollingElement();
        if (!scrollingElement) {
                return false;
        }
        const scrollTop = Math.max(
                scrollingElement.scrollTop,
                window.scrollY || 0
        );
        return scrollTop <= SCROLL_EDGE_THRESHOLD_PX;
};

const isNearBottomEdge = () => {
        if (typeof window === "undefined") {
                return false;
        }
        const scrollingElement = getScrollingElement();
        if (!scrollingElement) {
                return false;
        }
        const scrollTop = Math.max(
                scrollingElement.scrollTop,
                window.scrollY || 0
        );
        const remainingDistance =
                scrollingElement.scrollHeight -
                scrollTop -
                window.innerHeight;
        return remainingDistance <= SCROLL_EDGE_THRESHOLD_PX;
};

const triggerBounce = (direction) => {
        if (typeof window === "undefined") {
                return;
        }
        bounceState.value = direction;
        if (bounceTimeoutId) {
                window.clearTimeout(bounceTimeoutId);
        }
        bounceTimeoutId = window.setTimeout(() => {
                bounceState.value = null;
                bounceTimeoutId = null;
        }, bounceDurationMs);
};

const triggerHoldEffect = (direction) => {
        if (typeof window === "undefined") {
                return;
        }
        holdEffectDirection.value = direction;
        if (holdEffectTimeoutId) {
                window.clearTimeout(holdEffectTimeoutId);
        }
        holdEffectTimeoutId = window.setTimeout(() => {
                holdEffectDirection.value = null;
                holdEffectTimeoutId = null;
        }, HOLD_EFFECT_DURATION_MS);
};

const filteredEvents = computed(() => {
        if (
                !props.activeTimeRange ||
                !props.activeCategory ||
                !props.activeLocation
        ) {
                return [];
        }

        const matchesLocation = (event) => {
                if (!props.activeLocation || props.activeLocation === "anywhere") {
                        return true;
                }

                if (props.activeLocation === "nearMe") {
                        if (props.locationStatus !== "ready" || !props.userLocation) {
                                return false;
                        }
                        const userCoords = extractCoordinates(props.userLocation);
                        if (!userCoords) {
                                return false;
                        }
                        const eventLocations = Array.isArray(event.locations)
                                ? event.locations
                                : [];
                        return eventLocations.some((location) => {
                                const coords = extractCoordinates(
                                        location?.approximate_gps
                                );
                                if (!coords) {
                                        return false;
                                }
                                const distance = calculateDistanceKm(
                                        userCoords,
                                        coords
                                );
                                return distance <= NEAR_ME_RADIUS_KM;
                        });
                }

                const targetRegion = props.activeLocation.trim().toLowerCase();
                if (!targetRegion) {
                        return true;
                }
                const regions = (Array.isArray(event.locations)
                        ? event.locations
                        : []
                )
                        .map((location) => location?.approximate_region)
                        .filter(Boolean)
                        .map((region) => region.trim().toLowerCase());
                return regions.includes(targetRegion);
        };

        return events
                .getItemsInDateRangeAndCategory(
                        props.activeTimeRange,
                        props.activeCategory
                )
                .filter((event) => matchesLocation(event))
                .map((event) => ({
                        ...event,
                        locationSummary: createLocationSummary(event),
                }));
});

const eventListRef = ref(null);
const eventElements = ref([]);
const visibleEventIndexes = ref([]);
const activeEventIndex = ref(0);
const isMobile = ref(false);
let scrollRafId = null;
let observer;
let mediaQuery;
let holdTimeoutId = null;
let holdFired = false;
let holdIgnoreTimeoutId = null;
const expandedLocationCards = ref(new Set());

const resetLocationExpansions = () => {
        expandedLocationCards.value = new Set();
};

const isLocationsExpanded = (index) => {
        return expandedLocationCards.value.has(index);
};

const toggleLocationsExpanded = (index) => {
        const next = new Set(expandedLocationCards.value);
        if (next.has(index)) {
                next.delete(index);
        } else {
                next.add(index);
        }
        expandedLocationCards.value = next;
};
const handleMediaChange = (event) => {
        isMobile.value = event.matches;
};

const shouldShowNavigator = computed(() => filteredEvents.value.length > 1);
const totalEvents = computed(() => filteredEvents.value.length);
const currentDisplayIndex = computed(() => {
        if (!totalEvents.value) {
                return 0;
        }
        const index = activeEventIndex.value ?? 0;
        return Math.min(index + 1, totalEvents.value);
});

const isAwaitingLocationResults = computed(() => {
        return (
                props.activeLocation === "nearMe" &&
                props.locationStatus === "locating"
        );
});

const shouldShowEmptyState = computed(() => {
        if (isAwaitingLocationResults.value) {
                return false;
        }
        return filteredEvents.value.length === 0;
});

watch(totalEvents, (newTotal) => {
        if (!newTotal) {
                activeEventIndex.value = 0;
                return;
        }
        if (activeEventIndex.value >= newTotal) {
                activeEventIndex.value = newTotal - 1;
        }
});

function updateActiveEventIndex() {
        if (!eventElements.value.length) {
                activeEventIndex.value = 0;
                return;
        }

        const viewportMiddle = window.innerHeight / 2;
        let closestIndex = activeEventIndex.value ?? 0;
        let smallestDistance = Number.POSITIVE_INFINITY;

        const activeNode = eventElements.value[closestIndex];
        if (activeNode) {
                const activeRect = activeNode.getBoundingClientRect();
                smallestDistance = Math.abs(
                        activeRect.top + activeRect.height / 2 - viewportMiddle
                );
        }

        eventElements.value.forEach((node, index) => {
                const rect = node.getBoundingClientRect();
                const elementCenter = rect.top + rect.height / 2;
                const distance = Math.abs(elementCenter - viewportMiddle);
                if (distance < smallestDistance) {
                        smallestDistance = distance;
                        closestIndex = index;
                }
        });

        activeEventIndex.value = closestIndex;
}

function handleScrollEvent() {
        if (scrollRafId) {
                return;
        }
        scrollRafId = window.requestAnimationFrame(() => {
                scrollRafId = null;
                updateActiveEventIndex();
        });
}

const updateVisibleIndexes = (index, isVisible) => {
        const current = new Set(visibleEventIndexes.value);
        if (isVisible) {
                current.add(index);
        } else {
                current.delete(index);
        }
        visibleEventIndexes.value = Array.from(current).sort((a, b) => a - b);
        handleScrollEvent();
};

const handleIntersection = (entries) => {
        entries.forEach((entry) => {
                const index = Number(entry.target.dataset.eventIndex);
                if (Number.isNaN(index)) {
                        return;
                }
                updateVisibleIndexes(index, entry.isIntersecting);
        });
};

const refreshEventElements = async () => {
        await nextTick();
        visibleEventIndexes.value = [];
        eventElements.value = [];

        if (!eventListRef.value) {
                activeEventIndex.value = 0;
                return;
        }

        if (observer) {
                observer.disconnect();
        }

        const nodes = Array.from(
                eventListRef.value.querySelectorAll("[data-event-card]")
        );
        if (!nodes.length || !observer) {
                activeEventIndex.value = 0;
                return;
        }

        nodes.forEach((node, index) => {
                node.dataset.eventIndex = index.toString();
                observer.observe(node);
        });
        eventElements.value = nodes;
        activeEventIndex.value = 0;
        updateActiveEventIndex();
};

const scrollToEvent = (index) => {
        const target = eventElements.value[index];
        if (!target) {
                return;
        }

        activeEventIndex.value = index;
        const scrollMargin = 16;
        const targetTop =
                target.getBoundingClientRect().top + window.scrollY - scrollMargin;

        window.scrollTo({
                top: Math.max(targetTop, 0),
                behavior: "smooth",
        });
};

const scrollToPageBoundary = (direction) => {
        const scrollingElement =
                document.scrollingElement || document.documentElement;
        const targetPosition =
                direction === "up"
                        ? 0
                        : Math.max(
                                  scrollingElement.scrollHeight - window.innerHeight,
                                  0
                          );

        window.scrollTo({
                top: targetPosition,
                behavior: "smooth",
        });
};

const handleNavigate = (direction) => {
        if (!totalEvents.value) {
                return;
        }

        const nearBottom = isNearBottomEdge();

        if (!nearBottom) {
                hasBottomEdgeSnap = false;
        }

        if (direction === "down") {
                if (isNearTopEdge()) {
                        activeEventIndex.value = 0;
                        scrollToEvent(0);
                        return;
                }

                if (nearBottom) {
                        const lastIndex = totalEvents.value ? totalEvents.value - 1 : 0;
                        activeEventIndex.value = lastIndex;
                        triggerBounce("down");
                        scrollToPageBoundary("down");
                        hasBottomEdgeSnap = false;
                        return;
                }
        }

        const fallbackIndex = visibleEventIndexes.value.length
                ? visibleEventIndexes.value[0]
                : 0;
        const currentIndex =
                activeEventIndex.value ?? Math.min(fallbackIndex, totalEvents.value - 1);

        if (direction === "up") {
                const lastIndex = totalEvents.value ? totalEvents.value - 1 : 0;
                if (nearBottom && !hasBottomEdgeSnap) {
                        hasBottomEdgeSnap = true;
                        activeEventIndex.value = lastIndex;
                        triggerBounce("up");
                        scrollToEvent(lastIndex);
                        return;
                }

                if (currentIndex <= 0) {
                        activeEventIndex.value = 0;
                        triggerBounce("up");
                        scrollToPageBoundary("up");
                        return;
                }
                scrollToEvent(currentIndex - 1);
                return;
        }

        if (currentIndex >= totalEvents.value - 1) {
                const lastIndex = totalEvents.value - 1;
                activeEventIndex.value = lastIndex;
                triggerBounce("down");
                scrollToPageBoundary("down");
                hasBottomEdgeSnap = false;
                return;
        }
        scrollToEvent(currentIndex + 1);
};

const holdDelayMs = 500;

const resetHoldFired = () => {
        holdFired = false;
        if (holdIgnoreTimeoutId) {
                clearTimeout(holdIgnoreTimeoutId);
                holdIgnoreTimeoutId = null;
        }
};

const startHold = (direction) => {
        resetHoldFired();
        stopHold();
        holdTimeoutId = window.setTimeout(() => {
                holdTimeoutId = null;
                holdFired = true;
                if (holdIgnoreTimeoutId) {
                        clearTimeout(holdIgnoreTimeoutId);
                }
                holdIgnoreTimeoutId = window.setTimeout(() => {
                        holdFired = false;
                        holdIgnoreTimeoutId = null;
                }, 350);
                triggerHoldEffect(direction);
                if (direction === "up") {
                        activeEventIndex.value = 0;
                        scrollToPageBoundary("up");
                } else {
                        activeEventIndex.value = totalEvents.value
                                ? totalEvents.value - 1
                                : 0;
                        scrollToPageBoundary("down");
                }

                if ("vibrate" in navigator) {
                        navigator.vibrate(500); // Vibrates for 500 milliseconds
                }
        }, holdDelayMs);
};

const stopHold = () => {
        if (holdTimeoutId) {
                clearTimeout(holdTimeoutId);
                holdTimeoutId = null;
        }
};

const handlePressStart = (direction) => {
        pressedDirection.value = direction;
        startHold(direction);
};

const handlePressEnd = () => {
        pressedDirection.value = null;
        stopHold();
};

const handlePressCancel = () => {
        pressedDirection.value = null;
        stopHold();
};

const handleNavigatorClick = (direction) => {
        if (holdFired) {
                resetHoldFired();
                return;
        }
        handleNavigate(direction);
};

onMounted(() => {
        observer = new IntersectionObserver(handleIntersection, {
                threshold: 0.1,
        });
        refreshEventElements();
        window.addEventListener("scroll", handleScrollEvent, { passive: true });
        handleScrollEvent();

        if (typeof window !== "undefined" && "matchMedia" in window) {
                mediaQuery = window.matchMedia("(max-width: 767px)");
                handleMediaChange(mediaQuery);
                if ("addEventListener" in mediaQuery) {
                        mediaQuery.addEventListener("change", handleMediaChange);
                } else if ("addListener" in mediaQuery) {
                        mediaQuery.addListener(handleMediaChange);
                }
        }

        watch(
                filteredEvents,
                async () => {
                        resetLocationExpansions();
                        await refreshEventElements();
                },
                { flush: "post" }
        );
});

onBeforeUnmount(() => {
        if (observer) {
                observer.disconnect();
        }
        window.removeEventListener("scroll", handleScrollEvent);
        if (mediaQuery) {
                if ("removeEventListener" in mediaQuery) {
                        mediaQuery.removeEventListener("change", handleMediaChange);
                } else if ("removeListener" in mediaQuery) {
                        mediaQuery.removeListener(handleMediaChange);
                }
                mediaQuery = null;
        }
        if (scrollRafId) {
                window.cancelAnimationFrame(scrollRafId);
                scrollRafId = null;
        }
        stopHold();
        resetHoldFired();
        pressedDirection.value = null;
        bounceState.value = null;
        if (bounceTimeoutId) {
                window.clearTimeout(bounceTimeoutId);
                bounceTimeoutId = null;
        }
        holdEffectDirection.value = null;
        if (holdEffectTimeoutId) {
                window.clearTimeout(holdEffectTimeoutId);
                holdEffectTimeoutId = null;
        }
        hasBottomEdgeSnap = false;
});
</script>

<template>
        <main class="flex flex-col gap-8 px-0">
		<div
			class="mx-auto flex w-full scale-125 flex-col items-center bg-white/85 backdrop-blur pb-14 sm:pb-28"
			v-if="events.fetchEventsStatus !== 'success'"
		> <!-- hack: using scale-125 to combat the popping issue-->
			<div
				class="flex w-full flex-col items-center gap-6"
				v-show="
					events.fetchEventsStatus === 'idle' ||
					events.fetchEventsStatus === 'fetching'
				"
			>
                                <!-- hack: due to using scale-125, we will begin with "p" and end with "Scoo" (rather than end with "Scoop")-->
                                <!-- CurveLoop component has a hack as well due to this, refer to the component to see more -->
				<CurvedLoop
					marquee-text="p ✦ Buzz ✦ Scoo"
					text-class="font-sans uppercase tracking-[0.35em]"
					:speed="3.5"
					:curve-amount="400"
					:interactive="false"
				/>
			</div>
			<div
				v-show="events.fetchEventsStatus === 'error'"
				class="mx-auto w-full max-w-6xl rounded-[32px] border-4 border-black bg-[#ff8ba7]/20 px-4 py-8 text-center font-sans shadow-[8px_8px_0_#1f1b2c] backdrop-blur sm:px-8 sm:py-10 sm:shadow-[16px_16px_0_#f15a24]"
			>
				<p class="text-base font-semibold text-[#1f1b2c] sm:text-2xl">
					There was an error loading this page.
				</p>
				<p class="mt-4 text-xs uppercase tracking-[0.3em] text-[#f15a24] sm:text-sm">
					Please try again later!
				</p>
			</div>
		</div>
		<div
			v-show="events.fetchEventsStatus === 'success'"
			class="flex flex-col gap-6 pb-6 lg:gap-8"
		>
			<div v-if="filteredEvents.length > 0" class="mx-auto max-w-4xl text-center">
				<p class="font-sans text-xs sm:text-sm uppercase tracking-[0.4em] text-[#1f1b2c]/70">
					Information may be imperfect - double check first!
				</p>
			</div>
			<div
				v-if="isAwaitingLocationResults"
				class="mx-auto w-full max-w-6xl rounded-[32px] border-4 border-black bg-white/80 px-4 py-8 text-center font-sans text-sm shadow-[8px_8px_0_#1f1b2c] backdrop-blur sm:px-8 sm:py-12 sm:text-lg sm:shadow-[16px_16px_0_#1f1b2c]"
			>
                                <p class="font-sans text-sm text-[#1f1b2c] sm:text-base">
                                        Finding events near you…
                                </p>
                        </div>
			<div
				v-show="shouldShowEmptyState"
				class="mx-auto w-full max-w-6xl rounded-[32px] border-4 border-black bg-white/80 px-4 py-8 text-center font-sans text-sm shadow-[8px_8px_0_#1f1b2c] backdrop-blur sm:px-8 sm:py-12 sm:text-lg sm:shadow-[16px_16px_0_#1f1b2c]"
			>
                                <p>Oh no! 😞 We couldn't find any events for this category / time period / area.</p>
                                <p class="mt-4 text-xs uppercase tracking-[0.3em] text-[#f15a24] sm:text-sm">
                                        Try adjusting your filters for more results!
                                </p>
                        </div>
			<ul
				class="flex flex-col gap-8"
				v-show="filteredEvents.length > 0"
				ref="eventListRef"
			>
                                <li
                                        v-for="(event, index) in filteredEvents"
                                        :key="index"
                                        class="transition-transform duration-200"
                                        data-event-card
                                        :data-event-index="index"
                                >
				<div
					class="group relative bg-white/80 overflow-hidden rounded-[32px] border-4 border-black bg-white/85 px-4 py-5 shadow-[8px_8px_0_#1f1b2c] backdrop-blur transition-all duration-200 sm:px-8 sm:py-8 lg:hover:-translate-y-1 lg:hover:shadow-[16px_16px_0_#f15a24]"
			>
                                                <div
                                                        class="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-[#ffe066] via-[#ff8ba7] to-[#8ec5ff] opacity-40 blur-3xl transition-opacity group-hover:opacity-60"
                                                ></div>
                                                <div class="relative z-10 flex flex-col-reverse gap-6 lg:flex-row lg:items-start lg:gap-10">
                                                <div class="flex flex-1 flex-col gap-5">
					<div class="flex items-start gap-3 sm:gap-4">
                                                                <a
                                                                        :href="event.link"
                                                                        target="_blank"
                                                                        rel="noopener"
                                                                        class="min-w-0 flex-1 text-xl font-bold leading-tight text-[#1f1b2c] underline-offset-8 transition-colors hover:text-[#f15a24] hover:underline sm:text-3xl"
                                                                >
                                                                        <span class="min-w-0 break-words">{{ event.title }}</span>
                                                                </a>
                                                                <div class="ml-auto flex items-start gap-2">
                                                                        <a
                                                                                :href="event.link"
                                                                                target="_blank"
                                                                                rel="noopener"
                                                                                aria-label="Open event in a new tab"
                                                                                class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#1f1b2c] bg-white text-[#f15a24] shadow-[4px_4px_0_#1f1b2c] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#f15a24] sm:h-9 sm:w-9"
                                                                        >
                                                                                <vue-feather type="arrow-up-right" class="h-4 w-4 sm:h-5 sm:w-5" />
                                                                        </a>
                                                                        <VMenu class="inline-flex">
                                                                                <button
                                                                                        type="button"
                                                                                        class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#1f1b2c] bg-white text-[#1f1b2c] shadow-[4px_4px_0_#1f1b2c] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#f15a24] sm:h-9 sm:w-9"
                                                                                >
                                                                                        <vue-feather type="info" class="h-4 w-4 sm:h-5 sm:w-5" />
                                                                                </button>
                                                                        <template #popper>
                                                                                <div
                                                                                        class="min-w-[200px] rounded-md border-2 border-black bg-[#1f1b2c] px-3 py-3 font-sans text-xs text-white shadow-[4px_4px_0_#f15a24]"
                                                                                >
                                                                                        <p class="font-bold uppercase tracking-[0.3em] text-[#ffe066]">
                                                                                                Sources
                                                                                        </p>
                                                                                        <a
                                                                                                v-for="({ title, url }, index) in events.getSourcesData(
                                                                                                        event.source
                                                                                                )"
                                                                                                :key="index"
                                                                                                :href="url"
                                                                                                target="_blank"
                                                                                                class="mt-2 block text-left underline-offset-4 hover:underline"
                                                                                        >
                                                                                                {{ index + 1 }}. {{ title }}
                                                                                        </a>
                                                                                </div>
                                                                        </template>
                                                                        </VMenu>
                                                                </div>
                                                        </div>
                                                        <p class="font-sans text-sm leading-relaxed text-[#1f1b2c] sm:text-lg">
                                                                {{ event.description }}
                                                        </p>
					<div class="grid items-start gap-3 sm:grid-cols-3 sm:gap-6">
                                                                <div class="rounded-2xl border-2 border-dashed border-[#1f1b2c]/40 bg-[#ffe066]/30 px-3 py-2.5 sm:px-4 sm:py-3">
                                                                        <p class="font-sans text-xs uppercase tracking-[0.3em] text-[#f15a24]">
                                                                                Date
                                                                        </p>
                                                                        <p class="mt-2 font-serif text-base text-[#1f1b2c] sm:text-lg">
                                                                                {{ event.datetime }}
                                                                        </p>
                                                                </div>
                                                                <div class="rounded-2xl border-2 border-dashed border-[#1f1b2c]/40 bg-[#8ec5ff]/20 px-3 py-2.5 sm:px-4 sm:py-3">
                                                                        <p class="font-sans text-xs uppercase tracking-[0.3em] text-[#f15a24]">
                                                                                Location
                                                                        </p>
                                                                        <div class="mt-2 flex flex-col gap-2">
                                                                                <div class="flex items-start gap-2">
                                                                                        <div class="flex-1 flex flex-col gap-1 lg:gap-1.5">
                                                                                                <p class="font-serif text-base text-[#1f1b2c] sm:text-lg">
                                                                                                        {{ event.locationSummary.name }}
                                                                                                </p>
                                                                                                <p
                                                                                                        v-if="event.locationSummary.details"
                                                                                                        class="font-sans text-xs text-[#1f1b2c]/70"
                                                                                                >
                                                                                                        {{ event.locationSummary.details }}
                                                                                                </p>
                                                                                        </div>
                                                                                        <a
                                                                                                v-if="event.locationSummary.mapUrl"
                                                                                                :href="event.locationSummary.mapUrl"
                                                                                                target="_blank"
                                                                                                rel="noopener"
                                                                                                class="flex shrink-0 items-center justify-center rounded-full border border-[#1f1b2c]/40 bg-white/70 p-1.5 text-[#1f1b2c] transition-colors hover:bg-[#1f1b2c] hover:text-white"
                                                                                        >
                                                                                                <vue-feather type="map-pin" class="h-4 w-4" />
                                                                                                <span class="sr-only">Open map</span>
                                                                                        </a>
                                                                                </div>
                                                                                <div
                                                                                        v-if="event.locationSummary.additionalLocations"
                                                                                        class="flex flex-col gap-2"
                                                                                >
                                                                                        <button
                                                                                                type="button"
                                                                                                class="inline-flex items-center gap-1 self-start rounded-full border border-[#1f1b2c]/30 bg-transparent px-2.5 py-1 text-xs font-sans text-[#1f1b2c] transition-colors hover:border-[#1f1b2c] hover:bg-[#1f1b2c]/5"
                                                                                                @click="toggleLocationsExpanded(index)"
                                                                                                :aria-expanded="isLocationsExpanded(index)"
                                                                                                :aria-controls="`event-location-list-${index}`"
                                                                                        >
                                                                                                <vue-feather
                                                                                                        :type="isLocationsExpanded(index) ? 'chevron-up' : 'chevron-down'"
                                                                                                        class="h-3.5 w-3.5"
                                                                                                />
                                                                                                <span v-if="!isLocationsExpanded(index)">
                                                                                                        +{{ event.locationSummary.additionalLocations }}
                                                                                                        more location<span
                                                                                                                v-if="event.locationSummary.additionalLocations > 1"
                                                                                                        >s</span>
                                                                                                </span>
                                                                                                <span v-else>Hide extra locations</span>
                                                                                        </button>
                                                                                        <ul
                                                                                                v-if="isLocationsExpanded(index)"
                                                                                                :id="`event-location-list-${index}`"
                                                                                                class="space-y-2 border-t border-dashed border-[#1f1b2c]/20 pt-2"
                                                                                        >
                                                                                                <li
                                                                                                        v-for="(location, locationIndex) in event.locationSummary.otherLocations"
                                                                                                        :key="locationIndex"
                                                                                                        class="flex items-start gap-2"
                                                                                                >
                                                                                                        <span class="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-[#1f1b2c]/50"></span>
                                                                                                        <div class="flex flex-1 flex-col gap-1">
                                                                                                                <div class="flex items-start gap-2">
                                                                                                                        <p class="font-serif text-sm text-[#1f1b2c]">
                                                                                                                                {{ location.name }}
                                                                                                                        </p>
                                                                                                                        <a
                                                                                                                                v-if="location.mapUrl"
                                                                                                                                :href="location.mapUrl"
                                                                                                                                target="_blank"
                                                                                                                                rel="noopener"
                                                                                                                                class="flex shrink-0 items-center justify-center rounded-full border border-[#1f1b2c]/40 bg-white/70 p-1 text-[#1f1b2c] transition-colors hover:bg-[#1f1b2c] hover:text-white"
                                                                                                                        >
                                                                                                                                <vue-feather type="map-pin" class="h-3.5 w-3.5" />
                                                                                                                                <span class="sr-only">Open map for {{ location.name }}</span>
                                                                                                                        </a>
                                                                                                                </div>
                                                                                                                <p
                                                                                                                        v-if="location.details"
                                                                                                                        class="font-sans text-xs text-[#1f1b2c]/70"
                                                                                                                >
                                                                                                                        {{ location.details }}
                                                                                                                </p>
                                                                                                        </div>
                                                                                                </li>
                                                                                        </ul>
                                                                                </div>
                                                                        </div>
                                                                </div>
                                                                <div class="rounded-2xl border-2 border-dashed border-[#1f1b2c]/40 bg-[#ff8ba7]/20 px-3 py-2.5 sm:px-4 sm:py-3">
                                                                        <p class="font-sans text-xs uppercase tracking-[0.3em] text-[#f15a24]">
                                                                                Type
                                                                        </p>
                                                                        <div class="mt-2 flex flex-wrap gap-2">
                                                                                <span
                                                                                        v-for="(category, index) in event.category"
                                                                                        :key="index"
                                                                                        class="rounded-full border-2 border-[#1f1b2c] bg-white/80 px-3 py-1 font-sans text-xs uppercase tracking-[0.2em] text-[#1f1b2c]"
                                                                                >
                                                                                        {{ category }}
                                                                                </span>
                                                                        </div>
                                                                </div>
                                                        </div>
                                                </div>
                                                <div class="lg:flex-none lg:w-80">
                                                        <a
                                                                :href="event.link"
                                                                target="_blank"
                                                                class="block overflow-hidden rounded-[24px] border-4 border-black bg-white shadow-[8px_8px_0_#1f1b2c] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[12px_12px_0_#f15a24]"
                                                        >
                                                                <img
                                                                        :src="event.thumbnail"
                                                                        :alt="event.title"
                                                                        class="aspect-video w-full object-cover"
                                                                        loading="lazy"
                                                                />
                                                        </a>
                                                </div>
                                        </div>
                                        </div>
                                </li>
                        </ul>
				<NavigationPill
					v-if="shouldShowNavigator"
					:bounce-state="bounceState"
					:pressed-direction="pressedDirection"
					:hold-effect-direction="holdEffectDirection"
					:current-display-index="currentDisplayIndex"
					:total-events="totalEvents"
					@navigator-click="handleNavigatorClick"
					@press-start="handlePressStart"
					@press-end="handlePressEnd"
					@press-cancel="handlePressCancel"
				/>
                <p
                        class="text-center font-sans text-xs sm:text-sm uppercase tracking-[0.3em] text-[#1f1b2c]/70"
                        v-show="filteredEvents.length > 0"
                >
                        Events sourced on {{ new Date(events.generationTime).toLocaleString() }}.
                </p>
        </div>
        </main>
</template>
