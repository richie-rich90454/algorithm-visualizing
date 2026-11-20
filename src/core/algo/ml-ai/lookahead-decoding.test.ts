/**
 * lookahead-decoding.test.ts - Verification property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./lookahead-decoding";
import type { VisualFrame } from "@/types";

function greedyNext(token: number, vocab: number, a: number, b: number): number {
    return (((token * a + b) % vocab) + vocab) % vocab;
}

/** Independently compute the longest accepted prefix and the correction. */
function reference(start: number, draft: number[], vocab: number, a: number, b: number) {
    let cursor = start;
    const accepted: number[] = [];
    let divergence = draft.length;
    for (let i = 0; i < draft.length; i += 1) {
        const want = greedyNext(cursor, vocab, a, b);
        if (draft[i] === want) {
            accepted.push(want);
            cursor = want;
        } else {
            divergence = i;
            break;
        }
    }
    const correction = greedyNext(cursor, vocab, a, b);
    return { accepted, correction, output: [...accepted, correction], divergence };
}

function checkFrames(frames: VisualFrame[], window: number): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4 * window);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("LookaheadDecoding", () => {
    it("accepts exactly the greedy prefix and appends one correction", () => {
        const cases = [
            { start: 2, draft: [7, 2, 3, 8, 1], vocab: 10, a: 3, b: 1 },
            { start: 0, draft: [1, 2, 3], vocab: 10, a: 1, b: 1 },
            { start: 4, draft: [8, 7, 6, 5], vocab: 11, a: 2, b: 3 },
            { start: 1, draft: [4, 4, 4, 4], vocab: 7, a: 5, b: 2 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.draft.length);
            const expected = reference(input.start, input.draft, input.vocab, input.a, input.b);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["accepted"]).toEqual(expected.accepted);
            expect(meta?.["correction"]).toBe(expected.correction);
            expect(meta?.["output"]).toEqual(expected.output);
        }
    });

    it("accepts the entire window when every guess is correct", () => {
        const input = { start: 0, draft: [1, 2, 3, 4], vocab: 10, a: 1, b: 1 };
        const frames = [...mod.run(input)];
        checkFrames(frames, 4);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["accepted"]).toEqual([1, 2, 3, 4]);
        expect(meta?.["output"]).toEqual([1, 2, 3, 4, 5]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
