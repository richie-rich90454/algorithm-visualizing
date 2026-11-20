/**
 * hotstuff-consensus.test.ts - Quorum logic, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./hotstuff-consensus";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], nodes: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(nodes);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("HotStuff three-phase view", () => {
    it("uses quorum two f plus one and decides when a quorum is live", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 4);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["n"]).toBe(4);
        expect(final?.["f"]).toBe(1);
        expect(final?.["quorum"]).toBe(3);
        expect(final?.["certificates"]).toBe(3);
        expect(final?.["decided"]).toBe(true);
    });

    it("does not decide when too many replicas are crashed", () => {
        const frames = [...mod.run({ nodes: 4, crash: [0, 1], value: "block-1" })];
        checkFrames(frames, 4);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["alive"]).toBe(2);
        expect(final?.["decided"]).toBe(false);
        expect(final?.["certificates"]).toBe(0);
    });

    it("scales the quorum to a seven-replica cluster", () => {
        const frames = [...mod.run({ nodes: 7, crash: -1, value: "x" })];
        checkFrames(frames, 7);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["f"]).toBe(2);
        expect(final?.["quorum"]).toBe(5);
        expect(final?.["decided"]).toBe(true);
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
