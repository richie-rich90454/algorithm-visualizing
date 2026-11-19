/**
 * uniform-broadcast.test.ts - Threshold decision, uniformity, edge validity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./uniform-broadcast";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities).toHaveLength(n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const ids = new Set(frame.entities.map((e) => e.id));
        frame.edges.forEach((edge) => {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        });
    });
}

describe("UniformBroadcast", () => {
    it("delivers with an honest sender and enough correct echoes", () => {
        const frames = [...mod.run({ processes: 4, faults: 1, senderHonest: true })];
        checkFrames(frames, 4);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["threshold"]).toBe(3);
        expect(final?.["echoCount"]).toBe(3);
        expect(final?.["deliver"]).toBe(true);
        expect(final?.["uniform"]).toBe(true);
        expect(final?.["reached"]).toEqual([1, 2, 3]);
    });

    it("does not deliver when a faulty sender reaches too few processes", () => {
        const frames = [...mod.run({ processes: 4, faults: 1, senderHonest: false, deliveredTo: 2 })];
        checkFrames(frames, 4);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["echoCount"]).toBe(2);
        expect(final?.["deliver"]).toBe(false);
        expect(final?.["uniform"]).toBe(true);
    });

    it("delivers uniformly even from a faulty sender that reaches the threshold", () => {
        const frames = [...mod.run({ processes: 4, faults: 1, senderHonest: false, deliveredTo: 3 })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["deliver"]).toBe(true);
        // Uniformity means every correct process shares one decision state (the sender is excluded).
        const states = new Set(
            frames[frames.length - 1]?.entities.filter((e) => e.id !== "p-0").map((e) => e.state),
        );
        expect(states.size).toBe(1);
    });

    it("uses a threshold of two f plus one across sizes", () => {
        for (const n of [4, 7]) {
            const frames = [...mod.run({ processes: n, faults: 1, senderHonest: true })];
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["threshold"]).toBe(3);
            expect(final?.["deliver"]).toBe(true);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
