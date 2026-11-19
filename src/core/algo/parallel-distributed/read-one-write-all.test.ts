/**
 * read-one-write-all.test.ts - Replica agreement, abort atomicity, read results, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./read-one-write-all";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities).toHaveLength(n + 1);
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

describe("ReadOneWriteAll", () => {
    it("keeps all replicas equal after successful writes", () => {
        const frames = [...mod.run({ replicas: 4, operations: [{ op: "write", value: 3 }, { op: "write", value: 8 }] })];
        checkFrames(frames, 4);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["agree"]).toBe(true);
        expect(final?.["committed"]).toBe(8);
        expect(new Set(final?.["values"] as number[]).size).toBe(1);
    });

    it("leaves every replica unchanged when a write cannot reach all copies", () => {
        const frames = [...mod.run({
            replicas: 3,
            operations: [
                { op: "write", value: 5 },
                { op: "write", value: 9, down: [1] },
                { op: "read" },
            ],
        })];
        checkFrames(frames, 3);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["committed"]).toBe(5);
        expect(final?.["values"]).toEqual([5, 5, 5]);
        expect(final?.["results"]).toEqual([5]);
    });

    it("reads from a live replica even when another is down", () => {
        const frames = [...mod.run({
            replicas: 3,
            operations: [{ op: "write", value: 4 }, { op: "read", down: [0] }],
        })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["results"]).toEqual([4]);
    });

    it("reports failure when no replica is reachable", () => {
        const frames = [...mod.run({ replicas: 2, operations: [{ op: "read", down: [0, 1] }] })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["results"]).toEqual(["unavailable"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
