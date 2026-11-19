/**
 * conc-tree-list.test.ts - Correctness and frame checks for the conc-tree list.
 */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./conc-tree-list";

function drain(input: unknown): VisualFrame[] {
    const out: VisualFrame[] = [];
    for (const frame of mod.run(input)) out.push(frame);
    return out;
}

function checkShapes(frames: VisualFrame[]): void {
    const ids = new Set<string>();
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("tree");
        expect(frame.meta).toBeTypeOf("object");
        expect(frame.entities.length).toBeGreaterThan(0);
        const localIds = new Set<string>();
        for (const entity of frame.entities) {
            expect(localIds.has(entity.id)).toBe(false);
            localIds.add(entity.id);
            ids.add(entity.id);
        }
        for (const edge of frame.edges) {
            expect(localIds.has(edge.sourceId)).toBe(true);
            expect(localIds.has(edge.targetId)).toBe(true);
        }
    });
    expect(ids.size).toBeGreaterThan(0);
}

describe("ConcTreeList", () => {
    it("emits well-formed frames with sequential steps", () => {
        const frames = drain(mod.defaultInput);
        checkShapes(frames);
    });

    it("preserves insertion order against a brute-force concatenation oracle", () => {
        for (const values of [[5, 1, 8, 3, 7, 2], [42], [9, 9, 9], [3, 1, 4, 1, 5, 9, 2, 6]]) {
            const frames = drain({ values });
            const final = frames[frames.length - 1];
            const expected = [...values];
            expect(final?.meta.result).toEqual(expected);
            expect(final?.meta.size).toBe(values.length);
            expect(final?.meta.merges).toBe(values.length);
            expect(final?.meta.edges).toBe(values.length - 1);
        }
    });

    it("keeps a valid tree where each merge attaches exactly one node", () => {
        const frames = drain(mod.defaultInput);
        for (let i = 1; i < frames.length - 1; i += 1) {
            expect(frames[i]?.entities.length).toBe(i);
        }
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        let done = false;
        while (!done) {
            const next = gen.next();
            done = next.done === true;
            if (!done) count += 1;
        }
        expect(count).toBe((mod.defaultInput as { values: number[] }).values.length + 2);
    });
});
