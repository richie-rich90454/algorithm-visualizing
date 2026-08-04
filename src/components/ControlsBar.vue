<script setup lang="ts">
/**
 * ControlsBar.vue – The playback strip under the visualizer.
 *
 * A fixed-height (56px) flex row that centers the play/pause button, the step
 * counter, the speed slider, and the reset button. Every control binds
 * directly to the store, so no events are wired up here.
 */

import PlayPauseButton from "./PlayPauseButton.vue";
import ResetButton from "./ResetButton.vue";
import SpeedSlider from "./SpeedSlider.vue";
import StepCounter from "./StepCounter.vue";
</script>

<template>
    <div class="controls-bar">
        <PlayPauseButton />
        <StepCounter />
        <SpeedSlider />
        <ResetButton />
    </div>
</template>

<style scoped>
.controls-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-5);
    height: 56px;
    flex-shrink: 0;
    background: var(--color-bg-controls);
    border-top: var(--border-width) solid var(--color-border-panel);
}
</style>
