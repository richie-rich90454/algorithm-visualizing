/**
 * coordinate-descent.test.ts - Independent sweep reference, direct solve cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./coordinate-descent";
import type { VisualFrame } from "@/types";

function objective(q: number[][], b: number[], x: number[]): number {
    let quad = 0;
    let linear = 0;
    for (let i = 0; i < x.length; i += 1) {
        linear += (b[i] ?? 0) * (x[i] ?? 0);
        for (let j = 0; j < x.length; j += 1) quad += (x[i] ?? 0) * (q[i]![j] ?? 0) * (x[j] ?? 0);
    }
    return 0.5 * quad - linear;
}

function gradient(q: number[][], b: number[], x: number[]): number[] {
    return x.map((_, i) => {
        let g = -(b[i] ?? 0);
        for (let j = 0; j < x.length; j += 1) g += (q[i]![j] ?? 0) * (x[j] ?? 0);
        return g;
    });
}

function reference(q: number[][], b: number[], iterations: number, tolerance: number) {
    const n = q.length;
    const x = new Array<number>(n).fill(0);
    const trace: number[][] = [];
    for (let sweep = 0; sweep < iterations; sweep += 1) {
        for (let i = 0; i < n; i += 1) {
            let sum = b[i] ?? 0;
            for (let j = 0; j < n; j += 1) if (j !== i) sum -= (q[i]![j] ?? 0) * (x[j] ?? 0);
            x[i] = sum / (q[i]![i] ?? 1);
            trace.push([...x]);
            if (gradient(q, b, x).every((g) => Math.abs(g) < tolerance)) return { x, trace };
        }
    }
    return { x, trace };
}

function directSolve(q: number[][], b: number[]): number[] {
    const n = q.length;
    const aug = q.map((row, i) => [...row, b[i]!]);
    for (let c = 0; c < n; c += 1) {
        let p = c;
        for (let i = c + 1; i < n; i += 1) if (Math.abs(aug[i]![c]!) > Math.abs(aug[p]![c]!)) p = i;
        [aug[c], aug[p]] = [aug[p]!, aug[c]!];
        for (let i = c + 1; i < n; i += 1) {
            const f = aug[i]![c]! / aug[c]![c]!;
            for (let j = c; j <= n; j += 1) aug[i]![j]! -= f * aug[c]![j]!;
        }
    }
    const x = new Array<number>(n).fill(0);
    for (let i = n - 1; i >= 0; i -= 1) {
        let s = aug[i]![n]!;
        for (let j = i + 1; j < n; j += 1) s -= aug[i]![j]! * x[j]!;
        x[i] = s / aug[i]![i]!;
    }
    return x;
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
        expect((frame.meta["x"] as number[]).length).toBe(n);
        expect(typeof frame.meta["objective"]).toBe("number");
    });
}

describe("CoordinateDescent", () => {
    it("matches an independent coordinate sweep and a direct solve", () => {
        const cases: Array<{ q: number[][]; b: number[] }> = [
            {
                q: [
                    [4, 1],
                    [1, 3],
                ],
                b: [1, 2],
            },
            {
                q: [
                    [5, 1, 0],
                    [1, 4, 1],
                    [0, 1, 6],
                ],
                b: [3, 5, 2],
            },
        ];
        for (const { q, b } of cases) {
            const frames = [...mod.run({ q, b, iterations: 80, tolerance: 1e-12 })];
            checkFrames(frames, q.length);
            const expected = reference(q, b, 80, 1e-12);
            const updates = frames.filter((frame) => frame.codeLineNumber === 3);
            expect(updates.length).toBe(expected.trace.length);
            updates.forEach((frame, i) => {
                (frame.meta["x"] as number[]).forEach((value, j) =>
                    expect(value).toBeCloseTo(expected.trace[i]![j]!, 10),
                );
            });
            const finalX = frames[frames.length - 1]?.meta["x"] as number[];
            const direct = directSolve(q, b);
            finalX.forEach((value, j) => expect(value).toBeCloseTo(direct[j]!, 9));
            expect(gradient(q, b, finalX).every((g) => Math.abs(g) < 1e-8)).toBe(true);
        }
    });

    it("the objective never increases", () => {
        const q = [
            [4, 1],
            [1, 3],
        ];
        const b = [1, 2];
        const frames = [...mod.run({ q, b, iterations: 30, tolerance: 1e-12 })];
        const values = frames.map((frame) => frame.meta["objective"] as number);
        for (let i = 1; i < values.length; i += 1) {
            expect(values[i]!).toBeLessThanOrEqual(values[i - 1]! + 1e-12);
        }
        const x = frames[frames.length - 1]?.meta["x"] as number[];
        expect(x[0]!).toBeCloseTo(1 / 11, 9);
        expect(x[1]!).toBeCloseTo(7 / 11, 9);
        expect(objective(q, b, x)).toBeLessThanOrEqual(objective(q, b, [0, 0]));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
