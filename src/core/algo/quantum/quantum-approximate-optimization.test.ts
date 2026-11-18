/**
 * quantum-approximate-optimization.test.ts - Independent complex state-vector
 * reference, norm and bound properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-approximate-optimization";
import type { VisualFrame } from "@/types";

type Edge = [number, number];

function costOf(index: number, edges: Edge[]): number {
    let cost = 0;
    for (const [u, v] of edges) {
        if (((index >> u) & 1) !== ((index >> v) & 1)) {
            cost += 1;
        }
    }
    return cost;
}

/** Independent complex state-vector QAOA simulation. */
function reference(
    qubits: number,
    edges: Edge[],
    gamma: number,
    beta: number,
    layers: number,
): { re: number[]; im: number[]; probabilities: number[]; expectedCut: number } {
    const n = 1 << qubits;
    const re = new Array<number>(n).fill(0);
    const im = new Array<number>(n).fill(0);
    re[0] = 1;
    const uniform = 1 / Math.sqrt(n);
    for (let i = 0; i < n; i += 1) {
        re[i] = uniform;
    }

    const costs = Array.from({ length: n }, (_, i) => costOf(i, edges));
    for (let layer = 0; layer < layers; layer += 1) {
        for (let i = 0; i < n; i += 1) {
            const angle = gamma * costs[i]!;
            const cr = Math.cos(angle);
            const ci = -Math.sin(angle);
            const ar = re[i]!;
            const ai = im[i]!;
            re[i] = ar * cr - ai * ci;
            im[i] = ar * ci + ai * cr;
        }
        const cb = Math.cos(beta);
        const sb = Math.sin(beta);
        for (let qubit = 0; qubit < qubits; qubit += 1) {
            const bit = 1 << qubit;
            for (let i = 0; i < n; i += 1) {
                if ((i & bit) !== 0) {
                    continue;
                }
                const j = i | bit;
                const ar = re[i]!;
                const ai = im[i]!;
                const br = re[j]!;
                const bi = im[j]!;
                re[i] = cb * ar + sb * bi;
                im[i] = cb * ai - sb * br;
                re[j] = cb * br + sb * ai;
                im[j] = cb * bi - sb * ar;
            }
        }
    }
    const probabilities = re.map((value, i) => value * value + im[i]! * im[i]!);
    const expectedCut = probabilities.reduce((sum, probability, i) => sum + probability * costs[i]!, 0);
    return { re, im, probabilities, expectedCut };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("quantum approximate optimization (exact small simulator)", () => {
    it("matches an independent complex state-vector reference", () => {
        const cases: Array<{ qubits: number; edges: Edge[]; gamma: number; beta: number; layers: number }> = [
            { qubits: 2, edges: [[0, 1]], gamma: 0.4, beta: 0.7, layers: 1 },
            { qubits: 3, edges: [[0, 1], [1, 2], [2, 0]], gamma: 0.5, beta: 0.5, layers: 1 },
            { qubits: 3, edges: [[0, 1], [1, 2], [2, 0]], gamma: 0.9, beta: 0.3, layers: 2 },
            { qubits: 4, edges: [[0, 1], [2, 3], [1, 3]], gamma: 0.6, beta: 0.2, layers: 1 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            const n = 1 << testCase.qubits;
            checkFrames(frames, n);
            const want = reference(testCase.qubits, testCase.edges, testCase.gamma, testCase.beta, testCase.layers);
            const last = frames[frames.length - 1]?.meta;
            const gotRe = last?.["amplitudesRe"] as number[];
            const gotIm = last?.["amplitudesIm"] as number[];
            const gotProbabilities = last?.["probabilities"] as number[];
            for (let i = 0; i < n; i += 1) {
                expect(gotRe[i]).toBeCloseTo(want.re[i]!, 12);
                expect(gotIm[i]).toBeCloseTo(want.im[i]!, 12);
                expect(gotProbabilities[i]).toBeCloseTo(want.probabilities[i]!, 12);
            }
            expect(Number(last?.["expectedCut"])).toBeCloseTo(want.expectedCut, 12);
        }
    });

    it("keeps norm one and never exceeds the true MaxCut", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 8);
        for (const frame of frames) {
            const re = frame.meta["amplitudesRe"] as number[];
            const im = frame.meta["amplitudesIm"] as number[];
            const norm = re.reduce((sum, value, i) => sum + value * value + im[i]! * im[i]!, 0);
            expect(norm).toBeCloseTo(1, 12);
            const probabilities = frame.meta["probabilities"] as number[];
            expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12);
        }
        const last = frames[frames.length - 1]?.meta;
        const maxCut = Number(last?.["maxCut"]);
        expect(Number(last?.["expectedCut"])).toBeLessThanOrEqual(maxCut + 1e-12);
        expect(Number(last?.["bestCut"])).toBeLessThanOrEqual(maxCut);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
