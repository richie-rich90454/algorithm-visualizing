/**
 * speculative-decoding.test.ts - Independent greedy-decoding reference,
 * rejection-location property, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./speculative-decoding";
import type { VisualFrame } from "@/types";

function greedy(start: number, transitions: Record<string, number>, length: number): number[] {
    let current = start;
    const output: number[] = [];
    for (let i = 0; i < length; i += 1) {
        const next = transitions[String(current)] ?? 0;
        output.push(next);
        current = next;
    }
    return output;
}

function checkFrames(frames: VisualFrame[], draftLength: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(draftLength);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["draft"]).toBeDefined();
    });
}

describe("SpeculativeDecoding", () => {
    it("emits exactly the target model's greedy sequence on many cases", () => {
        const cases: Array<{ start: number; draft: number[]; transitions: Record<string, number> }> = [
            { start: 0, draft: [3, 5, 2, 7], transitions: { "0": 3, "3": 5, "5": 6, "6": 8, "8": 1 } },
            { start: 0, draft: [3, 5, 6, 8], transitions: { "0": 3, "3": 5, "5": 6, "6": 8, "8": 1 } },
            { start: 4, draft: [1, 9, 2], transitions: { "4": 1, "1": 9, "9": 2, "2": 7 } },
            { start: 2, draft: [5, 5, 5, 5], transitions: { "2": 5, "5": 6 } },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.draft.length);
            const final = frames[frames.length - 1]?.meta;
            const output = final?.["output"] as number[];
            const expected = greedy(input.start, input.transitions, output.length);
            expect(output).toEqual(expected);
        }
    });

    it("rejects at exactly the first draft token that differs from greedy", () => {
        for (let mismatch = 0; mismatch < 4; mismatch += 1) {
            const transitions: Record<string, number> = { "0": 1, "1": 2, "2": 3, "3": 4, "4": 5 };
            const correct = greedy(0, transitions, 4);
            const draft = correct.slice();
            draft[mismatch] = 99;
            const final = [...mod.run({ start: 0, draft, transitions })].pop()?.meta;
            const expectedReject = draft.findIndex((token, i) => token !== correct[i]);
            expect(final?.["rejected"]).toBe(true);
            expect(final?.["acceptedCount"]).toBe(expectedReject);
            expect(final?.["output"]).toEqual(greedy(0, transitions, expectedReject + 1));
        }
    });

    it("reports no rejection when the draft is fully correct", () => {
        const transitions = { "0": 1, "1": 2, "2": 3, "3": 4 };
        const final = [...mod.run({ start: 0, draft: [1, 2, 3, 4], transitions })].pop()?.meta;
        expect(final?.["rejected"]).toBe(false);
        expect(final?.["acceptedCount"]).toBe(4);
        expect(final?.["output"]).toEqual([1, 2, 3, 4]);
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
