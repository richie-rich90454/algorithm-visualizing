<script setup lang="ts">
/**
 * LearningPanel.vue – Bookmarks, progress, related algorithms, and a quiz.
 *
 * Everything here is derived from data the app already has: bookmarks and
 * furthest-step progress are stored locally, "more like this" comes from the
 * manifest, and quiz questions are generated from the current algorithm's
 * metadata and pseudocode. No separate content files are required.
 */

import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { getAlgorithm } from "@/core";
import { useVisualizerStore } from "@/stores/visualizer";
import {
    bookmarks,
    progress,
    isBookmarked,
    toggleBookmark,
    moreLikeThis,
    buildQuiz,
} from "@/composables/useLearning";
import type { AlgorithmMeta } from "@/core/manifest";

const store = useVisualizerStore();
const { algorithm, algorithmId, loadedModule } = storeToRefs(store);

/** Bookmarked algorithms, in the order they were saved. */
const saved = computed<AlgorithmMeta[]>(() =>
    bookmarks.value
        .map((id) => getAlgorithm(id))
        .filter((item): item is AlgorithmMeta => item !== null),
);

/** The five most-advanced algorithms in the learner's progress record. */
const recent = computed(() =>
    Object.entries(progress.value)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, step]) => ({ meta: getAlgorithm(id), step }))
        .filter((item): item is { meta: AlgorithmMeta; step: number } => item.meta !== null),
);

/** Other algorithms in the same category as the current one. */
const related = computed(() =>
    algorithmId.value ? moreLikeThis(algorithmId.value) : [],
);

/** Questions derived from the current algorithm's metadata. */
const questions = computed(() =>
    algorithm.value ? buildQuiz(algorithm.value, loadedModule.value?.pseudocode ?? []) : [],
);

/** The choice selected for each question index. */
const answers = ref<Record<number, number>>({});

// A new algorithm gets a fresh quiz.
watch(algorithmId, () => {
    answers.value = {};
});

/** Record an answer once; a quiz question cannot be retried in place. */
function answer(questionIndex: number, choiceIndex: number): void {
    if (answers.value[questionIndex] === undefined) {
        answers.value[questionIndex] = choiceIndex;
    }
}
</script>

<template>
    <div class="learning-panel panel">
        <h2 class="panel-title">Your learning</h2>

        <button
            v-if="algorithm"
            type="button"
            class="bookmark-button"
            :aria-pressed="isBookmarked(algorithm.id)"
            @click="toggleBookmark(algorithm.id)"
        >
            {{ isBookmarked(algorithm.id) ? "Remove bookmark" : "Bookmark this algorithm" }}
        </button>

        <section class="learning-section">
            <h3>Bookmarks</h3>
            <p v-if="saved.length === 0" class="empty">No bookmarks yet.</p>
            <ul v-else>
                <li v-for="item in saved" :key="item.id">
                    <button type="button" class="link-button" @click="store.loadAlgorithm(item.id)">
                        {{ item.name }}
                    </button>
                </li>
            </ul>
        </section>

        <section class="learning-section">
            <h3>Progress</h3>
            <p v-if="recent.length === 0" class="empty">No progress recorded yet.</p>
            <ul v-else>
                <li v-for="item in recent" :key="item.meta.id">
                    {{ item.meta.name }} - step {{ item.step + 1 }}
                </li>
            </ul>
        </section>

        <section v-if="related.length > 0" class="learning-section">
            <h3>More like this</h3>
            <ul>
                <li v-for="item in related" :key="item.id">
                    <button type="button" class="link-button" @click="store.loadAlgorithm(item.id)">
                        {{ item.name }}
                    </button>
                </li>
            </ul>
        </section>

        <section v-if="questions.length > 0" class="learning-section">
            <h3>Quick quiz</h3>
            <div v-for="(question, index) in questions" :key="index" class="quiz-question">
                <p class="quiz-prompt">{{ question.prompt }}</p>
                <div class="quiz-choices" role="group" :aria-label="question.prompt">
                    <button
                        v-for="(choice, choiceIndex) in question.choices"
                        :key="choiceIndex"
                        type="button"
                        :aria-pressed="answers[index] === choiceIndex"
                        :disabled="answers[index] !== undefined"
                        @click="answer(index, choiceIndex)"
                    >
                        {{ choice }}
                    </button>
                </div>
                <p
                    v-if="answers[index] !== undefined"
                    class="quiz-feedback"
                    role="status"
                >
                    {{ answers[index] === question.answer ? "Correct." : "Not quite." }}
                    {{ question.explanation }}
                </p>
            </div>
        </section>
    </div>
</template>

<style scoped>
.learning-panel {
    padding: var(--spacing-4);
    background: var(--color-bg-controls);
}

.panel-title {
    font-size: var(--font-size-heading);
    font-weight: 600;
    margin-bottom: var(--spacing-3);
}

.bookmark-button {
    width: 100%;
    margin-bottom: var(--spacing-3);
}

.learning-section + .learning-section {
    margin-top: var(--spacing-4);
    padding-top: var(--spacing-3);
    border-top: var(--border-width) solid var(--color-border-panel);
}

.learning-section h3 {
    font-size: var(--font-size-base);
    margin-bottom: var(--spacing-1);
}

ul {
    list-style: disc;
    padding-left: var(--spacing-5);
}

.link-button {
    padding: 0;
    border: none;
    background: none;
    color: var(--state-active-border);
    text-align: left;
    text-decoration: underline;
}

.quiz-question + .quiz-question {
    margin-top: var(--spacing-3);
}

.quiz-prompt {
    font-weight: 500;
    margin-bottom: var(--spacing-2);
}

.quiz-choices {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
}

.quiz-choices button {
    text-align: left;
}

.quiz-choices button:disabled {
    cursor: default;
    opacity: 0.75;
}

.quiz-feedback {
    margin-top: var(--spacing-2);
    color: var(--color-text-secondary);
}

.empty {
    color: var(--color-text-secondary);
}
</style>
