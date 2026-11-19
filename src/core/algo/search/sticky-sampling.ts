/**
 * sticky-sampling.ts - Sticky Sampling for Frequent Stream Items
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Sticky sampling (Manku and Motwani) finds items whose frequency exceeds a
 * support threshold in a long stream while using space independent of the
 * stream length. Every item that already has a counter is always counted: the
 * sample "sticks" to it. New items are admitted with a probability that is
 * halved at exponentially growing checkpoints, where every counter is also
 * decremented by one. At query time a counter is inflated by the inverse of
 * the current sampling rate to give a frequency estimate, and items above the
 * corrected threshold are reported.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) per stream of length N plus O(m) at each decay checkpoint
 *   Space: O((1 / error) * log(error * N)) counters in expectation
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per tracked item; the cell value is its counter.
 *   - A cell turns GREEN when its item is reported as frequent at the end.
 *   - The caption names the current sampling rate and decay checkpoint.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface StickyInput {
    stream?: Array<string | number>;
    support?: number;
    error?: number;
    seed?: number;
}

function makeCells(
    counters: Map<string, number>,
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    return [...counters.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 16)
        .map(([item, count], index) => ({
            id: `cell-${index}`,
            type: "cell" as const,
            label: `${item}:${count}`,
            value: count,
            state: states.get(item) ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { item, count, row: Math.floor(index / 4), col: index % 4 },
        }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as StickyInput | null) ?? {};
    const stream: string[] = Array.isArray(task.stream)
        ? task.stream.map((item) => String(item))
        : [...Array(12).fill("x"), ...Array(8).fill("y"), ...Array(5).fill("z"), ...Array.from({ length: 15 }, (_, i) => `n${i}`)];
    const support = typeof task.support === "number" && task.support > 0 ? task.support : 0.2;
    const error = typeof task.error === "number" && task.error > 0 && task.error < support ? task.error : 0.05;
    const seed = typeof task.seed === "number" ? task.seed >>> 0 : 2026;
    let state = seed || 1;
    const random = (): number => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };

    const counters = new Map<string, number>();
    let rate = 1;
    let nextDecay = Math.max(2, Math.ceil(1 / error));
    let step = 0;
    let admitted = 0;
    let decays = 0;
    const stride = Math.max(1, Math.floor(stream.length / 30));

    const frame = (
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | boolean | string[]> = {},
        states: Map<string, EntityState> = new Map(),
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeCells(counters, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "grid",
        meta: {
            streamLength: stream.length,
            sampleRate: rate,
            tracked: counters.size,
            admitted,
            decays,
            support,
            error,
            nextDecay,
            ...extra,
        },
    });

    yield frame(`Sticky sampling over ${stream.length} items with support ${support} and error ${error}.`, 0, { seed });
    step += 1;

    for (let i = 0; i < stream.length; i += 1) {
        const item = stream[i] as string;
        const existing = counters.get(item);
        if (existing !== undefined) {
            counters.set(item, existing + 1);
        } else if (random() < rate) {
            counters.set(item, 1);
            admitted += 1;
        }
        if (i + 1 >= nextDecay) {
            for (const [key, count] of [...counters]) {
                if (count <= 1) {
                    counters.delete(key);
                } else {
                    counters.set(key, count - 1);
                }
            }
            rate /= 2;
            nextDecay *= 2;
            decays += 1;
        }
        if ((i + 1) % stride === 0) {
            yield frame(
                `Processed ${i + 1}/${stream.length}: ${counters.size} tracked item(s), sample rate ${rate}, ${decays} decay checkpoint(s).`,
                3,
                { processed: i + 1 },
            );
            step += 1;
        }
    }

    const threshold = (support - error) * stream.length;
    const reported: string[] = [];
    const estimates: string[] = [];
    for (const [item, count] of counters) {
        const estimate = count / rate;
        if (estimate >= threshold) {
            reported.push(item);
        }
        estimates.push(`${item}:${estimate.toFixed(2)}`);
    }
    reported.sort();
    const highlight = new Map<string, EntityState>(reported.map((item) => [item, "sorted" as EntityState]));
    yield frame(
        `Reported ${reported.length} frequent item(s) at threshold ${threshold.toFixed(2)}: ${reported.join(", ") || "none"}.`,
        5,
        { reported, estimates, done: true },
        highlight,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Keep a small table of candidate items and their sample counts. An item already in the table always gets counted, so heavy hitters stick around. Early on almost every item is admitted, but the admission probability halves at exponentially spaced checkpoints and all counts drop by one there, so the table stays small even on an endless stream.",
        invariants: [
            "A tracked item's counter never exceeds its true stream frequency.",
            "The sampling rate is halved only at a decay checkpoint, where every counter also falls by one.",
            "Only items seen in the stream can appear in the counter table.",
        ],
        correctness:
            "An item above the support threshold is admitted with probability one on its first occurrence while the initial rate is one, and each subsequent occurrence increments its counter. Decay subtracts at most the number of checkpoints, which is logarithmic in the stream length, so a truly frequent item keeps a counter above the corrected threshold. Thus frequent items are never missed except with the stated small failure probability.",
        complexityRationale:
            "Each stream item does constant work, and each decay scans the current table; the table size is O((1 / error) times log(error times N)) in expectation, so total time is O(N) plus that scan cost.",
        uses: [
            "Finding heavy network flows in a router with limited memory",
            "Tracking popular queries or products over an unbounded event stream",
            "A randomized alternative to lossy counting with constant memory",
        ],
        references: [
            "Manku and Motwani, Approximate Frequency Counts over Data Streams, VLDB 2002",
            "Cormode, Finding Frequent Items in Data Streams, 2008",
        ],
        workedExample:
            "With support 0.2, error 0.05 and a stream of 40 items where x appears 12 times, x is admitted on its first occurrence and counted every time. Decays at positions 20 and 40 lower its counter to 10 while the rate falls to 0.25, so its estimate 10 / 0.25 = 40 exceeds the threshold 6 and x is reported.",
    },
    id: "sticky-sampling",
    name: "Sticky Sampling",
    category: "searching",
    complexity: { time: "O(N)", space: "O((1/error) * log(error*N))" },
    defaultInput: { support: 0.2, error: 0.05, seed: 2026 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize an empty counter table and sampling rate one",
        "for each item in the stream",
        "if the item is tracked, increment its counter",
        "otherwise admit it with probability equal to the sample rate",
        "at each exponential checkpoint halve the rate and decrement all counters",
        "delete counters that fall to zero",
        "inflate surviving counters by the inverse rate and report heavy hitters",
    ],
};

export default module;
