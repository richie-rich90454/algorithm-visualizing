/**
 * rumor-mongering.test.ts - Monotonic knowledge, convergence, edge validity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./rumor-mongering";
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

describe("RumorMongering", () => {
    it("never increases the missing count and eventually converges", () => {
        const n = 8;
        const rumors = 5;
        const frames = [...mod.run({ processes: n, rumors, rounds: 16, fanout: 3, seed: 7 })];
        checkFrames(frames, n);
        let previousMissing = Infinity;
        for (const frame of frames) {
            const missing = frame.meta["missing"] as number;
            expect(missing).toBeLessThanOrEqual(previousMissing);
            const counts = frame.meta["knownCounts"] as number[];
            counts.forEach((c) => expect(c).toBeLessThanOrEqual(rumors));
            previousMissing = missing;
        }
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["missing"]).toBe(0);
        expect(final?.["converged"]).toBe(true);
        expect(final?.["knownCounts"]).toEqual(Array(n).fill(rumors));
    });

    it("is deterministic for a fixed seed", () => {
        const input = { processes: 6, rumors: 4, rounds: 5, fanout: 2, seed: 42 };
        const a = [...mod.run(input)].map((f) => f.meta["knownCounts"]);
        const b = [...mod.run(input)].map((f) => f.meta["knownCounts"]);
        expect(a).toEqual(b);
    });

    it("reports knowledge growth one merge at a time", () => {
        const frames = [...mod.run({ processes: 4, rumors: 4, rounds: 1, fanout: 1, seed: 1 })];
        const initial = frames[0]?.meta["missing"] as number;
        const afterOne = frames[1]?.meta["missing"] as number;
        expect(afterOne).toBeLessThan(initial);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(10);
        expect(generator.next().done).toBe(true);
    });
});
