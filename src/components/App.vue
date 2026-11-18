<script setup lang="ts">
/**
 * App.vue – Root layout of the Algorithmic Visualization Engine.
 *
 * A compact header holds the view toggles and theme switch; the body stacks a
 * collapsible sidebar drawer, the canvas area (one or two canvases in compare
 * mode), and a scrollable information column. On narrow screens the sidebar
 * slides in as a drawer and the information column stacks below the canvas.
 *
 * Global keyboard shortcuts (Space / ArrowLeft / ArrowRight / R) map to the
 * store. The current algorithm and step are mirrored into the URL so every
 * frame has a shareable link, and progress is recorded as the learner steps.
 */

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useVisualizerStore } from "@/stores/visualizer";
import { applyShareMetadata, readDeepLink, syncUrl } from "@/composables/useShare";
import { recordProgress } from "@/composables/useLearning";
import Sidebar from "./Sidebar.vue";
import VisualContainer from "./VisualContainer.vue";
import ControlsBar from "./ControlsBar.vue";
import InfoPanel from "./InfoPanel.vue";
import EducationPanel from "./EducationPanel.vue";
import PseudocodePanel from "./PseudocodePanel.vue";
import StatsPanel from "./StatsPanel.vue";
import TextAlternative from "./TextAlternative.vue";
import ThemeToggle from "./ThemeToggle.vue";
import InputForm from "./InputForm.vue";
import ComparePanel from "./ComparePanel.vue";
import SharePanel from "./SharePanel.vue";
import CodeExport from "./CodeExport.vue";
import LearningPanel from "./LearningPanel.vue";

const store = useVisualizerStore();
const {
    algorithm,
    algorithmId,
    stepIndex,
    isCompareMode,
    compareAlgorithm,
} = storeToRefs(store);

/** Whether the sidebar drawer is open on small screens. */
const drawerOpen = ref(false);

/** Visibility of the optional panels. */
const showInput = ref(false);
const showCompare = ref(false);
const showShare = ref(false);
const showExport = ref(false);
const showLearning = ref(false);

/** Caption shown under the canvas, including both runs in compare mode. */
const description = computed(() => {
    if (store.isLoading) {
        return "Loading algorithm…";
    }
    const primary = store.currentFrame?.description ?? "Select an algorithm to begin.";
    if (!isCompareMode.value) {
        return primary;
    }
    const second = store.compareFrame?.description ?? "Waiting for the second algorithm.";
    return `A: ${primary}   |   B: ${second}`;
});

// Selecting an algorithm closes the mobile drawer so the canvas is visible.
watch(algorithmId, () => {
    drawerOpen.value = false;
});

// Mirror the current frame into the address bar and record learner progress.
watch([algorithmId, stepIndex], ([id, step]) => {
    syncUrl(id, step);
    if (id) {
        recordProgress(id, step);
    }
});

// Keep the document title and description in sync with the loaded algorithm.
watch(algorithm, (meta) => applyShareMetadata(meta ?? null), { immediate: true });

// ----------------------------------------------------------------------
// Global keyboard shortcuts:
//   Space        -> toggle play/pause
//   ArrowLeft    -> step backward
//   ArrowRight   -> step forward
//   R            -> reset to the first step
//
// Shortcuts are ignored inside editable controls and when a modifier key is
// held, so typing in a form never triggers playback by accident.
// ----------------------------------------------------------------------

function onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
    }
    const target = event.target as HTMLElement | null;
    if (
        target &&
        (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable)
    ) {
        return;
    }

    switch (event.key) {
        case " ":
            // Focused buttons and similar controls activate with Space natively.
            if (target?.closest("button, a[href], summary, [role='button']")) {
                return;
            }
            event.preventDefault();
            store.togglePlay();
            break;
        case "ArrowLeft":
            event.preventDefault();
            store.prevStep();
            break;
        case "ArrowRight":
            event.preventDefault();
            store.nextStep();
            break;
        case "r":
        case "R":
            store.reset();
            break;
    }
}

onMounted(async () => {
    window.addEventListener("keydown", onKeydown);

    // Restore a shared link: load the algorithm first, then jump to its step.
    const link = readDeepLink();
    if (link.id) {
        await store.loadAlgorithm(link.id);
        if (link.step > 0) {
            store.goToStep(link.step);
        }
    }
});

