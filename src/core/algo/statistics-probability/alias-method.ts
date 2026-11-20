/**
 * alias-method.ts - Vose Alias Method for Discrete Sampling
 *
 * Vose's alias method turns a discrete distribution over n outcomes into two
 * tables of size n so that sampling takes constant time after linear setup.
 * This module builds the scaled probability and alias tables, shows each
 * transfer step, then draws a deterministic sample to check the frequencies.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface AliasInput {
    probabilities?: number[];
    draws?: number;
    seed?: number;
}

function nextUniform(state: { s: number }): number {
    state.s = (Math.imul(1664525, state.s) + 1013904223) >>> 0;
    return (state.s + 0.5) / 4294967296;
}

interface AliasTable {
    scaled: number[];
    prob: number[];
    alias: number[];
    steps: Array<{ small: number; large: number }>;
}

/** Vose's two-list construction of the alias tables. */
function buildAlias(target: number[]): AliasTable {
    const n = target.length;
    const scaled = target.map((p) => p * n);
    const prob = new Array<number>(n).fill(1);
    const alias = Array.from({ length: n }, (_, i) => i);
    const steps: Array<{ small: number; large: number }> = [];
    const small: number[] = [];
    const large: number[] = [];
    for (let i = 0; i < n; i += 1) {
        if (scaled[i]! < 1) small.push(i);
        else large.push(i);
    }
    let guard = 0;
    while (small.length > 0 && large.length > 0 && guard < 10000) {
        guard += 1;
        const j = small.pop()!;
        const k = large.pop()!;
        prob[j] = scaled[j]!;
        alias[j] = k;
        steps.push({ small: j, large: k });
        scaled[k] = scaled[k]! + scaled[j]! - 1;
        if (scaled[k]! < 1) small.push(k);
        else large.push(k);
    }
    for (const k of large) {
        prob[k] = 1;
        alias[k] = k;
    }
    for (const j of small) {
        prob[j] = 1;
        alias[j] = j;
    }
    return { scaled, prob, alias, steps };
}

function sample(table: AliasTable, state: { s: number }): number {
    const n = table.prob.length;
    const j = Math.min(n - 1, Math.floor(nextUniform(state) * n));
    return nextUniform(state) < table.prob[j]! ? j : table.alias[j]!;
}

