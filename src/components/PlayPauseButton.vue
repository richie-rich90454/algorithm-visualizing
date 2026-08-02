<script setup lang="ts">
/**
 * PlayPauseButton.vue – Toggles animation playback.
 *
 * A simple button that delegates straight to the store. The icon reflects the
 * current state: a play triangle when paused, a pause double-bar when playing.
 * Icons are minimal inline SVGs to stay crisp on high-DPI screens.
 */

import { useVisualizerStore } from "@/stores/visualizer";

const store = useVisualizerStore();
</script>

<template>
    <button
        type="button"
        class="play-pause"
        :aria-label="store.isPlaying ? 'Pause' : 'Play'"
        @click="store.togglePlay()"
    >
        <!-- Play icon (▶) when paused; pause icon (⏸) when playing. -->
        <svg
            v-if="!store.isPlaying"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M3 1.5v11l9-5.5z" />
        </svg>
        <svg
            v-else
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="currentColor"
            aria-hidden="true"
        >
            <rect x="2" y="1.5" width="3.5" height="11" rx="1" />
            <rect x="8.5" y="1.5" width="3.5" height="11" rx="1" />
        </svg>
    </button>
</template>

<style scoped>
.play-pause {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
}
</style>