onBeforeUnmount(() => {
    window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
    <div id="app">
        <header class="app-header">
            <button
                type="button"
                class="drawer-toggle"
                aria-label="Open algorithm list"
                :aria-expanded="drawerOpen"
                @click="drawerOpen = !drawerOpen"
            >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
                    <rect x="2" y="3" width="14" height="2" />
                    <rect x="2" y="8" width="14" height="2" />
                    <rect x="2" y="13" width="14" height="2" />
                </svg>
            </button>

            <span class="app-title">Algorithmic Visualization Engine</span>

            <nav class="header-actions" aria-label="Views">
                <button type="button" :aria-pressed="showInput" @click="showInput = !showInput">
                    Input
                </button>
                <button type="button" :aria-pressed="showCompare" @click="showCompare = !showCompare">
                    Compare
                </button>
                <button type="button" :aria-pressed="showShare" @click="showShare = !showShare">
                    Share
                </button>
                <button type="button" :aria-pressed="showExport" @click="showExport = !showExport">
                    Export
                </button>
                <button type="button" :aria-pressed="showLearning" @click="showLearning = !showLearning">
                    Learn
                </button>
                <ThemeToggle />
            </nav>
        </header>

        <div class="app-body">
            <div v-if="drawerOpen" class="drawer-backdrop" @click="drawerOpen = false"></div>

            <div class="sidebar-wrap" :class="{ open: drawerOpen }">
                <button type="button" class="drawer-close" @click="drawerOpen = false">
                    Close list
                </button>
                <Sidebar />
            </div>

            <main class="visualizer-area">
                <InputForm v-if="showInput" />

                <div class="canvas-row" :class="{ 'is-compare': isCompareMode }">
                    <div class="canvas-slot">
                        <span v-if="isCompareMode" class="canvas-label">A: {{ algorithm?.name }}</span>
                        <VisualContainer />
                    </div>
                    <div v-if="isCompareMode" class="canvas-slot">
                        <span class="canvas-label">B: {{ compareAlgorithm?.name }}</span>
                        <VisualContainer
                            :frame="store.compareFrame"
                            :total-steps="store.compareTotalSteps"
                            label="Comparison run B"
                        />
                    </div>
                </div>

                <div class="description-bar" role="status" aria-live="polite">
                    {{ description }}
                </div>

                <TextAlternative />
                <ControlsBar />
            </main>

            <aside class="info-area">
                <ComparePanel v-if="showCompare" />
                <SharePanel v-if="showShare" />
                <CodeExport v-if="showExport" />
                <LearningPanel v-if="showLearning" />
                <InfoPanel />
                <EducationPanel />
                <PseudocodePanel />
                <StatsPanel />
            </aside>
        </div>
    </div>
</template>

<style scoped>
.app-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    min-height: 48px;
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-bg-controls);
    border-bottom: var(--border-width) solid var(--color-border-panel);
}

.app-title {
    font-size: var(--font-size-heading);
    font-weight: 600;
    white-space: nowrap;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin-left: auto;
    overflow-x: auto;
}

.header-actions button {
    min-height: 36px;
    white-space: nowrap;
}

.header-actions button[aria-pressed="true"] {
    border-color: var(--state-active-border);
    color: var(--state-active-border);
}

.drawer-toggle {
    display: none;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    flex-shrink: 0;
}

.app-body {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: row;
    min-height: 0;
}

.sidebar-wrap {
    display: contents;
}

.drawer-backdrop,
.drawer-close {
    display: none;
}

.visualizer-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
    background: var(--color-bg-canvas);
}

.canvas-row {
    flex: 1;
    display: flex;
    flex-direction: row;
    min-height: 0;
}

.canvas-slot {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
}

.canvas-slot + .canvas-slot {
    border-left: var(--border-width) solid var(--color-border-panel);
}

.canvas-label {
    flex-shrink: 0;
    padding: var(--spacing-1) var(--spacing-3);
    font-weight: 500;
    background: var(--color-bg-description);
    border-bottom: var(--border-width) solid var(--color-border-panel);
}

.description-bar {
    min-height: 40px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--color-bg-description);
    border-top: var(--border-width) solid var(--color-border-panel);
    font-size: var(--font-size-base);
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
}

.info-area {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    overflow-y: auto;
    padding: var(--spacing-3);
    background: var(--color-bg-sidebar);
    border-left: var(--border-width) solid var(--color-border-panel);
}

/* Narrow screens: sidebar becomes a drawer and the info column stacks below. */
@media (max-width: 900px) {
    .app-body {
        flex-direction: column;
        overflow-y: auto;
    }

    .drawer-toggle {
        display: inline-flex;
    }

    .drawer-backdrop {
        display: block;
        position: absolute;
        inset: 0;
        z-index: 9;
        background: rgba(0, 0, 0, 0.35);
    }

    .sidebar-wrap {
        display: flex;
        flex-direction: column;
        position: absolute;
        top: 0;
        bottom: 0;
        left: 0;
        z-index: 10;
        width: min(85vw, 320px);
        background: var(--color-bg-sidebar);
        border-right: var(--border-width) solid var(--color-border-panel);
        transform: translateX(-100%);
    }

    .sidebar-wrap.open {
        transform: translateX(0);
    }

    .drawer-close {
        display: block;
        min-height: 44px;
        margin: var(--spacing-2);
    }

    .sidebar-wrap :deep(.sidebar) {
        width: 100%;
        flex: 1;
        min-height: 0;
    }

    .visualizer-area {
        flex: none;
        height: 60vh;
        min-height: 320px;
    }

    .info-area {
        width: 100%;
        max-height: none;
        border-left: none;
        border-top: var(--border-width) solid var(--color-border-panel);
        overflow-y: visible;
    }

    .canvas-row.is-compare {
        flex-direction: column;
    }

    .canvas-slot + .canvas-slot {
        border-left: none;
        border-top: var(--border-width) solid var(--color-border-panel);
    }
}

@media (max-width: 600px) {
    .app-header {
        flex-wrap: wrap;
    }

    .app-title {
        font-size: var(--font-size-base);
    }

    .header-actions {
        width: 100%;
        margin-left: 0;
    }

    .header-actions button {
        min-height: 44px;
    }

    .visualizer-area {
        height: 70vh;
    }
}
</style>
