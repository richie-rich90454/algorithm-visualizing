/**
 * practical-byzantine-fault-tolerance.test.ts - Independent quorum arithmetic, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./practical-byzantine-fault-tolerance";
import type { VisualFrame } from "@/types";

function digest(text: string): string {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return (h >>> 0).toString(16).padStart(8, "0");
}

function reference(replicas: number, faulty: number, request: string) {
    const quorum = 2 * faulty + 1;
    const honest = replicas - faulty;
    const safe = replicas >= 3 * faulty + 1;
    const prepared = honest >= quorum;
    return { quorum, honest, safe, prepared, decision: prepared && safe ? request : "" };
}

function checkFrames(frames: VisualFrame[], replicas: number): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(replicas);
        expect(frame.entities.length).toBe(replicas);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("PracticalByzantineFaultTolerance", () => {
    it("matches independent quorum arithmetic across configurations", () => {
        const cases: Array<[number, number, string]> = [
            [4, 1, "SET x=7"],
            [7, 2, "SET y=9"],
            [1, 0, "NOOP"],
            [5, 1, "a"],
            [3, 1, "b"],
            [2, 1, "c"],
        ];
        for (const [replicas, faulty, request] of cases) {
            const frames = [...mod.run({ replicas, faulty, request })];
            checkFrames(frames, replicas);
            const expected = reference(replicas, faulty, request);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["quorum"]).toBe(expected.quorum);
            expect(final?.["honest"]).toBe(expected.honest);
            expect(final?.["safe"]).toBe(expected.safe);
            expect(final?.["decision"]).toBe(expected.decision);
            expect(final?.["digest"]).toBe(digest(request));
            expect(frames[2]?.meta["prepares"]).toBe(expected.honest);
            expect(frames[3]?.meta["commits"]).toBe(expected.prepared ? expected.honest : 0);
        }
    });

    it("decides exactly when n is at least 3f+1", () => {
        for (let f = 0; f <= 3; f += 1) {
            const safeFrames = [...mod.run({ replicas: 3 * f + 1, faulty: f, request: "v" })];
            expect(safeFrames[safeFrames.length - 1]?.meta["decision"]).toBe("v");
            if (f >= 1) {
                const unsafeFrames = [...mod.run({ replicas: 3 * f, faulty: f, request: "v" })];
                expect(unsafeFrames[unsafeFrames.length - 1]?.meta["decision"]).toBe("");
            }
        }
    });

    it("faulty replicas are always shown red and never execute", () => {
        const frames = [...mod.run({ replicas: 7, faulty: 2, request: "v" })];
        const final = frames[frames.length - 1];
        const faultyCells = final?.entities.filter((e) => e.metadata["faulty"] === true) ?? [];
        expect(faultyCells.length).toBe(2);
        expect(faultyCells.every((e) => e.state === "error")).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
