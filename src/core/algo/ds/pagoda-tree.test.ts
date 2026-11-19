/** pagoda-tree.test.ts - Extract-min reference cross-check from frame roots, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./pagoda-tree";
import type { VisualFrame } from "@/types";

function rootValue(frame: VisualFrame): number {
    const root = frame.entities.find((e) => e.metadata["parentId"] === "root");
    expect(root).toBeDefined();
    return Number(root?.value);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Pagoda Tree", () => {
    it("extracts minima in sorted order", () => {
        const input = mod.defaultInput as { values: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = [...input.values].sort((a, b) => a - b);
        const extracted: number[] = [];
        for (let i = 0; i < expected.length; i += 1) {
            extracted.push(rootValue(frames[i] as VisualFrame));
        }
        expect(extracted).toEqual(expected);
        expect(frames[frames.length - 1]?.meta["output"]).toEqual(expected);
    });

    it("handles unsorted counts and duplicates", () => {
        for (const values of [[4, 4, 1, 9, 2], [7], [3, 6, 2, 8, 5, 1]]) {
            const frames = [...mod.run({ values })];
            checkFrames(frames);
            const extracted: number[] = [];
            for (let i = 0; i < values.length; i += 1) extracted.push(rootValue(frames[i] as VisualFrame));
            expect(extracted).toEqual([...values].sort((a, b) => a - b));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
