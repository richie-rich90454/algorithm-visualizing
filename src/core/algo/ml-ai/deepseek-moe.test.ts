/** deepseek-moe.test.ts - Brute-force routing, capacity, combine, frames, termination. */
import { describe, expect, it } from "vitest";
import mod, { combineMoE, routeMoE } from "./deepseek-moe";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("DeepSeekMoE", () => {
    it("selects the brute-force top-k routed experts with stable ties", () => {
        const scores = [0.1, 2.0, 1.5, 1.5, 0.3, 0.2];
        const route = routeMoE(scores, 2, [0], new Array(6).fill(0), 5);
        const expected = scores
            .map((score, index) => ({ score, index }))
            .filter((e) => e.index !== 0)
            .sort((a, b) => b.score - a.score || a.index - b.index)
            .slice(0, 2)
            .map((e) => e.index);
        expect(route.selected).toEqual(expected);
        expect(route.shared).toEqual([0]);
        expect(route.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    });

    it("enforces capacity and drops overflowed experts", () => {
        const scores = [0.1, 5, 4, 3, 0.2];
        const first = routeMoE(scores, 2, [], new Array(5).fill(0), 1);
        expect(first.selected).toEqual([1, 2]);
        const used = [0, 1, 1, 0, 0];
        const second = routeMoE(scores, 2, [], used, 1);
        expect(second.selected).toEqual([3, 4]);
        expect(second.dropped).toContain(1);
        expect(second.dropped).toContain(2);
    });

    it("combines shared and routed vectors to match a direct sum", () => {
        const vectors = [[1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [1, -1]];
        const route = routeMoE([0.1, 2, 1.5, 0.3, 0.8, 0.2], 2, [0], new Array(6).fill(0), 5);
        const got = combineMoE(route, vectors, 0.5);
        const expected = [0, 0];
        for (const i of route.shared) {
            expected[0] += 0.5 * (vectors[i]?.[0] ?? 0);
            expected[1] += 0.5 * (vectors[i]?.[1] ?? 0);
        }
        route.selected.forEach((i, r) => {
            const w = route.weights[r] ?? 0;
            expected[0] += w * (vectors[i]?.[0] ?? 0);
            expected[1] += w * (vectors[i]?.[1] ?? 0);
        });
        got.forEach((v, j) => expect(v).toBeCloseTo(expected[j] ?? 0, 10));
    });

    it("emits well-formed frames and terminates", () => {
        const input = mod.defaultInput as Record<string, unknown>;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
