<script setup>
import {
        computed,
        nextTick,
        onBeforeUnmount,
        onMounted,
        ref,
        useAttrs,
        watch,
} from "vue";

const props = defineProps({
        width: {
                type: [Number, String],
                default: 200,
        },
        height: {
                type: [Number, String],
                default: 80,
        },
        borderRadius: {
                type: Number,
                default: 20,
        },
        borderWidth: {
                type: Number,
                default: 0.07,
        },
        brightness: {
                type: Number,
                default: 50,
        },
        opacity: {
                type: Number,
                default: 0.93,
        },
        blur: {
                type: Number,
                default: 11,
        },
        displace: {
                type: Number,
                default: 0,
        },
        backgroundOpacity: {
                type: Number,
                default: 0,
        },
        saturation: {
                type: Number,
                default: 1,
        },
        distortionScale: {
                type: Number,
                default: -180,
        },
        redOffset: {
                type: Number,
                default: 0,
        },
        greenOffset: {
                type: Number,
                default: 10,
        },
        blueOffset: {
                type: Number,
                default: 20,
        },
        xChannel: {
                type: String,
                default: "R",
        },
        yChannel: {
                type: String,
                default: "G",
        },
        mixBlendMode: {
                type: String,
                default: "difference",
        },
        contentClass: {
                type: [String, Array, Object],
                default: "",
        },
});

defineOptions({
        inheritAttrs: false,
});

let glassSurfaceId = 0;

const containerRef = ref(null);
const feImageRef = ref(null);
const redChannelRef = ref(null);
const greenChannelRef = ref(null);
const blueChannelRef = ref(null);
const gaussianBlurRef = ref(null);
const supportsSvgFilters = ref(true);
const resizeObserver = ref(null);
let animationFrameId = null;

const instanceId = ++glassSurfaceId;
const filterId = `glass-surface-filter-${instanceId}`;
const redGradId = `glass-surface-red-grad-${instanceId}`;
const blueGradId = `glass-surface-blue-grad-${instanceId}`;

const attrs = useAttrs();

const rootAttrs = computed(() => {
        const { class: _class = "", style: _style = "", ...rest } = attrs;
        return rest;
});

const containerClasses = computed(() => [
        "glass-surface",
        supportsSvgFilters.value
                ? "glass-surface--svg"
                : "glass-surface--fallback",
        attrs.class,
]);

const normalizeDimension = (value, fallbackPx) => {
        if (typeof value === "number") {
                return `${value}px`;
        }
        return value || `${fallbackPx}px`;
};

const containerStyle = computed(() => ({
        width: normalizeDimension(props.width, 200),
        height: normalizeDimension(props.height, 80),
        borderRadius: `${props.borderRadius}px`,
        "--glass-frost": props.backgroundOpacity,
        "--glass-saturation": props.saturation,
        "--filter-id": `url(#${filterId})`,
}));

const generateDisplacementMap = () => {
        const rect = containerRef.value?.getBoundingClientRect();
        const actualWidth =
                rect?.width ||
                (typeof props.width === "number" ? props.width : 400);
        const actualHeight =
                rect?.height ||
                (typeof props.height === "number" ? props.height : 200);
        const edgeSize =
                Math.min(actualWidth, actualHeight) * (props.borderWidth * 0.5);

        const svgContent = `
<svg viewBox="0 0 ${actualWidth} ${actualHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${redGradId}" x1="100%" y1="0%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#0000"/>
      <stop offset="100%" stop-color="red"/>
    </linearGradient>
    <linearGradient id="${blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0000"/>
      <stop offset="100%" stop-color="blue"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" fill="black" />
  <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${props.borderRadius}" fill="url(#${redGradId})" />
  <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${props.borderRadius}" fill="url(#${blueGradId})" style="mix-blend-mode: ${props.mixBlendMode}" />
  <rect x="${edgeSize}" y="${edgeSize}" width="${actualWidth - edgeSize * 2}" height="${actualHeight - edgeSize * 2}" rx="${props.borderRadius}" fill="hsl(0 0% ${props.brightness}% / ${props.opacity})" style="filter:blur(${props.blur}px)" />
</svg>`;

        return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
};

const setImageHref = (url) => {
        if (!feImageRef.value) {
                return;
        }
        feImageRef.value.setAttribute("href", url);
        feImageRef.value.setAttributeNS(
                "http://www.w3.org/1999/xlink",
                "href",
                url,
        );
};

const updateDisplacementMap = () => {
        const mapDataUrl = generateDisplacementMap();
        setImageHref(mapDataUrl);
};

