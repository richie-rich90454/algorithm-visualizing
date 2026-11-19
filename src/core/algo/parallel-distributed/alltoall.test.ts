/**
 * alltoall.test.ts - Independent exchange reference, delivery property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./alltoall";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], p: number): void {
    const pairCount = (p * (p - 1)) / 2;
    expect(frames.length).toBe(pairCount + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["rows"]).toBe(p);
        expect(frame.meta["cols"]).toBe(p);
        expect(frame.entities.length).toBe(p * p);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect((frame.meta["sent"] as number[]).length).toBe(p * p);
        expect((frame.meta["received"] as number[]).length).toBe(p * p);
    });
}

describe("AllToAll", () => {
    it("delivers every personalized message to its destination", () => {
        for (const p of [2, 3, 4, 6, 8]) {
            const frames = [...mod.run({ p })];
            checkFrames(frames, p);
            const final = frames[frames.length - 1]?.meta;
            const sent = final?.["sent"] as number[];
            const received = final?.["received"] as number[];
            expect(final?.["pairs"]).toBe((p * (p - 1)) / 2);
            expect(final?.["complete"]).toBe(true);
            for (let i = 0; i < p; i += 1) {
                for (let j = 0; j < p; j += 1) {
                    if (i === j) continue;
                    expect(received[j * p + i]).toBe(sent[i * p + j]);
                }
            }
        }
    });

    it("keeps every message distinct", () => {
        const final = [...mod.run({ p: 5 })].pop()?.meta;
        const sent = (final?.["sent"] as number[]).filter((value) => value !== 0);
        expect(new Set(sent).size).toBe(sent.length);
        expect(sent.length).toBe(5 * 4);
    });

    it("clamps an out-of-range process count", () => {
        const frames = [...mod.run({ p: 1 })];
        checkFrames(frames, 2);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["p"]).toBe(2);
        expect(final?.["complete"]).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(8);
        expect(generator.next().done).toBe(true);
    });
});
