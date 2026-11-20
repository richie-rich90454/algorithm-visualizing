/**
 * baum-welch-algorithm.test.ts - Brute-force posterior check, EM monotonicity,
 * frame-shape checks, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./baum-welch-algorithm";
import type { VisualFrame } from "@/types";

interface Model {
    pi: number[];
    A: number[][];
    B: number[][];
}

/** Enumerate every hidden state path to compute exact posteriors and likelihood. */
function bruteForce(model: Model, obs: number[]) {
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
    return { gamma, xi, logLikelihood: Math.log(probability > 0 ? probability : Number.MIN_VALUE) };
}

function close(a: number, b: number): boolean {
    return Math.abs(a - b) < 1e-8;
}

function checkFrames(frames: VisualFrame[], K: number, T: number): void {
    expect(frames.length).toBeGreaterThanOrEqual(4);
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

describe("BaumWelchAlgorithm", () => {
    it("matches brute-force forward-backward posteriors on the initial E-step", () => {
        const model: Model = {
            pi: [0.6, 0.4],
            A: [
                [0.7, 0.3],
                [0.4, 0.6],
            ],
            B: [
                [0.5, 0.5],
                [0.1, 0.9],
            ],
        };
        const obs = [0, 1, 1];
        const frames = [...mod.run({ ...model, observations: obs, iterations: 1 })];
        checkFrames(frames, model.pi.length, obs.length);

        const eStep = frames[1];
        const K = model.pi.length;
        const T = obs.length;
        const gammaFlat = eStep?.meta.gamma as number[];
        const xiFlat = eStep?.meta.xi as number[];
        const expected = bruteForce(model, obs);

        for (let t = 0; t < T; t += 1) {
            for (let i = 0; i < K; i += 1) {
                expect(close(gammaFlat[t * K + i] as number, expected.gamma[t]![i] as number)).toBe(true);
            }
        }
        for (let t = 0; t < T - 1; t += 1) {
            for (let i = 0; i < K; i += 1) {
                for (let j = 0; j < K; j += 1) {
                    expect(
                        close(xiFlat[t * K * K + i * K + j] as number, expected.xi[t]![i]![j] as number),
                    ).toBe(true);
                }
            }
        }
        expect(close(Number(eStep?.meta.logLikelihood), expected.logLikelihood)).toBe(true);
    });

    it("never decreases the log-likelihood across iterations", () => {
        const model = mod.defaultInput as Model & { observations: number[]; iterations: number };
        const frames = [...mod.run({ ...model, iterations: 6 })];
        const likelihoods: number[] = [];
        for (const frame of frames) {
            if (frame.meta.logLikelihood !== undefined) {
                likelihoods.push(Number(frame.meta.logLikelihood));
            }
        }
        expect(likelihoods.length).toBeGreaterThanOrEqual(6);
        for (let i = 1; i < likelihoods.length; i += 1) {
            expect(likelihoods[i] as number).toBeGreaterThanOrEqual((likelihoods[i - 1] as number) - 1e-9);
        }
    });

    it("produces rows that sum to one in every E-step", () => {
        const model = mod.defaultInput as Model & { observations: number[]; iterations: number };
        const frames = [...mod.run({ ...model, iterations: 3 })];
        const K = model.pi.length;
        const T = model.observations.length;
        for (const frame of frames) {
            const gamma = frame.meta.gamma;
            if (!Array.isArray(gamma)) {
                continue;
            }
            for (let t = 0; t < T; t += 1) {
                let sum = 0;
                for (let i = 0; i < K; i += 1) {
                    sum += gamma[t * K + i] as number;
                }
                expect(close(sum, 1)).toBe(true);
            }
        }
    });

    it("terminates cleanly and handles an empty observation sequence", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);

        const empty = [...mod.run({ observations: [] })];
        expect(empty.length).toBe(1);
        expect(empty[0]?.entities.length).toBe(0);
    });
});
