import { describe, expect, it } from "vitest";
import mod from "./katz-centrality";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Solve (I - alpha A) x = beta by independent Gaussian elimination. */
function linearSolution(edges: Array<[string, string]>, alpha: number, beta: number): Map<string, number> {
    const labels = [...new Set(edges.flatMap(([a, b]) => [a, b]))].sort();
    const n = labels.length;
    const matrix = labels.map((_, i) => {
        const row = new Array<number>(n + 1).fill(0);
        for (let j = 0; j < n; j += 1) {
            row[j] = i === j ? 1 : 0;
        }
        row[n] = beta;
        return row;
    });
    for (const [a, b] of edges) {
        const i = labels.indexOf(a);
        const j = labels.indexOf(b);
        matrix[i][j] -= alpha;
        matrix[j][i] -= alpha;
    }
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) {
                pivot = row;
            }
        }
        [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];
        const divisor = matrix[col][col];
        for (let j = col; j <= n; j += 1) {
            matrix[col][j] /= divisor;
        }
        for (let row = 0; row < n; row += 1) {
            if (row === col) {
                continue;
            }
            const factor = matrix[row][col];
            for (let j = col; j <= n; j += 1) {
                matrix[row][j] -= factor * matrix[col][j];
            }
        }
    }
    return new Map(labels.map((label, index) => [label, matrix[index][n]]));
}

describe("Katz Centrality", () => {
    it("converges to the exact linear-system solution on the default graph", () => {
        const input = mod.defaultInput as { edges: Array<[string, string]>; alpha: number; beta: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const labels = meta?.["labels"] as string[];
        const centrality = meta?.["centrality"] as number[];
        const expected = linearSolution(input.edges, input.alpha, input.beta);

        labels.forEach((label, index) => {
            expect(centrality[index]).toBeCloseTo(expected.get(label) ?? 0, 8);
            expect(centrality[index]).toBeGreaterThan(0);
        });
        expect(meta?.["residual"] as number).toBeLessThan(1e-8);
        expect(meta?.["converged"]).toBe(true);
    });

    it("ranks the center of a star highest and respects the attenuation parameter", () => {
        const edges: Array<[string, string]> = [
            ["A", "C"], ["B", "C"], ["D", "C"], ["E", "C"],
        ];
        const frames = [...mod.run({ edges, alpha: 0.3, beta: 1 })];
        const meta = frames[frames.length - 1]?.meta;
        const labels = meta?.["labels"] as string[];
        const centrality = meta?.["centrality"] as number[];
        const expected = linearSolution(edges, 0.3, 1);
        labels.forEach((label, index) => expect(centrality[index]).toBeCloseTo(expected.get(label) ?? 0, 8));
        expect(centrality[labels.indexOf("C")]).toBeGreaterThan(centrality[labels.indexOf("A")]);
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