function makeCells(table: AliasTable, target: number[], activePair: number, done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < target.length; i += 1) {
        const pair = table.steps[activePair];
        const active = !done && pair && (pair.small === i || pair.large === i);
        const columns = [
            { label: `${i}`, value: i, role: "index" },
            { label: target[i]!.toFixed(4), value: target[i]!, role: "target" },
            { label: table.prob[i]!.toFixed(4), value: table.prob[i]!, role: "prob" },
            { label: `${table.alias[i]}`, value: table.alias[i], role: "alias" },
        ];
        columns.forEach((column, col) => {
            entities.push({
                id: `cell-${i}-${col}`,
                type: "cell" as const,
                label: column.label,
                value: column.value,
                state: done ? "sorted" : active ? "highlight" : activePair >= 0 && activePair < table.steps.length ? "visited" : "idle",
                x: col,
                y: i,
                width: 0,
                height: 0,
                metadata: { row: i, col, role: column.role },
            });
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AliasInput | null) ?? {};
    const raw = Array.isArray(task.probabilities) ? task.probabilities : [0.1, 0.2, 0.3, 0.4];
    const cleaned = raw.map((p) => Math.max(0, Number(p) || 0)).slice(0, 16);
    const sum = cleaned.reduce((a, b) => a + b, 0);
    const target = sum > 0 ? cleaned.map((p) => p / sum) : cleaned.map(() => 1 / Math.max(1, cleaned.length));
    const draws = Math.min(20000, Math.max(100, Math.floor(Number(task.draws ?? 4000)) || 4000));
    const seed = Math.max(1, Math.floor(Number(task.seed ?? 777)) || 777);
    const table = buildAlias(target);
    const state = { s: seed >>> 0 };
    const counts = new Array<number>(target.length).fill(0);
    for (let i = 0; i < draws; i += 1) {
        const outcome = sample(table, state);
        counts[outcome] = (counts[outcome] ?? 0) + 1;
    }
    const frequencies = counts.map((c) => c / draws);

    const meta = (activePair: number, done: boolean) => ({
        rows: target.length,
        cols: 4,
        n: target.length,
        target: [...target],
        scaled: [...table.scaled],
        prob: [...table.prob],
        alias: [...table.alias],
        draws,
        frequencies: done ? frequencies : frequencies.map(() => 0),
        activePair,
        done,
    });

    yield {
        stepNumber: 0,
        entities: makeCells(table, target, -1, false),
        edges: [],
        description: `Vose alias setup for ${target.length} outcomes; scale each probability by n and split into small and large lists.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: meta(-1, false),
    };

    let step = 1;
    for (let i = 0; i < table.steps.length; i += 1) {
        const pair = table.steps[i]!;
        yield {
            stepNumber: step,
            entities: makeCells(table, target, i, false),
            edges: [],
            description: `Transfer step ${i + 1}: move the leftover mass of outcome ${pair.small} onto alias slot ${pair.large}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: meta(i, false),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(table, target, -1, true),
        edges: [],
        description: `After ${draws} deterministic draws the observed frequencies track the target probabilities; sampling is now O(1) per draw.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: meta(table.steps.length, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Sampling from a discrete distribution by scanning a cumulative table costs time proportional to the number of outcomes. Vose's trick rearranges the probabilities into n narrow columns: in column i a coin flip either returns i or a paired alias. Once those columns are built, one uniform draw chooses a column and a second chooses the side, so sampling is constant time.",
        invariants: [
            "Each column holds a probability in zero to one and an alias index.",
            "The target probability of outcome i equals its own column share plus the leftover shares of every column aliasing to it, all divided by n.",
            "Every transfer moves a small scaled value into a large one, so the loop ends.",
        ],
        correctness:
            "Scaling by n makes the average scaled value one, so a scaled value below one has spare room and one above one has excess mass. Pairing a small with a large and storing the small value as the column probability assigns exactly that slice to the small outcome; the leftover changes the large value while preserving total mass. At termination every column is full, so the coin flip within a uniformly chosen column reproduces the original probabilities exactly.",
        complexityRationale:
            "Building the two lists and the transfer loop each touch every outcome a constant number of times, O(n) setup. Each of the displayed draws needs only two uniforms and table lookups, O(1) per sample, with O(n) space for the tables.",
        uses: [
            "Sampling tokens or actions in probabilistic models",
            "Fast weighted choice in game engines and simulations",
            "Drawing from categorical distributions in Monte Carlo methods",
        ],
        references: [
            "Vose, A Linear Algorithm for Generating Random Numbers with a Given Distribution, 1991",
            "Walker, An Efficient Method for Generating Discrete Random Variables, 1977",
        ],
        workedExample:
            "For probabilities 0.1, 0.2, 0.3 and 0.4 the scaled values are 0.4, 0.8, 1.2 and 1.6. Outcome zero with 0.4 is paired with outcome three, leaving 1.0; outcome one with 0.8 is paired with outcome two, leaving 1.0. Each column is now full and sampling needs just two random numbers.",
    },
    id: "alias-method",
    name: "Alias Method (Vose)",
    category: "statistics-probability",
    complexity: { time: "O(n) setup, O(1) per draw", space: "O(n)" },
    defaultInput: { probabilities: [0.1, 0.2, 0.3, 0.4], draws: 4000, seed: 777 },
    visualType: "grid",
    run,
    pseudocode: [
        "normalize the target probabilities and scale by n",
        "push scaled values below one to the small list and the rest to large",
        "while both lists are nonempty pop one index from each",
        "store the small scaled value as that column's probability and the large index as its alias",
        "add the small leftover to the large scaled value and reclassify it",
        "fill any remaining columns with probability one and self alias",
        "draw a column uniformly and flip a coin to choose the outcome",
        "done: report the alias tables and sampled frequencies",
    ],
};

export default module;
