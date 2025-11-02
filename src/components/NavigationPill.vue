<script setup>
import { computed } from "vue";
import GlassSurface from "@/components/GlassSurface.vue";
import VueFeather from "vue-feather";

const props = defineProps({
        bounceState: {
                type: String,
                default: null,
        },
        pressedDirection: {
                type: String,
                default: null,
        },
        holdEffectDirection: {
                type: String,
                default: null,
        },
        currentDisplayIndex: {
                type: Number,
                required: true,
        },
        totalEvents: {
                type: Number,
                required: true,
        },
});

const emit = defineEmits([
        "navigator-click",
        "press-start",
        "press-end",
        "press-cancel",
]);

const safeAreaStyle = computed(() => ({
        paddingBottom: "calc(env(safe-area-inset-bottom) + 0.25rem)",
}));

const COUNT_TRACKING_EM = 0.35; // Matches letter-spacing applied to .nav-pill__count
const COUNT_SIDE_PADDING_REM = 0.3; // Adds extra breathing room around the count

const countWidth = computed(() => {
        const digitCount = props.totalEvents?.toString().length ?? 1;
        const characterCount = digitCount * 2 + 3;
        const letterSpacingAllowance = Math.max(characterCount - 1, 0) * COUNT_TRACKING_EM;
        const paddingAllowance = COUNT_SIDE_PADDING_REM * 2;
        return `calc(${characterCount}ch + ${letterSpacingAllowance}em + ${paddingAllowance}rem)`;
});

const handleNavigatorClick = (direction) => {
        emit("navigator-click", direction);
};

const handlePressStart = (direction) => {
        emit("press-start", direction);
};

const handlePressEnd = () => {
        emit("press-end");
};

const handlePressCancel = () => {
        emit("press-cancel");
};
</script>

<template>
        <div
                class="nav-pill lg:hidden fixed bottom-4 left-1/2 z-40 -translate-x-1/2 select-none"
                :class="{
                        'nav-pill--bounce-up': bounceState === 'up',
                        'nav-pill--bounce-down': bounceState === 'down',
                }"
                :style="safeAreaStyle"
        >
                <GlassSurface
                        class="nav-pill__surface text-white shadow-2xl rounded-full"
                        width="auto"
                        height="auto"
                        :border-radius="999"
                        :border-width="0.16"
                        :brightness="62"
                        :opacity="0.85"
                        :blur="18"
                        :displace="1.1"
                        :background-opacity="0.1"
                        :saturation="1.6"
                        :distortion-scale="-120"
                        :red-offset="2"
                        :green-offset="12"
                        :blue-offset="24"
                        x-channel="R"
                        y-channel="G"
                        mix-blend-mode="screen"
                        content-class="nav-pill__content"
                >
                        <div class="nav-pill__body flex items-center gap-2">
                                <button
                                        type="button"
                                        class="nav-pill__button flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-white/90 text-[#1f1b2c]"
                                        :class="{
                                                'is-pressed': pressedDirection === 'up',
                                                'is-hold': holdEffectDirection === 'up',
                                        }"
                                        @click="handleNavigatorClick('up')"
                                        @mousedown.prevent="handlePressStart('up')"
                                        @touchstart="handlePressStart('up')"
                                        @mouseup.prevent="handlePressEnd"
                                        @mouseleave="handlePressCancel"
                                        @touchend="handlePressEnd"
                                        @touchcancel="handlePressCancel"
                                        :aria-pressed="pressedDirection === 'up'"
                                        aria-label="Scroll to previous event"
                                >
                                        <VueFeather type="chevron-up" class="h-4 w-4" />
                                </button>
                                <span
                                        class="nav-pill__count font-sans text-[11px] font-semibold tracking-[0.35em]"
                                        :style="{ width: countWidth }"
                                >
                                        {{ currentDisplayIndex }} / {{ totalEvents }}
                                </span>
                                <button
                                        type="button"
                                        class="nav-pill__button flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-white/90 text-[#1f1b2c]"
                                        :class="{
                                                'is-pressed': pressedDirection === 'down',
                                                'is-hold': holdEffectDirection === 'down',
                                        }"
                                        @click="handleNavigatorClick('down')"
                                        @mousedown.prevent="handlePressStart('down')"
                                        @touchstart="handlePressStart('down')"
                                        @mouseup.prevent="handlePressEnd"
                                        @mouseleave="handlePressCancel"
                                        @touchend="handlePressEnd"
                                        @touchcancel="handlePressCancel"
                                        :aria-pressed="pressedDirection === 'down'"
                                        aria-label="Scroll to next event"
                                >
                                        <VueFeather type="chevron-down" class="h-4 w-4" />
                                </button>
                        </div>
                </GlassSurface>
        </div>
</template>

<style scoped>
.nav-pill {
        transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.nav-pill--bounce-up {
        animation: navBounceUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        animation-fill-mode: both;
}

.nav-pill--bounce-down {
        animation: navBounceDown 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        animation-fill-mode: both;
}

@keyframes navBounceUp {
        0% {
                transform: translate(-50%, 0) scale(1);
        }
        38% {
                transform: translate(-50%, -14px) scale(1.04);
        }
        65% {
        transform: translate(-50%, 6px) scale(0.98);
}
        100% {
                transform: translate(-50%, 0) scale(1);
        }
}

@keyframes navBounceDown {
        0% {
                transform: translate(-50%, 0) scale(1);
        }
        38% {
                transform: translate(-50%, 14px) scale(1.04);
        }
        65% {
                transform: translate(-50%, -6px) scale(0.98);
        }
        100% {
                transform: translate(-50%, 0) scale(1);
        }
}

.nav-pill__button {
        transition:
                transform 0.15s ease,
                box-shadow 0.15s ease,
                background-color 0.15s ease;
        box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
}

.nav-pill__button:focus-visible {
        outline: none;
        box-shadow: 0 0 0 3px rgba(241, 90, 36, 0.5);
}

.nav-pill__button.is-pressed:not(.is-hold) {
        transform: translateY(1px) scale(0.94);
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35);
        background-color: rgba(255, 255, 255, 1);
}

.nav-pill__button.is-hold {
        animation: navHoldPulse 0.7s ease-out;
        box-shadow: 0 0 0 0 rgba(241, 90, 36, 0.45);
        background-color: rgba(255, 255, 255, 1);
}

@keyframes navHoldPulse {
        0% {
                box-shadow: 0 0 0 0 rgba(241, 90, 36, 0.05);
                transform: scale(0.96);
        }
        45% {
                box-shadow: 0 0 0 10px rgba(241, 90, 36, 0.3);
                transform: scale(1.05);
        }
        100% {
                box-shadow: 0 0 0 0 rgba(241, 90, 36, 0);
                transform: scale(1);
        }
}

.nav-pill__count {
        min-width: 3.75rem;
        display: inline-flex;
        justify-content: center;
        align-items: center;
        text-align: center;
        font-variant-numeric: tabular-nums;
        line-height: 1;
        white-space: nowrap;
        padding: 0.24rem 1.1rem;
        border-radius: 999px;
        background:
                linear-gradient(
                        145deg,
                        rgba(255, 255, 255, 0.82) 0%,
                        rgba(255, 255, 255, 0.68) 45%,
                        rgba(255, 255, 255, 0.48) 100%
                );
        color: #1f1b2c;
        letter-spacing: 0.35em;
}

:deep(.nav-pill__content) {
        padding: 0.3rem 0.65rem;
        gap: 0.4rem;
}

:global(html.has-safari-floating-bar) .nav-pill {
        bottom: 0;
}
</style>
