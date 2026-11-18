/**
 * useLearning.ts – Bookmarks, progress, and quiz questions.
 *
 * Bookmarks and the furthest step reached for each algorithm live in
 * localStorage so a learner can pick up where they left off. "More like this"
 * is derived from the manifest by category. Quiz questions are generated from
 * an algorithm's own metadata and pseudocode, so no per-algorithm quiz content
 * needs to be authored.
 */

import { ref, watch } from "vue";
import { getAllAlgorithms, getAlgorithm } from "@/core";
import type { AlgorithmMeta } from "@/core/manifest";
import { CATEGORY_LABELS, categoryLabel } from "./categories";

const BOOKMARK_KEY = "algoviz-bookmarks";
const PROGRESS_KEY = "algoviz-progress";

/** Read a JSON value from storage, falling back when it is missing or invalid. */
function load<T>(key: string, fallback: T): T {
    try {
        if (typeof localStorage === "undefined") {
            return fallback;
        }
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
        return fallback;
    }
}

/** Write a JSON value to storage without throwing when storage is blocked. */
function save(key: string, value: unknown): void {
    try {
        if (typeof localStorage !== "undefined") {
            localStorage.setItem(key, JSON.stringify(value));
        }
    } catch {
        // Storage can be unavailable; progress is then session-local only.
    }
}

export const bookmarks = ref<string[]>(load<string[]>(BOOKMARK_KEY, []));
export const progress = ref<Record<string, number>>(load<Record<string, number>>(PROGRESS_KEY, {}));

watch(bookmarks, (value) => save(BOOKMARK_KEY, value), { deep: true });
watch(progress, (value) => save(PROGRESS_KEY, value), { deep: true });

/** @returns Whether an algorithm is bookmarked. */
export function isBookmarked(id: string): boolean {
    return bookmarks.value.includes(id);
}

/** Add or remove an algorithm from the bookmarks list. */
export function toggleBookmark(id: string): void {
    bookmarks.value = isBookmarked(id)
        ? bookmarks.value.filter((item) => item !== id)
        : [...bookmarks.value, id];
}

/** Record the furthest step reached for an algorithm. */
export function recordProgress(id: string, step: number): void {
    if (step <= (progress.value[id] ?? 0)) {
        return;
    }
    progress.value = { ...progress.value, [id]: step };
}

/** @returns A few other algorithms from the same category. */
export function moreLikeThis(id: string, limit = 5): AlgorithmMeta[] {
    const meta = getAlgorithm(id);
    if (!meta) {
        return [];
    }
    return getAllAlgorithms()
        .filter((item) => item.category === meta.category && item.id !== id)
        .slice(0, limit);
}

export interface QuizQuestion {
    prompt: string;
    choices: string[];
    answer: number;
    explanation: string;
}

/** @returns A small stable hash so quiz distractors are consistent per run. */
function hash(text: string): number {
    let value = 0;
    for (let i = 0; i < text.length; i += 1) {
        value = (value * 31 + text.charCodeAt(i)) | 0;
    }
    return Math.abs(value);
}

/** Pick three different distractors from a pool, keyed off the algorithm id. */
function distractors(pool: string[], correct: string, id: string, count = 3): string[] {
    const candidates = [...new Set(pool.filter((item) => item !== correct))];
    const start = hash(id) % Math.max(1, candidates.length);
    const picked: string[] = [];
    for (let i = 0; i < count && i < candidates.length; i += 1) {
        picked.push(candidates[(start + i) % candidates.length] as string);
    }
    return picked;
}

/** Shuffle choices while remembering where the correct answer landed. */
function arrange(correct: string, others: string[], id: string): { choices: string[]; answer: number } {
    const all = [correct, ...others];
    const offset = hash(id + all.join("|")) % all.length;
    const choices = all.map((_, index) => all[(index + offset) % all.length] as string);
    return { choices, answer: choices.indexOf(correct) };
}

/** @returns Three multiple-choice questions derived from an algorithm's data. */
export function buildQuiz(meta: AlgorithmMeta, pseudocode: string[] = []): QuizQuestion[] {
    const categoryPool = Object.values(CATEGORY_LABELS).map((label) => label.toLowerCase());
    const category = categoryLabel(meta.category).toLowerCase();
    const categoryChoices = arrange(
        category,
        distractors(categoryPool, category, meta.id),
        meta.id + "category",
    );
    const questions: QuizQuestion[] = [
        {
            prompt: `Which category does ${meta.name} belong to?`,
            choices: categoryChoices.choices,
            answer: categoryChoices.answer,
            explanation: `${meta.name} is grouped under ${category}.`,
        },
    ];

    const timePool = [
        "O(1)",
        "O(log n)",
        "O(n)",
        "O(n log n)",
        "O(n^2)",
        "O(V + E)",
        "O(E log V)",
    ];
    const time = meta.complexity.time;
    const timeChoices = arrange(time, distractors(timePool, time, meta.id, 3), meta.id + "time");
    questions.push({
        prompt: `What is the time complexity of ${meta.name}?`,
        choices: timeChoices.choices,
        answer: timeChoices.answer,
        explanation: `${meta.name} runs in ${time} time and uses ${meta.complexity.space} space.`,
    });

    if (pseudocode.length > 1) {
        const otherLines = pseudocode.slice(1);
        const chosen = distractors(otherLines, pseudocode[0] as string, meta.id, 3);
        const lineChoices = arrange(pseudocode[0] as string, chosen, meta.id + "line");
        questions.push({
            prompt: `What is the first step of ${meta.name}?`,
            choices: lineChoices.choices,
            answer: lineChoices.answer,
            explanation: "The first pseudocode line sets up the initial state before the main loop.",
        });
    } else {
        const space = meta.complexity.space;
        const spacePool = ["O(1)", "O(log n)", "O(n)", "O(n^2)", "O(V + E)"];
        const spaceChoices = arrange(space, distractors(spacePool, space, meta.id, 3), meta.id + "space");
        questions.push({
            prompt: `What is the space complexity of ${meta.name}?`,
            choices: spaceChoices.choices,
            answer: spaceChoices.answer,
            explanation: `${meta.name} uses ${space} additional space.`,
        });
    }

    return questions;
}

export function useLearning() {
    return { bookmarks, progress, isBookmarked, toggleBookmark, recordProgress, moreLikeThis, buildQuiz };
}
