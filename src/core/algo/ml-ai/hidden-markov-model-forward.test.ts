/**
 * hidden-markov-model-forward.test.ts - Exhaustive path enumeration
 * cross-check, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./hidden-markov-model-forward";
import type { VisualFrame } from "@/types";

interface HMM {
    pi: number[];
    A: number[][];
    B: number[][];
    observations: number[];
}

function checkFrames(frames: VisualFrame[], K: number, T: number): void {
    expect(frames.length).toBe(T + 1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(K * T);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(K);
        expect(frame.meta["cols"]).toBe(T);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Sum the probability of every hidden path by brute-force enumeration. */
function enumerateAll(model: HMM): number {
    const { pi, A, B, observations } = model;
    const K = pi.length;
    const T = observations.length;
    let total = 0;
    const walk = (t: number, state: number, pathProbability: number): void => {
        if (t === 0) {
            const p = pathProbability * pi[state] * B[state][observations[0]];
            if (t === T - 1) {
                total += p;
            } else {
                for (let next = 0; next < K; next += 1) {
                    walk(t + 1, next, p * A[state][next]);
                }
            }
            return;
        }
        const p = pathProbability * B[state][observations[t]];
        if (t === T - 1) {
            total += p;
        } else {
            for (let next = 0; next < K; next += 1) {
                walk(t + 1, next, p * A[state][next]);
            }
        }
    };
    for (let s = 0; s < K; s += 1) {
        walk(0, s, 1);
    }
    return total;
}

/** Reference alpha table computed directly from the definition. */
function referenceAlpha(model: HMM): number[] {
    const { pi, A, B, observations } = model;
    const K = pi.length;
    const T = observations.length;
    const alpha: number[][] = Array.from({ length: T }, () => Array(K).fill(0));
    for (let j = 0; j < K; j += 1) alpha[0][j] = pi[j] * B[j][observations[0]];
    for (let t = 1; t < T; t += 1) {
        for (let j = 0; j < K; j += 1) {
            let sum = 0;
            for (let i = 0; i < K; i += 1) sum += alpha[t - 1][i] * A[i][j];
            alpha[t][j] = sum * B[j][observations[t]];
        }
    }
    return alpha.flat();
}

describe("HiddenMarkovModelForward", () => {
    it("matches exhaustive path enumeration on the default model", () => {
        const model = mod.defaultInput as HMM;
        const frames = [...mod.run(model)];
        checkFrames(frames, model.pi.length, model.observations.length);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["probability"])).toBeCloseTo(enumerateAll(model), 10);
    });

    it("matches enumeration across varied models and observation sequences", () => {
        const models: HMM[] = [
            {
                pi: [0.5, 0.5],
                A: [
                    [0.8, 0.2],
                    [0.3, 0.7],
                ],
                B: [
                    [0.9, 0.1],
                    [0.2, 0.8],
                ],
                observations: [0, 0, 1],
            },
            {
                pi: [0.2, 0.3, 0.5],
                A: [
                    [0.5, 0.3, 0.2],
                    [0.1, 0.6, 0.3],
                    [0.2, 0.2, 0.6],
                ],
                B: [
                    [0.7, 0.3],
                    [0.4, 0.6],
                    [0.1, 0.9],
                ],
                observations: [1, 0, 1, 0],
            },
        ];
        for (const model of models) {
            const frames = [...mod.run(model)];
            checkFrames(frames, model.pi.length, model.observations.length);
            const final = frames[frames.length - 1]?.meta;
            expect(Number(final?.["probability"])).toBeCloseTo(enumerateAll(model), 10);
            const expectedAlpha = referenceAlpha(model);
            const actualAlpha = final?.["alpha"] as number[];
            expectedAlpha.forEach((value, i) => {
                expect(actualAlpha[i]).toBeCloseTo(value, 10);
            });
        }
    });

    it("a model with one state yields the product of its emissions", () => {
        const model: HMM = { pi: [1], A: [[1]], B: [[0.25, 0.75]], observations: [0, 1, 1] };
        const frames = [...mod.run(model)];
        checkFrames(frames, 1, 3);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["probability"])).toBeCloseTo(0.25 * 0.75 * 0.75, 10);
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
