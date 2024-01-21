<script setup>
import { ref, defineProps, defineEmits, onMounted, onUnmounted } from "vue";
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

const handleClickOutside = (event) => {
	if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
		isDropdownOpen.value = false;
	}
};

onMounted(() => {
	document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
	document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
	<VMenu class="relative w-fit h-full z-20" ref="dropdownRef">
		<button @click="toggleDropdown" class="flex items-center">
			<span class="max-w-[200px] sm:max-w-fit truncate">
				{{
					Array.isArray(props.options)
						? props.selectedValue
						: props.selectedValue // not array, is object. now check if truthy
						? props.options[props.selectedValue]
						: "Dropdown"
				}}</span
			>
			<vue-feather type="chevron-down" size="32" class="icon w-6 h-6 ml-2" />
		</button>

		<template #popper>
			<a
				v-for="(value, index) in props.options"
				:key="index"
				href="#"
				class="block px-4 py-2 hover:bg-gray-100"
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
	</VMenu>
</template>
