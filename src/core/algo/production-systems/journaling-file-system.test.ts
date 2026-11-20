/**
 * journaling-file-system.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./journaling-file-system";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Journaling file system recovery", () => {
    it("recovers exactly the committed transactions", () => {
        const cases: Array<{ pages: Record<string, number>; transactions: Array<{ id: string; committed: boolean; ops: Array<{ page: string; value: number }> }> }> = [
            {
                pages: { A: 1, B: 2, C: 0 },
                transactions: [
                    { id: "T1", committed: true, ops: [{ page: "A", value: 5 }, { page: "B", value: 8 }] },
                    { id: "T2", committed: false, ops: [{ page: "C", value: 9 }] },
                ],
            },
            {
                pages: { X: 10, Y: 20 },
                transactions: [
                    { id: "A", committed: true, ops: [{ page: "X", value: 1 }, { page: "Y", value: 2 }] },
                    { id: "B", committed: true, ops: [{ page: "X", value: 7 }] },
                    { id: "C", committed: false, ops: [{ page: "Y", value: 99 }] },
                ],
            },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = { ...input.pages };
            for (const tx of input.transactions) {
                if (tx.committed) {
                    for (const op of tx.ops) { expected[op.page] = op.value; }
                }
            }
            expect(frames[frames.length - 1]?.meta["pages"]).toEqual(expected);
        }
    });

    it("leaves pages unchanged when there are no committed transactions", () => {
        const frames = [...mod.run({ pages: { A: 3 }, transactions: [{ id: "T", committed: false, ops: [{ page: "A", value: 100 }] }] })];
        expect(frames[frames.length - 1]?.meta["pages"]).toEqual({ A: 3 });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
