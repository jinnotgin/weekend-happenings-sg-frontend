<script setup>
import { ref, defineProps, defineEmits } from "vue";
import VueFeather from "vue-feather";

const props = defineProps({
	options: [Array, Object], // Options can be either an array or an object
	selectedValue: [String, Number], // Selected value can be either a string or a number
});

const emits = defineEmits(["update:selectedValue"]);

const dropdownRef = ref(null);
const isDropdownOpen = ref(false);

const toggleDropdown = () => {
	isDropdownOpen.value = !isDropdownOpen.value;
};

const selectOption = (value) => {
	emits("update:selectedValue", value);
	toggleDropdown();
};

// const handleClickOutside = (event) => {
// 	if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
// 		isDropdownOpen.value = false;
// 	}
// };

// onMounted(() => {
// 	document.addEventListener("click", handleClickOutside);
// });

// onUnmounted(() => {
// 	document.removeEventListener("click", handleClickOutside);
// });
</script>

<template>
        <VDropdown
                class="relative z-20 h-full w-fit"
                ref="dropdownRef"
                :popperHideTriggers="(triggers) => [...triggers, 'click']"
        >
		<button
			@click="toggleDropdown"
			class="flex items-center gap-2 rounded-full border-2 border-black bg-[#fff4d6] px-3 py-1 font-sans text-xs uppercase tracking-[0.2em] text-[#1f1b2c] shadow-[4px_4px_0_#1f1b2c] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#ff8ba7] hover:shadow-[6px_6px_0_#f15a24] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#8ec5ff]/60 sm:px-4 sm:py-1.5 sm:text-sm sm:tracking-[0.3em]"
		>
			<span class="max-w-[180px] truncate text-left text-sm sm:max-w-[260px] sm:text-base">
				{{
					Array.isArray(props.options)
						? props.selectedValue
						: props.selectedValue // not array, is object. now check if truthy
						? props.options[props.selectedValue]
						: "Dropdown"
				}}</span
			>
			<vue-feather type="chevron-down" size="28" class="ml-1 h-4 w-4 sm:h-5 sm:w-5" />
		</button>

                <template #popper>
                        <a
                                v-for="(value, index) in props.options"
                                :key="index"
                                href="#"
                                class="block border-b border-black/10 bg-white px-4 py-2 font-sans text-sm uppercase tracking-[0.2em] text-[#1f1b2c] transition-colors last:border-b-0 hover:bg-[#ffe066]/60"
                                :class="{
                                        'font-bold':
                                                props.selectedValue ===
                                                (Array.isArray(props.options) ? value : index),
                                }"
				@click.prevent="
					selectOption(Array.isArray(props.options) ? value : index)
				"
			>
				{{ Array.isArray(props.options) ? value : props.options[index] }}
			</a>
		</template>
	</VDropdown>
</template>
