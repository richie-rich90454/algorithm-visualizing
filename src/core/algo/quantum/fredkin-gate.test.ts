/**
 * fredkin-gate.test.ts - Truth-table permutation, conservation, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./fredkin-gate";
import type { VisualFrame } from "@/types";

/** Independent Fredkin definition from its truth table. */
function refFredkin(state: number): number {
    const c = (state >> 2) & 1;
    const a = (state >> 1) & 1;
    const b = state & 1;
    if (c === 0 || a === b) return state;
    return (state & 4) | (b << 1) | a;
}
function popcount(x: number): number {
    return ((x >> 0) & 1) + ((x >> 1) & 1) + ((x >> 2) & 1);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(10);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("Fredkin gate", () => {
    it("matches the truth table permutation for all eight inputs", () => {
        for (let state = 0; state < 8; state += 1) {
            const frames = [...mod.run({ state })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["output"]).toBe(refFredkin(state));
            expect(popcount(state)).toBe(popcount(refFredkin(state)));
        }
    });

    it("is an involution and conserves weight on every node", () => {
        for (let state = 0; state < 8; state += 1) {
            expect(refFredkin(refFredkin(state))).toBe(state);
            const frames = [...mod.run({ state })];
            const nodes = frames[0]?.entities ?? [];
            for (const node of nodes) {
                const index = node.metadata["index"] as number;
                expect(node.metadata["mapped"]).toBe(refFredkin(index));
                expect(node.metadata["weight"]).toBe(popcount(index));
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(10);
        expect(generator.next().done).toBe(true);
    });
});
