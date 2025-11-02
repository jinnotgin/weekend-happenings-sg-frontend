import "./assets/index.css";

import { createApp } from "vue";
import { createPinia } from "pinia";

import App from "./App.vue";
import router from "./router";

import FloatingVue from "floating-vue";
import "floating-vue/dist/style.css";
import { initSafariUiDetector } from "./utils/safariUiDetector";

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(FloatingVue);
FloatingVue.options.themes.tooltip.delay.hide = 200;

app.mount("#app");

if (typeof window !== "undefined") {
	initSafariUiDetector();
}
