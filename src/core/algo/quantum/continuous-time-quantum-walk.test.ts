/**
 * continuous-time-quantum-walk.test.ts - Matrix-exponential cross-check,
 * symmetry and norm properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./continuous-time-quantum-walk";
import type { VisualFrame } from "@/types";

type C = [number, number];

const cMul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cAdd = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];

function cMatMul(a: C[][], b: C[][]): C[][] {
    const n = a.length;
    const out: C[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => [0, 0] as C));
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            let acc: C = [0, 0];
            for (let k = 0; k < n; k += 1) acc = cAdd(acc, cMul(a[i]![k]!, b[k]![j]!));
            out[i]![j] = acc;
        }
    }
    return out;
}

/** Independent exp(-i A t) by Taylor series after scaling and squaring. */
function matrixExponential(sites: number, t: number): C[][] {
    const scalings = 6;
    const factor = t / 2 ** scalings;
    const b: C[][] = Array.from({ length: sites }, (_, r) =>
        Array.from({ length: sites }, (_, c) => [0, r === c + 1 || r + 1 === c ? -factor : 0] as C),
    );
    let term: C[][] = Array.from({ length: sites }, (_, r) =>
        Array.from({ length: sites }, (_, c) => [r === c ? 1 : 0, 0] as C),
    );
    let sum = term.map((row) => row.map((z) => [...z] as C));
    let factorial = 1;
    for (let n = 1; n <= 24; n += 1) {
        term = cMatMul(term, b);
        factorial *= n;
        for (let i = 0; i < sites; i += 1) {
            for (let j = 0; j < sites; j += 1) {
                const z = term[i]![j]!;
                sum[i]![j] = cAdd(sum[i]![j]!, [z[0] / factorial, z[1] / factorial]);
            }
        }
    }
    for (let s = 0; s < scalings; s += 1) sum = cMatMul(sum, sum);
    return sum;
}

function checkFrames(frames: VisualFrame[], sites: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(sites);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const amps = frame.meta["amplitudes"] as number[];
        expect(amps.length).toBe(sites * 2);
        const norm = amps.reduce((acc, _, i) => (i % 2 === 0 ? acc + amps[i]! ** 2 + amps[i + 1]! ** 2 : acc), 0);
        expect(norm).toBeCloseTo(1, 9);
    });
}

describe("ContinuousTimeQuantumWalk", () => {
    it("matches an independently computed matrix exponential", () => {
        const sites = 7;
        const time = 0.9;
        const frames = [...mod.run({ sites, time, steps: 4, start: 3 })];
        checkFrames(frames, sites);
        const exact = matrixExponential(sites, time);
        const final = frames[frames.length - 1]!.meta["amplitudes"] as number[];
        for (let j = 0; j < sites; j += 1) {
            expect(final[2 * j]).toBeCloseTo(exact[j]![3]![0], 9);
            expect(final[2 * j + 1]).toBeCloseTo(exact[j]![3]![1], 9);
        }
    });

    it("keeps a center-started distribution symmetric and normalized at every snapshot", () => {
        const frames = [...mod.run({ sites: 7, time: 1.3, steps: 5, start: 3 })];
        checkFrames(frames, 7);
        for (const frame of frames) {
            const probs = frame.meta["probabilities"] as number[];
            for (let j = 0; j < 3; j += 1) expect(probs[j]).toBeCloseTo(probs[6 - j]!, 10);
            expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
        }
    });

    it("clamps the path size to an odd number in the supported range", () => {
        const frames = [...mod.run({ sites: 2, time: 0.4, steps: 1, start: 9 })];
        checkFrames(frames, 3);
        expect(frames[frames.length - 1]!.meta["sites"]).toBe(3);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
