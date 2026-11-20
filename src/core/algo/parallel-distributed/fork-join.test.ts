/**
 * fork-join.test.ts - Recursive work/span reference, Brent-bound property,
 * tree-shape checks, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./fork-join";
import type { VisualFrame } from "@/types";

/** Independent recurrence for work and span of fork-join Fibonacci. */
function reference(n: number): { work: number; span: number } {
    if (n <= 1) return { work: 1, span: 1 };
    const left = reference(n - 1);
    const right = reference(n - 2);
    return { work: 1 + left.work + right.work, span: 1 + Math.max(left.span, right.span) };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("fork-join parallelism", () => {
    it("matches the reference work and span recurrence", () => {
        const input = mod.defaultInput as { n: number; processors: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input.n);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["work"]).toBe(expected.work);
        expect(final?.["span"]).toBe(expected.span);
        expect(final?.["parallelism"]).toBeCloseTo(expected.work / expected.span, 10);
        expect(final?.["bound"]).toBe(Math.ceil(expected.work / input.processors) + expected.span);
    });

    it("satisfies Brent's bound for several sizes and processor counts", () => {
        for (let n = 1; n <= 11; n += 1) {
            const expected = reference(n);
            for (const processors of [1, 2, 3, 4, 8]) {
                const frames = [...mod.run({ n, processors })];
                const final = frames[frames.length - 1]?.meta;
                const bound = Number(final?.["bound"]);
                expect(bound).toBeGreaterThanOrEqual(Math.ceil(expected.work / processors));
                expect(bound).toBeGreaterThanOrEqual(expected.span);
                expect(bound).toBeLessThanOrEqual(expected.work + expected.span);
            }
        }
    });

    it("emits a well-formed task tree with valid parent links", () => {
        const frames = [...mod.run({ n: 6, processors: 4 })];
        const final = frames[frames.length - 1]!;
        expect(final.entities.length).toBe(Number(final.meta["work"]));
        const ids = new Set(final.entities.map((e) => e.id));
        for (const edge of final.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        for (const entity of final.entities) {
            const parent = String(entity.metadata["parentId"]);
            if (parent !== "root") {
                expect(ids.has(parent)).toBe(true);
            }
        }
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
