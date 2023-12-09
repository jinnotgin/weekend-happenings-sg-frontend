<script setup>
import { ref, defineProps, defineEmits, onMounted, onUnmounted } from "vue";
import VueFeather from "vue-feather";

const props = defineProps({
	options: Object, // Object of options. key is name, value is display name
	selectedValue: String, // Currently selected value
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
	<div class="relative" ref="dropdownRef">
		<button @click="toggleDropdown" class="flex items-center">
			{{
				props.selectedValue ? props.options[props.selectedValue] : "Dropdown"
			}}

			<vue-feather type="chevron-down" size="32" class="icon w-6 h-6 ml-2" />
		</button>
		<div
			v-if="isDropdownOpen"
			class="absolute z-10 mt-2 bg-white border rounded shadow w-max"
		>
			<a
				v-for="(display, name) in props.options"
				:key="name"
				href="#"
				class="block px-4 py-2 hover:bg-gray-100"
				:class="{ 'font-bold': props.selectedValue === name }"
				@click.prevent="selectOption(name)"
			>
				{{ display }}
			</a>
		</div>
	</div>
</template>