const scheduleDisplacementUpdate = () => {
        if (typeof window === "undefined") {
                return;
        }
        if (animationFrameId !== null) {
                window.cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
        }
        nextTick(() => {
                animationFrameId = window.requestAnimationFrame(() => {
                        updateDisplacementMap();
                        animationFrameId = null;
                });
        });
};

const updateChannelAttributes = () => {
        const channelConfigs = [
                { element: redChannelRef.value, offset: props.redOffset },
                { element: greenChannelRef.value, offset: props.greenOffset },
                { element: blueChannelRef.value, offset: props.blueOffset },
        ];

        channelConfigs.forEach(({ element, offset }) => {
                if (!element) {
                        return;
                }
                element.setAttribute(
                        "scale",
                        String(props.distortionScale + offset),
                );
                element.setAttribute("xChannelSelector", props.xChannel);
                element.setAttribute("yChannelSelector", props.yChannel);
        });
};

const updateBlur = () => {
        if (!gaussianBlurRef.value) {
                return;
        }
        gaussianBlurRef.value.setAttribute(
                "stdDeviation",
                String(props.displace),
        );
};

const detectSvgFilterSupport = () => {
        if (typeof window === "undefined" || typeof navigator === "undefined") {
                supportsSvgFilters.value = false;
                return;
        }

        const userAgent = navigator.userAgent;
        const isWebkit = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
        const isFirefox = /Firefox/.test(userAgent);

        if (isWebkit || isFirefox) {
                supportsSvgFilters.value = false;
                return;
        }

        const testDiv = document.createElement("div");
        testDiv.style.backdropFilter = `url(#${filterId})`;
        supportsSvgFilters.value = testDiv.style.backdropFilter !== "";
};

onMounted(() => {
        detectSvgFilterSupport();
        scheduleDisplacementUpdate();
        updateChannelAttributes();
        updateBlur();

        if (
                typeof window !== "undefined" &&
                "ResizeObserver" in window &&
                containerRef.value
        ) {
                resizeObserver.value = new ResizeObserver(() => {
                        scheduleDisplacementUpdate();
                });
                resizeObserver.value.observe(containerRef.value);
        }
});

onBeforeUnmount(() => {
        if (animationFrameId !== null && typeof window !== "undefined") {
                        window.cancelAnimationFrame(animationFrameId);
                        animationFrameId = null;
        }
        if (resizeObserver.value) {
                resizeObserver.value.disconnect();
                resizeObserver.value = null;
        }
});

watch(
        () => [
                props.width,
                props.height,
                props.borderRadius,
                props.borderWidth,
                props.brightness,
                props.opacity,
                props.blur,
                props.mixBlendMode,
        ],
        () => {
                scheduleDisplacementUpdate();
        },
);

watch(
        () => [
                props.distortionScale,
                props.redOffset,
                props.greenOffset,
                props.blueOffset,
                props.xChannel,
                props.yChannel,
        ],
        () => {
                updateChannelAttributes();
        },
);

watch(
        () => props.displace,
        () => {
                updateBlur();
        },
);
</script>

<template>
        <div
                ref="containerRef"
                v-bind="rootAttrs"
                :class="containerClasses"
                :style="[containerStyle, attrs.style]"
        >
                <svg
                        class="glass-surface__filter"
                        xmlns="http://www.w3.org/2000/svg"
                >
                        <defs>
                                <filter
                                        :id="filterId"
                                        color-interpolation-filters="sRGB"
                                        x="0%"
                                        y="0%"
                                        width="100%"
                                        height="100%"
                                >
                                        <feImage
                                                ref="feImageRef"
                                                x="0"
                                                y="0"
                                                width="100%"
                                                height="100%"
                                                preserveAspectRatio="none"
                                                result="map"
                                        />

                                        <feDisplacementMap
                                                ref="redChannelRef"
                                                in="SourceGraphic"
                                                in2="map"
                                                result="dispRed"
                                        />
                                        <feColorMatrix
                                                in="dispRed"
                                                type="matrix"
                                                values="1 0 0 0 0
                                                        0 0 0 0 0
                                                        0 0 0 0 0
                                                        0 0 0 1 0"
                                                result="red"
                                        />

                                        <feDisplacementMap
                                                ref="greenChannelRef"
                                                in="SourceGraphic"
                                                in2="map"
                                                result="dispGreen"
                                        />
                                        <feColorMatrix
                                                in="dispGreen"
                                                type="matrix"
                                                values="0 0 0 0 0
                                                        0 1 0 0 0
                                                        0 0 0 0 0
                                                        0 0 0 1 0"
                                                result="green"
                                        />

                                        <feDisplacementMap
                                                ref="blueChannelRef"
                                                in="SourceGraphic"
                                                in2="map"
                                                result="dispBlue"
                                        />
                                        <feColorMatrix
                                                in="dispBlue"
                                                type="matrix"
                                                values="0 0 0 0 0
                                                        0 0 0 0 0
                                                        0 0 1 0 0
                                                        0 0 0 1 0"
                                                result="blue"
                                        />

                                        <feBlend in="red" in2="green" mode="screen" result="rg" />
                                        <feBlend in="rg" in2="blue" mode="screen" result="output" />
                                        <feGaussianBlur
                                                ref="gaussianBlurRef"
                                                in="output"
                                                stdDeviation="0.7"
                                        />
                                </filter>
                        </defs>
                </svg>

                <div
                        class="glass-surface__content"
                        :class="props.contentClass"
                >
                        <slot />
                </div>
        </div>
