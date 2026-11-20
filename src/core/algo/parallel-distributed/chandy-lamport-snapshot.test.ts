/**
 * chandy-lamport-snapshot.test.ts - Snapshot conservation, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./chandy-lamport-snapshot";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect((frame.meta["recorded"] as number[]).length).toBe(n);
    });
}

describe("ChandyLamportSnapshot", () => {
    it("captures each local value exactly once for several value sets", () => {
        const cases = [
            [4, 7, 2, 5],
            [0, 0, 0],
            [10, -3, 8, 1, 6],
            [1],
        ];
        for (const values of cases) {
            const frames = [...mod.run({ values })];
            checkFrames(frames, values.length);
            const final = frames[frames.length - 1]?.meta;
            const recorded = final?.["recorded"] as number[];
            expect([...recorded].sort((a, b) => a - b)).toEqual([...values].sort((a, b) => a - b));
            const expectedSum = values.reduce((a, b) => a + b, 0);
            expect(final?.["snapshotSum"]).toBe(expectedSum);
            expect(final?.["markersSent"]).toBe(values.length);
        }
    });

    it("records one new process per marker frame", () => {
        const frames = [...mod.run({ values: [1, 2, 3] })];
        checkFrames(frames, 3);
        const recording = frames.filter((f) => f.meta["phase"] === "recording");
        expect(recording.length).toBe(3);
        expect(recording[2]?.meta["markersSent"]).toBe(3);
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
