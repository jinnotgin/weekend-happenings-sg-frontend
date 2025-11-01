<template>
  <div
    class="curved-loop-jacket"
    :style="{ visibility: ready ? 'visible' : 'hidden', cursor: cursorStyle }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endDrag"
    @pointerleave="endDrag"
  >
    <svg class="curved-loop-svg" viewBox="0 0 1440 120">
      <text
        ref="measureRef"
        font-weight="bold"
        xml:space="preserve"
        :class="textClass"
        style="visibility: hidden; opacity: 0; pointer-events: none"
      >
        {{ text }}
      </text>
      <defs>
        <path :id="pathId" :d="pathD" fill="none" stroke="transparent" />
      </defs>
      <text v-if="ready" font-weight="bold" xml:space="preserve" :class="textClass">
        <textPath
          ref="textPathRef"
          :href="`#${pathId}`"
          :startOffset="`${offset}px`"
          xml:space="preserve"
        >
          {{ totalText }}
        </textPath>
      </text>
    </svg>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps({
  marqueeText: {
    type: String,
    default: "",
  },
  speed: {
    type: Number,
    default: 2,
  },
  textClass: {
    type: [String, Array, Object],
    default: "",
  },
  curveAmount: {
    type: Number,
    default: 400,
  },
  direction: {
    type: String,
    default: "left",
    validator: (value) => ["left", "right"].includes(value),
  },
  interactive: {
    type: Boolean,
    default: true,
  },
});

let instanceCounter = 0;
const getInstanceId = () => {
  instanceCounter += 1;
  return `curve-${instanceCounter}`;
};

const measureRef = ref(null);
const spacing = ref(0);
const offset = ref(0);
const dragRef = ref(false);
const lastXRef = ref(0);
const dirRef = ref(props.direction);
const velRef = ref(0);
const textPathRef = ref(null);
const pathId = getInstanceId();
const hasWindow = typeof window !== "undefined";

const text = computed(() => {
  const hasTrailing = /\s|\u00A0$/.test(props.marqueeText);
  const trimmed = hasTrailing ? props.marqueeText.replace(/\s+$/, "") : props.marqueeText;
  // return `${trimmed}\u00A0`;  // hack: due to scale-125 in Homeview, we have to also remove the last whitespace
  return `${trimmed}`;
});

const textLength = computed(() => spacing.value);
const totalText = computed(() => {
  if (!textLength.value) {
    return text.value;
  }
  const repeatCount = Math.ceil(1800 / textLength.value) + 2;
  return Array(repeatCount).fill(text.value).join("");
});

const ready = computed(() => spacing.value > 0);
const cursorStyle = computed(() => {
  if (!props.interactive) {
    return "auto";
  }
  return dragRef.value ? "grabbing" : "grab";
});

const pathD = computed(
  () => `M-100,40 Q500,${40 + props.curveAmount} 1540,40`
);

watch(
  () => props.direction,
  (newDirection) => {
    dirRef.value = newDirection;
  }
);

watch(
  [text, () => props.textClass],
  async () => {
    await nextTick();
    if (!measureRef.value) {
      spacing.value = 0;
      return;
    }
    spacing.value = measureRef.value.getComputedTextLength();
  },
  { immediate: true }
);

const applyInitialOffset = () => {
  if (!spacing.value || !textPathRef.value) {
    return;
  }
  const initial = -spacing.value;
  offset.value = initial;
  textPathRef.value.setAttribute("startOffset", `${initial}px`);
};

watch(spacing, applyInitialOffset, { immediate: true });

watch(
  () => textPathRef.value,
  (path) => {
    if (path) {
      applyInitialOffset();
    }
  }
);

watch(
  [ready, () => props.speed],
  ([isReady], _oldValues, onCleanup) => {
    if (!isReady || !spacing.value || !hasWindow) {
      return;
    }

    let frame = 0;
    const step = () => {
      if (!dragRef.value && textPathRef.value) {
        const delta = dirRef.value === "right" ? props.speed : -props.speed;
        const wrapPoint = spacing.value;
        let newOffset = offset.value + delta;

        if (newOffset <= -wrapPoint) {
          newOffset += wrapPoint;
        }
        if (newOffset > 0) {
          newOffset -= wrapPoint;
        }

        offset.value = newOffset;
        textPathRef.value.setAttribute("startOffset", `${newOffset}px`);
      }
      frame = window.requestAnimationFrame(step);
    };

    frame = window.requestAnimationFrame(step);
    onCleanup(() => {
      window.cancelAnimationFrame(frame);
    });
  },
  { immediate: true }
);

const onPointerDown = (event) => {
  if (!props.interactive) {
    return;
  }
  dragRef.value = true;
  lastXRef.value = event.clientX;
  velRef.value = 0;
  if (event.target && typeof event.target.setPointerCapture === "function") {
    event.target.setPointerCapture(event.pointerId);
  }
};

const onPointerMove = (event) => {
  if (!props.interactive || !dragRef.value) {
    return;
  }
  const dx = event.clientX - lastXRef.value;
  lastXRef.value = event.clientX;
  velRef.value = dx;

  const wrapPoint = spacing.value;
  if (!wrapPoint) {
    return;
  }

  let currentOffset = offset.value;
  if (textPathRef.value) {
    currentOffset = parseFloat(textPathRef.value.getAttribute("startOffset") || "0");
  }

  let newOffset = currentOffset + dx;
  if (newOffset <= -wrapPoint) {
    newOffset += wrapPoint;
  }
  if (newOffset > 0) {
    newOffset -= wrapPoint;
  }
  offset.value = newOffset;
  if (textPathRef.value) {
    textPathRef.value.setAttribute("startOffset", `${newOffset}px`);
  }
};

const endDrag = () => {
  if (!props.interactive) {
    return;
  }
  if (!dragRef.value) {
    return;
  }
  dragRef.value = false;
  dirRef.value = velRef.value > 0 ? "right" : "left";
};

onBeforeUnmount(() => {
  dragRef.value = false;
});
</script>

<style scoped>
.curved-loop-jacket {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 1.5rem 1.5rem;
}

.curved-loop-svg {
  user-select: none;
  width: 100%;
  aspect-ratio: 100 / 12;
  overflow: visible;
  display: block;
  font-size: clamp(3.75rem, 10vw, 5.75rem);
  color: #1f1b2c;
  fill: currentColor;
  -moz-user-select: none;
  -webkit-user-select: none;
  font-weight: 700;
  text-transform: uppercase;
  line-height: 1;
}

@media (max-width: 640px) {
  .curved-loop-svg {
    font-size: clamp(7.5rem, 14vw, 11.5rem);
  }
}
</style>
