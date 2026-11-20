<script setup lang="ts">
/**
 * SharePanel.vue – Deep link, embed snippet, and per-algorithm share text.
 *
 * The link encodes the selected algorithm and step, so a classmate opening it
 * lands on the exact same frame. Titles and descriptions are derived from the
 * algorithm's metadata; the embed snippet uses the same URL with embed=1.
 */

import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useVisualizerStore } from "@/stores/visualizer";
import {
    buildShareUrl,
    copyText,
    embedSnippet,
    shareContent,
} from "@/composables/useShare";

const store = useVisualizerStore();
const { algorithm, algorithmId, stepIndex } = storeToRefs(store);

/** Feedback after a copy action, announced politely. */
const status = ref("");

/** The current deep link. */
const url = computed(() => buildShareUrl(algorithmId.value, stepIndex.value));

/** iframe snippet for embedding the current step. */
const embed = computed(() => embedSnippet(url.value));

/** Share title and description for the loaded algorithm. */
const content = computed(() => (algorithm.value ? shareContent(algorithm.value) : null));

/** Copy the deep link to the clipboard. */
async function copyLink(): Promise<void> {
    status.value = (await copyText(url.value)) ? "Link copied." : "Copy failed; select the link manually.";
}

/** Copy the embed snippet to the clipboard. */
async function copyEmbed(): Promise<void> {
    status.value = (await copyText(embed.value)) ? "Embed code copied." : "Copy failed; select the code manually.";
}
</script>

<template>
    <div class="share-panel panel">
        <h2 class="panel-title">Share</h2>

        <p v-if="!algorithm" class="empty">Select an algorithm to get a shareable link.</p>

        <template v-else>
            <label class="field-label" for="share-link">Link to this step</label>
            <input id="share-link" class="share-input" :value="url" readonly />

            <div class="share-actions">
                <button type="button" @click="copyLink">Copy link</button>
                <button type="button" @click="copyEmbed">Copy embed code</button>
            </div>

            <label class="field-label" for="embed-code">Embed snippet</label>
            <textarea id="embed-code" class="share-input" :value="embed" rows="3" readonly></textarea>

            <dl v-if="content" class="share-meta">
                <dt>Title</dt>
                <dd>{{ content.title }}</dd>
                <dt>Description</dt>
                <dd>{{ content.description }}</dd>
            </dl>

            <p class="status" role="status" aria-live="polite">{{ status }}</p>
        </template>
    </div>
</template>

<style scoped>
.share-panel {
    padding: var(--spacing-4);
    background: var(--color-bg-controls);
}

.panel-title {
    font-size: var(--font-size-heading);
    font-weight: 600;
    margin-bottom: var(--spacing-3);
}

.field-label {
    display: block;
    font-weight: 500;
    margin-bottom: var(--spacing-1);
    margin-top: var(--spacing-3);
}

.share-input {
    width: 100%;
    padding: 6px 8px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: var(--color-text-primary);
    background: var(--color-bg-canvas);
    border: var(--border-width) solid var(--state-idle-border);
    border-radius: var(--radius);
    resize: vertical;
}

.share-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
    margin-top: var(--spacing-3);
}

.share-meta {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--spacing-1) var(--spacing-3);
    margin-top: var(--spacing-3);
    font-size: 12px;
}

.share-meta dt {
    color: var(--color-text-secondary);
}

.status {
    margin-top: var(--spacing-2);
    color: var(--color-text-secondary);
    min-height: 1em;
}

.empty {
    color: var(--color-text-secondary);
}
</style>
