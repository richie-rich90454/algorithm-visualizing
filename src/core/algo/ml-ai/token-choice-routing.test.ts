/** token-choice-routing.test.ts - Brute-force routing, capacity invariant, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { rankExperts, tokenChoiceRoute } from "./token-choice-routing";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("MoE Token-Choice Routing", () => {
    it("ranks experts by logit with a stable tie break", () => {
        expect(rankExperts([1, 5, 5, -2, 3])).toEqual([1, 2, 4, 0, 3]);
    });

    it("respects top-k choices and never exceeds capacity", () => {
        const logits = [
            [3, 1, 0.2],
            [2, 2.5, 0.1],
            [0.5, 3.5, 1],
            [2.2, 0.4, 2.1],
        ];
        const topK = 2;
        const capacity = 2;
        const { assignments, counts, dropped, choices } = tokenChoiceRoute(logits, topK, capacity);
        counts.forEach((count) => expect(count).toBeLessThanOrEqual(capacity));
        assignments.forEach((row, token) => {
            row.forEach((value, expert) => {
                if (value === 1) expect(choices[token]).toContain(expert);
            });
            if (dropped[token]) expect(row.every((v) => v === 0)).toBe(true);
        });
        const assignedTotal = assignments.flat().reduce((a, b) => a + b, 0);
        expect(assignedTotal).toBe(counts.reduce((a, b) => a + b, 0));
    });

    it("matches a brute-force greedy assignment", () => {
        const logits = [[5, 4], [5, 1], [5, 0], [1, 5]];
        const capacity = 1;
        const { assignments, dropped } = tokenChoiceRoute(logits, 1, capacity);
        expect(assignments[0]).toEqual([1, 0]);
        expect(assignments[1]).toEqual([0, 0]);
        expect(dropped[1]).toBe(true);
        expect(assignments[3]).toEqual([0, 1]);
    });

    it("emits well-formed frames consistent with the reference", () => {
        const input = mod.defaultInput as { logits: number[][]; topK: number; capacity: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = tokenChoiceRoute(input.logits, input.topK, input.capacity);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["counts"]).toEqual(expected.counts);
        expect(final?.["dropped"]).toEqual(expected.dropped);
        expect(final?.["assignments"]).toEqual(expected.assignments);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
