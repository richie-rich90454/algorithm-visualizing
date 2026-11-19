/** swav.test.ts - Sinkhorn marginals and swapped-prediction loss correctness. */
import { describe, expect, it } from "vitest";
import mod from "./swav";
import type { VisualFrame } from "@/types";

interface Input {
    view1: number[][];
    view2: number[][];
    prototypes: number[][];
    temperature: number;
    sinkhornIters: number;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? 0).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 0).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("grid");
        expect(frame.meta).toBeDefined();
    });
}

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
}

function scores(views: number[][], prototypes: number[][], tau: number): number[][] {
    return views.map((v) => prototypes.map((p) => dot(v, p) / tau));
}

function sinkhorn(input: number[][], iters: number): number[][] {
    const b = input.length;
    const k = input[0]!.length;
    const q = input.map((row) => {
        const max = Math.max(...row);
        return row.map((v) => Math.exp(v - max));
    });
    for (let it = 0; it < iters; it += 1) {
        q.forEach((row) => {
            const sum = row.reduce((a, v) => a + v, 0) || 1;
            row.forEach((_v, j) => {
                row[j] = row[j]! / sum;
            });
        });
        for (let j = 0; j < k; j += 1) {
            let colSum = 0;
            q.forEach((row) => {
                colSum += row[j]!;
            });
            q.forEach((row) => {
                row[j] = (row[j]! * (b / k)) / (colSum || 1);
            });
        }
    }
    return q;
}

function logSoftmax(row: number[]): number[] {
    const max = Math.max(...row);
    const exps = row.map((v) => Math.exp(v - max));
    const total = exps.reduce((a, v) => a + v, 0);
    return exps.map((v) => Math.log(v / total));
}

function reference(input: Input) {
    const s1 = scores(input.view1, input.prototypes, input.temperature);
    const s2 = scores(input.view2, input.prototypes, input.temperature);
    const q1 = sinkhorn(s1, input.sinkhornIters);
    const q2 = sinkhorn(s2, input.sinkhornIters);
    const ls1 = s1.map(logSoftmax);
    const ls2 = s2.map(logSoftmax);
    let total = 0;
    q1.forEach((row, i) => {
        row.forEach((q, j) => {
            total += q * ls2[i]![j]! + q2[i]![j]! * ls1[i]![j]!;
        });
    });
    return { q1, q2, loss: -0.5 * total / input.view1.length };
}

describe("Swapped Assignment Clustering", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent Sinkhorn and swapped-loss computation", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const final = frames[frames.length - 1]!.meta;
        expect(Number(final["loss"])).toBeCloseTo(expected.loss, 8);
        (final["assignments"] as number[]).forEach((v, i) =>
            expect(v).toBeCloseTo(expected.q1.flat()[i]!, 8),
        );
    });

    it("enforces the Sinkhorn row and column marginals", () => {
        const frames = [...mod.run(input)];
        const frame = frames.find((f) => f.meta["assignments"] !== undefined && f.meta["sample"] !== undefined);
        expect(frame).toBeDefined();
        const rows = Number(frame!.meta["rows"]);
        const cols = Number(frame!.meta["cols"]);
        const assignment = frame!.meta["assignments"] as number[];
        const rowSum = assignment.reduce((a, v) => a + v, 0);
        expect(rowSum).toBeCloseTo(1, 8);
        const final = frames[frames.length - 1]!.meta;
        const all = final["assignments"] as number[];
        for (let j = 0; j < cols; j += 1) {
            let colSum = 0;
            for (let i = 0; i < rows; i += 1) {
                colSum += all[i * cols + j]!;
            }
            expect(colSum).toBeCloseTo(rows / cols, 6);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
