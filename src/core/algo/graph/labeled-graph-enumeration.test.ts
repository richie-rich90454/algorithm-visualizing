/**
 * labeled-graph-enumeration.test.ts - Completeness and uniqueness of the
 * enumeration against the 2^(n choose 2) formula, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./labeled-graph-enumeration";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("Labeled Graph Enumeration", () => {
    it("enumerates every bit pattern exactly once with correct edge counts", () => {
        for (const n of [1, 2, 3, 4]) {
            const frames = [...mod.run({ vertices: n })];
            checkFrames(frames);
            const total = Number(frames[0]?.meta["total"]);
            const pairs = (n * (n - 1)) / 2;
            expect(total).toBe(1 << pairs);
            expect(frames.length).toBe(total + 2);
            const bits: string[] = [];
            for (let i = 1; i <= total; i += 1) {
                const frame = frames[i];
                const pattern = String(frame?.meta["bits"]);
                bits.push(pattern);
                const ones = pattern.split("").filter((c) => c === "1").length;
                expect(Number(frame?.meta["edgeCount"])).toBe(ones);
                expect(frame?.entities.length).toBe(n);
            }
            expect(new Set(bits).size).toBe(total);
            for (let mask = 0; mask < total; mask += 1) {
                expect(bits).toContain(mask.toString(2).padStart(pairs, "0"));
            }
        }
    });

    it("clamps large vertex counts and terminates", () => {
        const frames = [...mod.run({ vertices: 8 })];
        checkFrames(frames);
        expect(frames[0]?.meta["vertices"]).toBe(5);
        expect(frames.length).toBe((1 << 10) + 2);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
