<script setup>
import { defineProps, computed } from "vue";
import { useEventsStore } from "@/stores/events.js";
import VueFeather from "vue-feather";

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
</script>

<template>
        <main class="flex flex-col gap-8 px-0">
		<div
			class="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-[32px] border-4 border-dashed border-[#1f1b2c]/40 bg-white/80 px-3 py-7 text-center shadow-[8px_8px_0_#1f1b2c] backdrop-blur sm:px-6 sm:py-12"
			v-show="events.fetchEventsStatus !== 'success'"
		>
			<p
				class="font-sans text-base sm:text-lg"
                                v-show="
                                        events.fetchEventsStatus === 'idle' ||
                                        events.fetchEventsStatus === 'fetching'
                                "
                        >
                                Revving the time machine… fetching the latest happenings.
                        </p>
                        <p class="font-sans text-base sm:text-lg" v-show="events.fetchEventsStatus === 'error'">
                                There was an error loading this page. Please try again later!
                        </p>
		</div>
		<div v-show="events.fetchEventsStatus === 'success'" class="flex flex-col gap-8 pb-6">
			<div v-if="filteredEvents.length > 0" class="mx-auto max-w-4xl text-center">
				<p class="font-sans text-sm uppercase tracking-[0.4em] text-[#1f1b2c]/70">
					Information may be imperfect—double check before you head out!
				</p>
			</div>
			<div
				v-show="filteredEvents.length === 0"
				class="mx-auto w-full max-w-6xl rounded-[32px] border-4 border-black bg-white/80 px-4 py-8 text-center font-sans text-base shadow-[8px_8px_0_#1f1b2c] backdrop-blur sm:px-8 sm:py-12 sm:text-lg sm:shadow-[16px_16px_0_#1f1b2c]"
			>
                                <p>Oh no! 😞 We couldn't find any events for this category and time range.</p>
                                <p class="mt-4 text-xs uppercase tracking-[0.3em] text-[#f15a24] sm:text-sm">
                                        Try adjusting your filters for more results!
                                </p>
                        </div>
			<ul class="flex flex-col gap-8" v-show="filteredEvents.length > 0">
                                <li
                                        v-for="(event, index) in filteredEvents"
                                        :key="index"
                                        class="transition-transform duration-200"
                                >
				<div class="group relative overflow-hidden rounded-[32px] border-4 border-black bg-white/85 px-4 py-5 shadow-[8px_8px_0_#1f1b2c] backdrop-blur transition-all duration-200 hover:-translate-y-1 hover:shadow-[16px_16px_0_#f15a24] sm:px-8 sm:py-8">
                                                <div
                                                        class="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-[#ffe066] via-[#ff8ba7] to-[#8ec5ff] opacity-40 blur-3xl transition-opacity group-hover:opacity-60"
                                                ></div>
                                                <div class="relative z-10 flex flex-col-reverse gap-6 lg:flex-row lg:items-start lg:gap-10">
                                                <div class="flex flex-1 flex-col gap-5">
                                                        <div class="flex flex-wrap items-center gap-3">
                                                                <a
                                                                        :href="event.link"
                                                                        target="_blank"
                                                                        class="group/link inline-flex items-center gap-2 text-2xl font-bold text-[#1f1b2c] underline-offset-8 transition-colors hover:text-[#f15a24] hover:underline sm:text-3xl"
                                                                >
                                                                        {{ event.title }}
                                                                        <vue-feather
                                                                                type="arrow-up-right"
                                                                                class="h-5 w-5 text-[#f15a24] transition-transform group-hover/link:translate-x-1 group-hover/link:-translate-y-1"
                                                                        />
                                                                </a>
                                                                <VMenu class="hidden sm:inline-block">
                                                                        <vue-feather type="info" class="h-5 text-[#1f1b2c]" />
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
                                                        <p class="font-sans text-base leading-relaxed text-[#1f1b2c] sm:text-lg">
                                                                {{ event.description }}
                                                        </p>
					<div class="grid gap-3 sm:grid-cols-3 sm:gap-6">
                                                                <div class="rounded-2xl border-2 border-dashed border-[#1f1b2c]/40 bg-[#ffe066]/30 px-4 py-3">
                                                                        <p class="font-sans text-xs uppercase tracking-[0.3em] text-[#f15a24]">
                                                                                Date
                                                                        </p>
                                                                        <p class="mt-2 font-serif text-lg text-[#1f1b2c]">
                                                                                {{ event.datetime }}
                                                                        </p>
                                                                </div>
                                                                <div class="rounded-2xl border-2 border-dashed border-[#1f1b2c]/40 bg-[#8ec5ff]/20 px-4 py-3">
                                                                        <p class="font-sans text-xs uppercase tracking-[0.3em] text-[#f15a24]">
                                                                                Location
                                                                        </p>
                                                                        <p class="mt-2 font-serif text-lg text-[#1f1b2c]">
                                                                                {{ event.location }}
                                                                        </p>
                                                                </div>
                                                                <div class="rounded-2xl border-2 border-dashed border-[#1f1b2c]/40 bg-[#ff8ba7]/20 px-4 py-3">
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
                                                <div class="lg:max-w-xs lg:flex-none">
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
                <p
                        class="text-center font-sans text-sm uppercase tracking-[0.3em] text-[#1f1b2c]/70"
                        v-show="filteredEvents.length > 0"
                >
                        Events sourced on {{ new Date(events.generationTime).toLocaleString() }}.
                </p>
        </div>
        </main>
</template>
