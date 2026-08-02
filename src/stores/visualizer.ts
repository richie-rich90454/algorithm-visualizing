/**
 * visualizer.ts – The single Pinia store backing the whole visualiser.
 *
 * This store is the only piece of mutable application state in the project.
 * It owns the `StepEngine` instance, the currently selected algorithm id, the
 * playback flag and speed, and the entity the user clicked on. Every Vue
 * component reads and writes the visualiser through this store and nowhere
 * else, which keeps the data flow one-way and easy to reason about.
 *
 * Playback is implemented with a plain `setInterval` whose delay is re-read
 * from `speed` on every tick, and the interval is torn down / rebuilt whenever
 * the speed changes so the new delay takes effect immediately.
 */

import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { getAlgorithm } from "@/core";
import { StepEngine } from "@/core/engine";
import type { VisualEntity } from "@/types";

/**
 * The visualiser store, written in Pinia's setup-store style.
 *
 * @returns The reactive state, computed views, and actions of the store.
 */
export const useVisualizerStore = defineStore("visualizer", () => {
    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------

    /** Id of the currently loaded algorithm, or null before any selection. */
    const algorithmId = ref<string | null>(null);

    /** Whether playback is currently advancing frames automatically. */
    const isPlaying = ref(false);

    /** Milliseconds between steps; the slider maps 1–100 into 1000–50ms. */
    const speed = ref(300);

    /** The entity the user last clicked on, highlighted by the overlay. */
    const selectedEntity = ref<VisualEntity | null>(null);

    /** The internal step engine; owns the frame buffer and current index. */
    const engine = new StepEngine();

    /** Handle of the playback interval, null while paused. */
    let interval: ReturnType<typeof setInterval> | null = null;

    // Even electrons get tired sometimes – this is where the engine rests
    // between frames while you decide what to click next.

    // ------------------------------------------------------------------
    // Getters
    // ------------------------------------------------------------------

    /** The frame currently displayed, or null when no algorithm is loaded. */
    const currentFrame = computed(() => engine.getCurrentFrame());

    /** Zero-based index of the current frame. */
    const stepIndex = computed(() => engine.step);

    /** Total number of frames in the loaded run. */
    const totalSteps = computed(() => engine.totalFrames);

    /** The loaded algorithm module, or null before any selection. */
    const algorithm = computed(() => (algorithmId.value ? getAlgorithm(algorithmId.value) : null));

    // ------------------------------------------------------------------
    // Actions
    // ------------------------------------------------------------------

    /**
     * Load an algorithm by id, run it, and rewind to the first frame.
     *
     * Loading always stops playback first – starting to play a brand-new
     * algorithm without the user asking would be surprising.
     *
     * @param id Kebab-case algorithm id, e.g. `"bubble-sort"`.
     */
    function loadAlgorithm(id: string): void {
        const module = getAlgorithm(id);
        if (!module) {
            return;
        }
        stopPlayback();
        engine.load(module, module.defaultInput);
        selectedEntity.value = null;
        algorithmId.value = id;
    }

    /** Advance one frame and pause when the final frame is reached. */
    function nextStep(): void {
        const moved = engine.next();
        // Hitting the end of the animation stops playback automatically.
        if (!moved && isPlaying.value) {
            stopPlayback();
        }
    }

    /** Move one frame backward. */
    function prevStep(): void {
        engine.prev();
    }

    /** Rewind to the first frame. */
    function reset(): void {
        engine.reset();
    }

    /** Toggle between playing and paused. */
    function togglePlay(): void {
        if (isPlaying.value) {
            stopPlayback();
        } else {
            startPlayback();
        }
    }

    /**
     * Begin advancing frames on an interval.
     *
     * Each tick reads the *current* speed value, so changing the slider while
     * playing re-tunes the delay without restarting the interval.
     */
    function startPlayback(): void {
        if (interval !== null) {
            return;
        }
        isPlaying.value = true;
        interval = setInterval(() => {
            // If we cannot advance, we have reached the end – stop playing.
            if (!engine.next()) {
                stopPlayback();
                return;
            }
        }, speed.value);
    }

    /** Stop advancing frames and release the interval. */
    function stopPlayback(): void {
        isPlaying.value = false;
        if (interval !== null) {
            clearInterval(interval);
            interval = null;
        }
    }

    // ------------------------------------------------------------------
    // Effects
    // ------------------------------------------------------------------

    // When the user drags the speed slider during playback, rebuild the
    // interval so the new delay is honoured on the very next tick.
    watch(speed, () => {
        if (isPlaying.value) {
            stopPlayback();
            startPlayback();
        }
    });

    // A clean teardown so a page navigation can never leak a running timer.
    watch(algorithmId, () => stopPlayback());

    // ------------------------------------------------------------------
    // Public surface
    // ------------------------------------------------------------------

    return {
        algorithmId,
        isPlaying,
        speed,
        selectedEntity,
        currentFrame,
        stepIndex,
        totalSteps,
        algorithm,
        loadAlgorithm,
        nextStep,
        prevStep,
        reset,
        togglePlay,
        startPlayback,
        stopPlayback,
    };
});
