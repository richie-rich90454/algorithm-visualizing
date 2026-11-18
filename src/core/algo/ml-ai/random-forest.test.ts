/**
 * random-forest.test.ts - Independent ensemble replay, majority-vote
 * property, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./random-forest";
import type { VisualFrame } from "@/types";

interface Node {
    threshold?: number;
    left?: Node;
    right?: Node;
    label?: number;
}

function checkFrames(frames: VisualFrame[], n: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(n);
        expect(frame.meta["cols"]).toBe(cols);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function rnd(state: number): [number, number] {
    const s = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return [s, s / 4294967296];
}

function impurity(labels: number[], idx: number[]): number {
    if (idx.length === 0) return 0;
    const ones = idx.filter((i) => labels[i] === 1).length;
    const p = ones / idx.length;
    return 1 - p * p - (1 - p) * (1 - p);
}

function vote(labels: number[], idx: number[]): number {
    return idx.filter((i) => labels[i] === 1).length * 2 > idx.length ? 1 : 0;
}

/** Reference CART builder: brute-force all midpoints at every node. */
function grow(xs: number[], labels: number[], idx: number[], depth: number, maxDepth: number): Node {
    if (idx.length <= 1 || depth >= maxDepth || impurity(labels, idx) === 0) {
        return { label: vote(labels, idx) };
    }
    const uniq = [...new Set(idx.map((i) => xs[i]))].sort((a, b) => a - b);
    if (uniq.length < 2) return { label: vote(labels, idx) };
    let best = uniq[0];
    let bestScore = Infinity;
    for (let k = 0; k < uniq.length - 1; k += 1) {
        const t = (uniq[k] + uniq[k + 1]) / 2;
        const L = idx.filter((i) => xs[i] <= t);
        const R = idx.filter((i) => xs[i] > t);
        const score = (L.length / idx.length) * impurity(labels, L) + (R.length / idx.length) * impurity(labels, R);
        if (score < bestScore) {
            bestScore = score;
            best = t;
        }
    }
    return {
        threshold: best,
        left: grow(xs, labels, idx.filter((i) => xs[i] <= best), depth + 1, maxDepth),
        right: grow(xs, labels, idx.filter((i) => xs[i] > best), depth + 1, maxDepth),
    };
}

function classify(node: Node, x: number): number {
    let cur = node;
    while (cur.threshold !== undefined && cur.left && cur.right) {
        cur = x <= cur.threshold ? cur.left : cur.right;
    }
    return cur.label ?? 0;
}

/** Rebuild the whole forest from scratch and return votes plus final predictions. */
function referenceForest(
    xs: number[],
    labels: number[],
    numTrees: number,
    maxDepth: number,
    seed: number,
    sampleRatio: number,
): { samples: number[][]; votes: number[][]; predictions: number[] } {
    let state = seed >>> 0;
    const size = Math.max(1, Math.round(xs.length * sampleRatio));
    const samples: number[][] = [];
    const votes: number[][] = [];
    for (let t = 0; t < numTrees; t += 1) {
        const sample: number[] = [];
        for (let k = 0; k < size; k += 1) {
            const [next, u] = rnd(state);
            state = next;
            sample.push(Math.floor(u * xs.length));
        }
        samples.push(sample);
        const tree = grow(xs, labels, sample, 0, maxDepth);
        votes.push(xs.map((x) => classify(tree, x)));
    }
    const predictions = xs.map((_x, i) => {
        const ones = votes.filter((v) => v[i] === 1).length;
        return ones * 2 > numTrees ? 1 : 0;
    });
    return { samples, votes, predictions };
}

describe("RandomForest", () => {
    it("matches an independently grown forest on the default input", () => {
        const input = mod.defaultInput as {
            xs: number[];
            labels: number[];
            numTrees: number;
            maxDepth: number;
            seed: number;
            sampleRatio: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.xs.length, input.numTrees + 1);
        const expected = referenceForest(
            input.xs,
            input.labels,
            input.numTrees,
            input.maxDepth,
            input.seed,
            input.sampleRatio,
        );
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["predictions"]).toEqual(expected.predictions);
        expect(final?.["votes"]).toEqual(expected.votes.flat());
        expect(JSON.parse(String(final?.["bootstraps"]))).toEqual(expected.samples);
    });

    it("holds the majority-vote property across varying seeds and tree counts", () => {
        const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const labels = [0, 0, 1, 0, 1, 1, 1, 0, 1, 1];
        for (const seed of [0, 1, 7, 42, 999]) {
            for (const numTrees of [1, 2, 5]) {
                const frames = [...mod.run({ xs, labels, numTrees, maxDepth: 3, seed, sampleRatio: 0.8 })];
                checkFrames(frames, xs.length, numTrees + 1);
                const final = frames[frames.length - 1]?.meta;
                const expected = referenceForest(xs, labels, numTrees, 3, seed, 0.8);
                expect(final?.["predictions"]).toEqual(expected.predictions);
                const votes = final?.["votes"] as number[];
                for (let i = 0; i < xs.length; i += 1) {
                    const ones = Array.from({ length: numTrees }, (_, t) => votes[t * xs.length + i]).filter(
                        (v) => v === 1,
                    ).length;
                    expect((final?.["predictions"] as number[])[i]).toBe(ones * 2 > numTrees ? 1 : 0);
                }
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
