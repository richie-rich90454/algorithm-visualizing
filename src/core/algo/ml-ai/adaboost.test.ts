/**
 * adaboost.test.ts - Brute-force stump search, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./adaboost";
import type { VisualFrame } from "@/types";

interface Input {
    points: number[][];
    labels: number[];
    rounds: number;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independently compute the final ensemble accuracy by brute force. */
function referenceAccuracy(input: Input): number {
    const n = Math.min(input.points.length, input.labels.length);
    const weights = new Array<number>(n).fill(1 / n);
    const ensemble: Array<{ f: number; t: number; p: number; a: number }> = [];
    for (let round = 0; round < input.rounds; round += 1) {
        let best: { f: number; t: number; p: number; err: number } | null = null;
        for (let f = 0; f < 2; f += 1) {
            const values = [...new Set(input.points.slice(0, n).map((pt) => pt[f] ?? 0))].sort((a, b) => a - b);
            for (let i = 0; i + 1 < values.length; i += 1) {
                const t = (values[i] ?? 0) + ((values[i + 1] ?? 0) - (values[i] ?? 0)) / 2;
                for (const p of [1, -1]) {
                    let err = 0;
                    for (let k = 0; k < n; k += 1) {
                        const h = p * ((input.points[k]?.[f] ?? 0) >= t ? 1 : -1);
                        if (h !== input.labels[k]) {
                            err += weights[k] ?? 0;
                        }
                    }
                    if (!best || err < best.err) {
                        best = { f, t, p, err };
                    }
                }
            }
        }
        if (!best || best.err >= 0.5 - 1e-12) {
            break;
        }
        const clipped = Math.min(1 - 1e-10, Math.max(1e-10, best.err));
        const a = 0.5 * Math.log((1 - clipped) / clipped);
        ensemble.push({ f: best.f, t: best.t, p: best.p, a });
        let total = 0;
        for (let k = 0; k < n; k += 1) {
            const h = best.p * ((input.points[k]?.[best.f] ?? 0) >= best.t ? 1 : -1);
            weights[k] = (weights[k] ?? 0) * Math.exp(-a * (input.labels[k] ?? 0) * h);
            total += weights[k] ?? 0;
        }
        for (let k = 0; k < n; k += 1) {
            weights[k] = (weights[k] ?? 0) / total;
        }
        if (best.err <= 1e-12) {
            break;
        }
    }
    let hits = 0;
    for (let k = 0; k < n; k += 1) {
        let vote = 0;
        for (const s of ensemble) {
            vote += s.a * (s.p * ((input.points[k]?.[s.f] ?? 0) >= s.t ? 1 : -1));
        }
        if ((vote >= 0 ? 1 : -1) === input.labels[k]) {
            hits += 1;
        }
    }
    return hits / n;
}

describe("AdaBoost", () => {
    it("matches a brute-force reference and learns separable data", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        const n = Math.min(input.points.length, input.labels.length);
        checkFrames(frames, n);
        const final = frames[frames.length - 1];
        expect(Number(final?.meta["accuracy"])).toBeCloseTo(referenceAccuracy(input), 5);
        expect(Number(final?.meta["accuracy"])).toBe(1);
    });

    it("keeps weights normalized and errors below one half", () => {
        const input: Input = {
            points: [
                [1, 1], [2, 3], [3, 1], [4, 3], [5, 1], [6, 3],
                [1, 5], [2, 7], [3, 5], [4, 7],
            ],
            labels: [1, 1, -1, -1, 1, 1, -1, -1, 1, -1],
            rounds: 6,
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        for (const frame of frames.slice(1, -1)) {
            expect(Number(frame.meta["weightSum"])).toBeCloseTo(1, 4);
            expect(Number(frame.meta["weightedError"])).toBeLessThan(0.5);
            expect(Number(frame.meta["alpha"])).toBeGreaterThan(0);
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
