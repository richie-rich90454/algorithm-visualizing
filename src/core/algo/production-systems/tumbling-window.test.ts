/** tumbling-window.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./tumbling-window";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function reference(values: number[], width: number): number[][] {
    const buckets: number[][] = [];
    for (let i = 0; i < values.length; i += width) buckets.push(values.slice(i, i + width));
    return buckets;
}

describe("Tumbling Window", () => {
    it("partitions the default stream into non-overlapping buckets", () => {
        const input = mod.defaultInput as { values: number[]; window: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1];
        expect(last?.meta["buckets"]).toEqual(reference(input.values, input.window));
        const expectedTotals = reference(input.values, input.window).map((bucket) => bucket.reduce((a, b) => a + b, 0));
        expect(last?.meta["totals"]).toEqual(expectedTotals);
    });

    it("matches brute force over random streams and widths", () => {
        let seed = 5150;
        const rand = (n: number) => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % n;
        };
        for (let trial = 0; trial < 80; trial += 1) {
            const values = Array.from({ length: 1 + rand(25) }, () => rand(40));
            const width = 1 + rand(8);
            const frames = [...mod.run({ values, window: width })];
            const last = frames[frames.length - 1];
            const buckets = reference(values, width);
            expect(last?.meta["buckets"]).toEqual(buckets);
            expect(last?.meta["totals"]).toEqual(buckets.map((bucket) => bucket.reduce((a, b) => a + b, 0)));
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
