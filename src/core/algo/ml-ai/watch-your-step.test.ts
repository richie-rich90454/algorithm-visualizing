/** watch-your-step.test.ts - Independent poisoning oracle, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./watch-your-step";
import type { VisualFrame } from "@/types";

interface Input {
    gradients: number[][];
    targetDirection: number[];
    labels: number[];
    targetLabel: number;
    budget: number;
}

function reference(input: Input) {
    const dot = (a: number[], b: number[]) => {
        let value = 0;
        for (let i = 0; i < Math.min(a.length, b.length); i += 1) value += (a[i] ?? 0) * (b[i] ?? 0);
        return value;
    };
    const norm = (v: number[]) => Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
    const denominatorBase = norm(input.targetDirection);
    const alignments = input.gradients.map((g) => {
        const denominator = norm(g) * denominatorBase;
        return denominator === 0 ? 0 : dot(g, input.targetDirection) / denominator;
    });
    const selected = alignments
        .map((value, index) => ({ value, index }))
        .sort((a, b) => b.value - a.value || a.index - b.index)
        .slice(0, Math.min(input.budget, alignments.length))
        .map((item) => item.index);
    const poisoned = input.labels.slice();
    selected.forEach((index) => { poisoned[index] = input.targetLabel; });
    return { alignments, selected, poisoned };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Watch Your Step", () => {
    it("matches an independent poisoning oracle", () => {
        const cases: Input[] = [
            { gradients: [[1, 0.1], [0.9, 0.2], [-1, 0.1], [-0.8, -0.2], [0.2, 1]], targetDirection: [1, 0], labels: [0, 0, 1, 1, 0], targetLabel: 1, budget: 2 },
            { gradients: [[2, 0], [0, 3], [1, 1], [-2, -2]], targetDirection: [0, 1], labels: [0, 1, 0, 1], targetLabel: 0, budget: 3 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.gradients.length);
            const expected = reference(input);
            const meta = frames[frames.length - 1]?.meta;
            (meta?.["alignments"] as number[]).forEach((value, i) => expect(value).toBeCloseTo(expected.alignments[i] ?? 0, 8));
            expect(meta?.["selected"]).toEqual(expected.selected);
            expect(meta?.["poisonedLabels"]).toEqual(expected.poisoned);
            expect(meta?.["poisonedCount"]).toBe(expected.selected.length);
        }
    });

    it("changes only the selected labels", () => {
        const input: Input = { gradients: [[1, 0], [0, 1], [-1, 0]], targetDirection: [1, 0], labels: [0, 1, 0], targetLabel: 9, budget: 1 };
        const meta = [...mod.run(input)].at(-1)?.meta;
        expect(meta?.["poisonedLabels"]).toEqual([9, 1, 0]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
