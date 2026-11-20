/**
 * forward-backward-algorithm.test.ts - Brute-force posterior check, sum-to-one
 * properties, frame-shape checks, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./forward-backward-algorithm";
import type { VisualFrame } from "@/types";

interface Model {
    pi: number[];
    A: number[][];
    B: number[][];
}

function brute(model: Model, obs: number[]) {
    const K = model.pi.length;
    const T = obs.length;
    const gamma = Array.from({ length: T }, () => Array<number>(K).fill(0));
    const xi = Array.from({ length: Math.max(0, T - 1) }, () =>
        Array.from({ length: K }, () => Array<number>(K).fill(0)),
    );
    let probability = 0;
    const walk = (path: number[]): void => {
        if (path.length === T) {
            let p = (model.pi[path[0] as number] ?? 0) * (model.B[path[0] as number]?.[obs[0] as number] ?? 0);
            for (let t = 1; t < T; t += 1) {
                p *= (model.A[path[t - 1] as number]?.[path[t] as number] ?? 0) *
                    (model.B[path[t] as number]?.[obs[t] as number] ?? 0);
            }
            probability += p;
            for (let t = 0; t < T; t += 1) {
                gamma[t]![path[t] as number] += p;
            }
            for (let t = 0; t < T - 1; t += 1) {
                xi[t]![path[t] as number]![path[t + 1] as number] += p;
            }
            return;
        }
        for (let s = 0; s < K; s += 1) {
            walk([...path, s]);
        }
    };
    walk([]);
    for (let t = 0; t < T; t += 1) {
        for (let i = 0; i < K; i += 1) {
            gamma[t]![i] = probability > 0 ? (gamma[t]![i] as number) / probability : 0;
        }
    }
    for (let t = 0; t < T - 1; t += 1) {
        for (let i = 0; i < K; i += 1) {
            for (let j = 0; j < K; j += 1) {
                xi[t]![i]![j] = probability > 0 ? (xi[t]![i]![j] as number) / probability : 0;
            }
        }
    }
    return { gamma, xi, probability };
}

function close(a: number, b: number): boolean {
    return Math.abs(a - b) < 1e-8;
}

function checkFrames(frames: VisualFrame[], K: number, T: number): void {
    expect(frames.length).toBeGreaterThan(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(K * T);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta.rows).toBe(K);
        expect(frame.meta.cols).toBe(T);
    });
}

describe("ForwardBackwardAlgorithm", () => {
    it("matches brute-force gamma and xi on the default model", () => {
        const input = mod.defaultInput as Model & { observations: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.pi.length, input.observations.length);

        const last = frames[frames.length - 1];
        const K = input.pi.length;
        const T = input.observations.length;
        const gammaFlat = last?.meta.gamma as number[];
        const xiFlat = last?.meta.xi as number[];
        const expected = brute(input, input.observations);

        expect(close(Number(last?.meta.probability), expected.probability)).toBe(true);
        for (let t = 0; t < T; t += 1) {
            for (let i = 0; i < K; i += 1) {
                expect(close(gammaFlat[t * K + i] as number, expected.gamma[t]![i] as number)).toBe(true);
            }
        }
        for (let t = 0; t < T - 1; t += 1) {
            for (let i = 0; i < K; i += 1) {
                for (let j = 0; j < K; j += 1) {
                    expect(close(xiFlat[t * K * K + i * K + j] as number, expected.xi[t]![i]![j] as number)).toBe(true);
                }
            }
        }
    });

    it("shows distinct forward, backward, and posterior phases", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const phases = new Set(frames.map((frame) => String(frame.meta.phase)));
        expect(phases.has("forward")).toBe(true);
        expect(phases.has("backward")).toBe(true);
        expect(phases.has("posterior")).toBe(true);
    });

    it("keeps gamma and xi rows normalized", () => {
        const input = mod.defaultInput as Model & { observations: number[] };
        const frames = [...mod.run(input)];
        const last = frames[frames.length - 1];
        const K = input.pi.length;
        const T = input.observations.length;
        const gammaFlat = last?.meta.gamma as number[];
        const xiFlat = last?.meta.xi as number[];
        for (let t = 0; t < T; t += 1) {
            let sum = 0;
            for (let i = 0; i < K; i += 1) {
                sum += gammaFlat[t * K + i] as number;
            }
            expect(close(sum, 1)).toBe(true);
        }
        for (let t = 0; t < T - 1; t += 1) {
            let sum = 0;
            for (let i = 0; i < K; i += 1) {
                for (let j = 0; j < K; j += 1) {
                    sum += xiFlat[t * K * K + i * K + j] as number;
                }
            }
            expect(close(sum, 1)).toBe(true);
        }
    });

    it("handles empty input and terminates cleanly", () => {
        const empty = [...mod.run({ observations: [] })];
        expect(empty.length).toBe(1);
        expect(empty[0]?.meta.phase).toBe("empty");
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