</template>

<style scoped>
.glass-surface {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        transition: opacity 0.26s ease-out;
}

.glass-surface__filter {
        width: 100%;
        height: 100%;
        pointer-events: none;
        position: absolute;
        inset: 0;
        opacity: 0;
        z-index: -1;
}

.glass-surface__content {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem;
        border-radius: inherit;
        position: relative;
        z-index: 1;
}

.glass-surface--svg {
        background: light-dark(
                hsl(0 0% 100% / var(--glass-frost, 0)),
                hsl(0 0% 0% / var(--glass-frost, 0))
        );
        backdrop-filter: var(--filter-id, url(#glass-filter))
                saturate(var(--glass-saturation, 1));
        box-shadow:
                0 0 2px 1px
                        light-dark(
                                color-mix(in oklch, black, transparent 85%),
                                color-mix(in oklch, white, transparent 65%)
                        )
                        inset,
                0 0 10px 4px
                        light-dark(
                                color-mix(in oklch, black, transparent 90%),
                                color-mix(in oklch, white, transparent 85%)
                        )
                        inset,
                0px 4px 16px rgba(17, 17, 26, 0.05),
                0px 8px 24px rgba(17, 17, 26, 0.05),
                0px 16px 56px rgba(17, 17, 26, 0.05),
                0px 4px 16px rgba(17, 17, 26, 0.05) inset,
                0px 8px 24px rgba(17, 17, 26, 0.05) inset,
                0px 16px 56px rgba(17, 17, 26, 0.05) inset;
}

.glass-surface--fallback {
        background: rgba(255, 255, 255, 0.25);
        backdrop-filter: blur(12px) saturate(1.8) brightness(1.1);
        -webkit-backdrop-filter: blur(12px) saturate(1.8) brightness(1.1);
        border: 1px solid rgba(255, 255, 255, 0.3);
        box-shadow:
                0 8px 32px 0 rgba(31, 38, 135, 0.2),
                0 2px 16px 0 rgba(31, 38, 135, 0.1),
                inset 0 1px 0 0 rgba(255, 255, 255, 0.4),
                inset 0 -1px 0 0 rgba(255, 255, 255, 0.2);
}

@media (prefers-color-scheme: dark) {
        .glass-surface--fallback {
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(12px) saturate(1.8) brightness(1.2);
                -webkit-backdrop-filter: blur(12px) saturate(1.8) brightness(1.2);
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow:
                        inset 0 1px 0 0 rgba(255, 255, 255, 0.2),
                        inset 0 -1px 0 0 rgba(255, 255, 255, 0.1);
        }
}

@supports not (backdrop-filter: blur(10px)) {
        .glass-surface--fallback {
                background: rgba(255, 255, 255, 0.4);
                box-shadow:
                        inset 0 1px 0 0 rgba(255, 255, 255, 0.5),
                        inset 0 -1px 0 0 rgba(255, 255, 255, 0.3);
        }

        .glass-surface--fallback::before {
                content: "";
                position: absolute;
                inset: 0;
                background: rgba(255, 255, 255, 0.15);
                border-radius: inherit;
                z-index: -1;
        }
}

@supports not (backdrop-filter: blur(10px)) {
        @media (prefers-color-scheme: dark) {
                .glass-surface--fallback {
                        background: rgba(0, 0, 0, 0.4);
                }

                .glass-surface--fallback::before {
                        background: rgba(255, 255, 255, 0.05);
                }
        }
}

.glass-surface:focus-visible {
        outline: 2px solid light-dark(#007aff, #0a84ff);
        outline-offset: 2px;
}
</style>
