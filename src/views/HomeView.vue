<script setup>
import { defineProps } from "vue";
import { useEventsStore } from "@/stores/events.js";
import VueFeather from "vue-feather";

const events = useEventsStore();
const props = defineProps({
	activeTimeRange: String,
});

events.fetchEvents();
</script>

<template>
	<div
		class="text-center py-12"
		v-show="events.fetchEventsStatus !== 'success'"
	>
		<p
			v-show="
				events.fetchEventsStatus === 'idle' ||
				events.fetchEventsStatus === 'fetching'
			"
		>
			Please wait....
		</p>
		<p v-show="events.fetchEventsStatus === 'error'">
			There was an error loading this page. Please try again later!
		</p>
	</div>
	<main v-show="events.fetchEventsStatus === 'success'">
		<p class="text-center italic pt-6 pb-4 sm:pb-6">
			<span class="inline sm:hidden text-sm"
				>Events sourced using AI, may have inaccuracies.</span
			>
			<span class="hidden sm:inline">
				The events below are sourced using Generative AI. Information may be
				inaccurate.
			</span>
		</p>
		<hr class="h-px bg-gray-300 border-0" />
		<ul class="flex flex-col">
			<li
				v-for="(event, index) in events.getItemsInDateRange(activeTimeRange)"
				:key="index"
				class="transition-all ease-in-out hover:bg-red-100 sm:hover:-translate-y-1 sm:hover:scale-105"
			>
				<div
					class="max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-5 py-4 sm:py-10 flex flex-col-reverse sm:flex-row gap-4 sm:gap-10 xl:gap-20"
				>
					<div class="sm:basis-3/4">
						<div class="flex gap-3 items-center">
							<a
								:href="event.link"
								target="_blank"
								class="flex gap-2 items-center text-xl sm:text-2xl xl:text-3xl font-bold text-orange-700 hover:underline underline-offset-8 decoration-1 decoration-orange-700"
							>
								{{ event.title }}
								<div class="inline sm:hidden h-5">
									<vue-feather
										type="arrow-up-right"
										class="h-5 text-orange-700"
									/>
								</div>
							</a>

							<VMenu class="hidden sm:inline h-5">
								<vue-feather type="info" class="h-5 text-orange-700" />
								<template #popper>
									<div
										class="bg-zinc-700 text-white p-2 text-xs flex flex-col gap-2"
									>
										<p class="font-bold">Sources</p>
										<a
											v-for="({ title, url }, index) in events.getSourcesData(
												event.source
											)"
											:key="index"
											:href="url"
											target="_blank"
											class="hover:underline underline-offset-0"
										>
											{{ index + 1 }}. {{ title }}
										</a>
									</div>
								</template>
							</VMenu>
						</div>
						<p class="text-base sm:text-lg xl:text-xl mt-1">
							{{ event.description }}
						</p>
						<div class="mt-4 sm:mt-6 flex flex-col sm:grid sm:grid-cols-3">
							<div>
								<p class="flex gap-2 sm:flex-col sm:gap-0">
									<span class="hidden sm:inline font-bold text-orange-700"
										>Date</span
									>
									<span class="inline sm:hidden">🗓️</span>
									<span>{{ event.datetime }}</span>
								</p>
							</div>
							<div class="sm:text-center">
								<p class="flex gap-2 sm:flex-col sm:gap-0">
									<span class="hidden sm:inline font-bold text-orange-700"
										>Location</span
									>
									<span class="inline sm:hidden">📍</span>
									<span>{{ event.location }}</span>
								</p>
							</div>
							<div class="sm:text-right">
								<div class="flex gap-2 sm:flex-col sm:gap-0">
									<span class="hidden sm:inline font-bold text-orange-700"
										>Type</span
									>
									<span class="inline sm:hidden">🏷️</span>
									<span class="inline sm:hidden">{{
										event.category.join(", ")
									}}</span>
									<ul class="hidden sm:inline">
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
					<div class="sm:basis-1/4">
						<a :href="event.link" target="_blank" class="hidden sm:inline">
							<img
								:src="event.thumbnail"
								:alt="event.title"
								class="w-full aspect-video object-cover shadow-lg hover:shadow-2xl transition duration-100"
								loading="lazy"
							/>
						</a>
						<div class="inline sm:hidden">
							<img
								:src="event.thumbnail"
								:alt="event.title"
								class="w-full aspect-video object-cover shadow-lg"
								loading="lazy"
							/>
						</div>
					</div>
				</div>
				<hr class="h-px bg-gray-300 border-0" />
			</li>
		</ul>
		<p class="text-center italic py-6">
			Events were sourced on
			{{ new Date(events.generationTime).toLocaleString() }}.
		</p>
	</main>
</template>
