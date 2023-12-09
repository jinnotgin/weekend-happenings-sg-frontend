<script setup>
import { defineProps } from "vue";
import { useEventsStore } from "@/stores/events.js";
import VueFeather from "vue-feather";
import HoverTooltip from "@/components/HoverTooltip.vue";

const events = useEventsStore();
const props = defineProps({
	activeTimeRange: String,
});

events.fetchEvents();
</script>

<template>
	<main class="">
		<p class="text-center italic pb-6">
			The events below are sourced using Generative AI. Information may be
			inaccurate.
		</p>
		<hr class="h-px bg-gray-300 border-0" />
		<ul class="flex flex-col">
			<li
				v-for="(event, index) in events.getItemsInDateRange(activeTimeRange)"
				:key="index"
				class="transition-all ease-in-out hover:-translate-y-1 hover:scale-105 hover:bg-red-100"
			>
				<div
					class="max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto py-10 flex flex-row gap-20"
				>
					<div class="basis-3/4">
						<div
							class="flex gap-3 items-center hover:underline underline-offset-8 decoration-1 decoration-orange-700"
						>
							<a
								:href="event.link"
								target="_blank"
								class="text-3xl font-bold text-orange-700"
							>
								{{ event.title }}
							</a>
							<HoverTooltip>
								<vue-feather type="info" class="h-5 text-orange-700" />
								<template v-slot:tooltip-content>
									<p class="text-xs">1. Link</p>
									<p class="text-xs">2. Link</p>
								</template>
							</HoverTooltip>
						</div>
						<p class="mt-1 text-xl">
							{{ event.description }}
						</p>
						<div class="mt-6 grid grid-cols-3">
							<div>
								<p class="flex flex-col">
									<span class="font-bold text-orange-700">Date</span>
									<span>{{ event.datetime }}</span>
								</p>
							</div>
							<div class="text-center">
								<p class="flex flex-col">
									<span class="font-bold text-orange-700">Location</span>
									<span>{{ event.location }}</span>
								</p>
							</div>
							<div class="text-right">
								<div class="flex flex-col">
									<span class="font-bold text-orange-700">Event Type</span>
									<ul>
										<li
											v-for="(category, index) in event.category"
											:key="index"
										>
											{{ category }}
										</li>
									</ul>
								</div>
							</div>
						</div>
					</div>
					<div class="basis-1/4">
						<a :href="event.link" target="_blank">
							<img
								:src="event.thumbnail"
								:alt="event.title"
								class="aspect-video object-cover shadow-lg hover:shadow-2xl transition duration-100"
								loading="lazy"
							/>
						</a>
					</div>
				</div>
				<hr class="h-px bg-gray-300 border-0" />
			</li>
		</ul>
		<p class="text-center italic py-6">
			The information above was sourced on
			{{ new Date(events.generationTime).toLocaleString() }}
		</p>
	</main>
</template>
