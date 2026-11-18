/**
 * randomized-kaczmarz.test.ts - Independent RNG/selection reference, projection property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./randomized-kaczmarz";
import type { VisualFrame } from "@/types";

interface Input {
    A: number[][];
    b: number[];
    iterations: number;
    seed: number;
    x0: number[];
}

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const dot = (a: number[], x: number[]) => a.reduce((s, v, j) => s + v * (x[j] ?? 0), 0);

/** Independent randomized Kaczmarz reference. */
function reference(input: Input): number[] {
    const norms = input.A.map((row) => dot(row, row));
    const weights = norms.map((v) => (v > 1e-15 ? v : 0));
    const total = weights.reduce((s, v) => s + v, 0);
    const rand = mulberry32(input.seed);
    let x = [...input.x0];
    for (let k = 0; k < input.iterations; k += 1) {
        let pick = rand() * total;
        let chosen = 0;
        for (let i = 0; i < input.A.length; i += 1) {
            pick -= weights[i]!;
            if (pick <= 0) {
                chosen = i;
                break;
            }
        }
        const row = input.A[chosen]!;
        const correction = ((input.b[chosen] ?? 0) - dot(row, x)) / (norms[chosen] ?? 1);
        x = x.map((xj, j) => xj + correction * (row[j] ?? 0));
    }
    return x;
}

function residual(A: number[][], b: number[], x: number[]): number {
    return Math.sqrt(A.reduce((sum, row, i) => {
        const r = dot(row, x) - (b[i] ?? 0);
        return sum + r * r;
    }, 0));
}

function checkFrames(frames: VisualFrame[], iterations: number, n: number): void {
    expect(frames.length).toBe(iterations + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("RandomizedKaczmarz", () => {
    it("matches an independent row-selection and projection reference", () => {
        const cases: Input[] = [
            { A: [[2, 1, 0], [1, 3, 1], [0, 1, 2]], b: [4, 6, 0], iterations: 30, seed: 1, x0: [0, 0, 0] },
            { A: [[1, 2], [3, 4], [5, 6]], b: [5, 11, 17], iterations: 20, seed: 42, x0: [0, 0] },
            { A: [[4, 0, 0], [0, 2, 0], [0, 0, 8]], b: [8, 6, -16], iterations: 12, seed: 7, x0: [1, 1, 1] },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.iterations, input.A[0]!.length);
            const final = frames[frames.length - 1]?.meta["x"] as number[];
            const expected = reference(input);
            for (let j = 0; j < input.A[0]!.length; j += 1) {
                expect(final[j]).toBeCloseTo(expected[j]!, 12);
            }
        }
    });

    it("converges to the known solution of a consistent system", () => {
        const input: Input = { A: [[2, 1, 0], [1, 3, 1], [0, 1, 2]], b: [4, 6, 0], iterations: 400, seed: 3, x0: [0, 0, 0] };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta["x"] as number[];
        expect(final[0]).toBeCloseTo(1, 5);
        expect(final[1]).toBeCloseTo(2, 5);
        expect(final[2]).toBeCloseTo(-1, 5);
        expect(residual(input.A, input.b, final)).toBeLessThan(1e-5);
    });

    it("each projection satisfies the chosen row exactly", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        for (let i = 1; i <= input.iterations; i += 1) {
            const frame = frames[i]!;
            const chosen = frame.meta["chosenRow"] as number;
            const x = frame.meta["x"] as number[];
            expect(Math.abs(dot(input.A[chosen]!, x) - (input.b[chosen] ?? 0))).toBeLessThan(1e-10);
        }
    });

    it("reduces the residual from its initial value", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        const initial = frames[0]!.meta["residual"] as number;
        const final = frames[frames.length - 1]!.meta["residual"] as number;
        expect(final).toBeLessThan(initial);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(32);
        expect(generator.next().done).toBe(true);
    });
});
