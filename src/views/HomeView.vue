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
import VueFeather from "vue-feather";
import CurvedLoop from "@/components/CurvedLoop.vue";

const events = useEventsStore();
const props = defineProps({
        activeTimeRange: String,
        activeCategory: String,
});

const filteredEvents = computed(() => {
        if (!props.activeTimeRange || !props.activeCategory) {
                return [];
        }
        return events.getItemsInDateRangeAndCategory(
                props.activeTimeRange,
                props.activeCategory
        );
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

        const fallbackIndex = visibleEventIndexes.value.length
                ? visibleEventIndexes.value[0]
                : 0;
        const currentIndex =
                activeEventIndex.value ?? Math.min(fallbackIndex, totalEvents.value - 1);

        if (direction === "up") {
                if (currentIndex <= 0) {
                        activeEventIndex.value = 0;
                        scrollToPageBoundary("up");
                        return;
                }
                scrollToEvent(currentIndex - 1);
                return;
        }

        if (currentIndex >= totalEvents.value - 1) {
                activeEventIndex.value = totalEvents.value - 1;
                scrollToPageBoundary("down");
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
                if (direction === "up") {
                        activeEventIndex.value = 0;
                        scrollToPageBoundary("up");
                } else {
                        activeEventIndex.value = totalEvents.value
                                ? totalEvents.value - 1
                                : 0;
                        scrollToPageBoundary("down");
                }
        }, holdDelayMs);
};

const stopHold = () => {
        if (holdTimeoutId) {
                clearTimeout(holdTimeoutId);
                holdTimeoutId = null;
        }
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
                                <!-- hack: due to using scale-125, we will begin wiht "zz" and end with "bu" (rather than end with "buzz")-->
				<CurvedLoop
					marquee-text="p ✦ Buzz ✦ Scoo"
					text-class="font-sans uppercase tracking-[0.35em]"
					:speed="3.5"
					:curve-amount="400"
					:interactive="true"
				/>
			</div>
			<p class="font-sans text-sm sm:text-lg" v-show="events.fetchEventsStatus === 'error'">
				There was an error loading this page. Please try again later!
			</p>
		</div>
		<div
			v-show="events.fetchEventsStatus === 'success'"
			class="flex flex-col gap-6 pb-6 lg:gap-8"
		>
			<div v-if="filteredEvents.length > 0" class="mx-auto max-w-4xl text-center">
				<p class="font-sans text-xs sm:text-sm uppercase tracking-[0.4em] text-[#1f1b2c]/70">
					Information may be imperfect - double check before you head out!
				</p>
			</div>
			<div
				v-show="filteredEvents.length === 0"
				class="mx-auto w-full max-w-6xl rounded-[32px] border-4 border-black bg-white/80 px-4 py-8 text-center font-sans text-sm shadow-[8px_8px_0_#1f1b2c] backdrop-blur sm:px-8 sm:py-12 sm:text-lg sm:shadow-[16px_16px_0_#1f1b2c]"
			>
                                <p>Oh no! 😞 We couldn't find any events for this category and time range.</p>
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
					class="group relative bg-white/80 overflow-hidden rounded-[32px] border-4 border-black bg-white/85 px-4 py-5 shadow-[8px_8px_0_#1f1b2c] backdrop-blur transition-all duration-200 sm:px-8 sm:py-8 md:hover:-translate-y-1 md:hover:shadow-[16px_16px_0_#f15a24]"
					:class="{ 'mobile-active-card': isMobile && activeEventIndex === index }"
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
                                                                        <VMenu class="hidden sm:inline-flex">
                                                                                <button
                                                                                        type="button"
                                                                                        class="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#1f1b2c] bg-white text-[#1f1b2c] shadow-[4px_4px_0_#1f1b2c] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#f15a24]"
                                                                                >
                                                                                        <vue-feather type="info" class="h-5 w-5" />
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
                                                                        <p class="mt-2 font-serif text-base text-[#1f1b2c] sm:text-lg">
                                                                                {{ event.location }}
                                                                        </p>
                                                                </div>
                                                                <div class="rounded-2xl border-2 border-dashed border-[#1f1b2c]/40 bg-[#ff8ba7]/20 px-3 py-2.5 sm:px-4 sm:py-3">
                                                                        <p class="font-sans text-xs uppercase tracking-[0.3em] text-[#f15a24]">
                                                                                Type
                                                                        </p>
                                                                        <div class="mt-2 flex flex-wrap gap-2">
                                                                                <span
                                                                                        v-for="(category, index) in event.category"
                                                                                        :key="index"
                                                                                        class="rounded-full border-2 border-[#1f1b2c] bg-white px-3 py-1 font-sans text-xs uppercase tracking-[0.2em] text-[#1f1b2c] shadow-[3px_3px_0_#1f1b2c]"
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
				<div
					v-if="shouldShowNavigator"
					class="nav-pill sm:hidden fixed select-none bottom-1.5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-[#1f1b2c]/80 px-3 py-1.5 text-white backdrop-blur-lg"
					:style="{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.25rem)' }"
				>
					<button
						type="button"
						class="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/90 text-[#1f1b2c] transition-transform active:translate-y-0.5 active:scale-95"
						@click="handleNavigatorClick('up')"
						@mousedown.prevent="startHold('up')"
						@touchstart="startHold('up')"
						@mouseup.prevent="stopHold"
						@mouseleave="stopHold"
						@touchend="stopHold"
						@touchcancel="stopHold"
						aria-label="Scroll to previous event"
					>
						<vue-feather type="chevron-up" class="h-5 w-5" />
					</button>
					<span class="font-sans text-[10px] uppercase tracking-[0.45em] text-white">
						{{ currentDisplayIndex }} / {{ totalEvents }}
					</span>
					<button
						type="button"
						class="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/90 text-[#1f1b2c] transition-transform active:translate-y-0.5 active:scale-95"
						@click="handleNavigatorClick('down')"
						@mousedown.prevent="startHold('down')"
						@touchstart="startHold('down')"
						@mouseup.prevent="stopHold"
						@mouseleave="stopHold"
						@touchend="stopHold"
						@touchcancel="stopHold"
						aria-label="Scroll to next event"
					>
						<vue-feather type="chevron-down" class="h-5 w-5" />
					</button>
				</div>
                <p
                        class="text-center font-sans text-xs sm:text-sm uppercase tracking-[0.3em] text-[#1f1b2c]/70"
                        v-show="filteredEvents.length > 0"
                >
                        Events sourced on {{ new Date(events.generationTime).toLocaleString() }}.
                </p>
        </div>
        </main>
</template>

<style scoped>
.mobile-active-card {
        transform: translateY(-4px);
        box-shadow: 16px 16px 0 #f15a24;
}

.nav-pill {
        transition: transform 0.2s ease, box-shadow 0.2s ease;
}
</style>
