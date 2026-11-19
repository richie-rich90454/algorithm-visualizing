/**
 * bottom-k-sketch.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { hashItem } from "./bottom-k-sketch";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], k: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(k);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(k);
    });
}

/** Brute-force k smallest hashes of the distinct items in a stream. */
function reference(stream: Array<number | string>, k: number) {
    const distinct = new Map<string, number | string>();
    for (const item of stream) {
        const key = `${typeof item}:${String(item)}`;
        if (!distinct.has(key)) distinct.set(key, item);
    }
    const hashes = [...distinct.values()].map(hashItem);
    hashes.sort((a, b) => a - b);
    return { distinct: distinct.size, sketch: hashes.slice(0, k) };
}

describe("Bottom-k Cardinality Sketch", () => {
    it("keeps exactly the k smallest hashes of all distinct items", () => {
        const input = mod.defaultInput as { stream: number[]; k: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.k);
        const expected = reference(input.stream, input.k);
        const finalMeta = frames[frames.length - 1]!.meta;
        expect(finalMeta["distinct"]).toBe(expected.distinct);
        expect(finalMeta["sketch"]).toEqual(expected.sketch);

        const sketch = finalMeta["sketch"] as number[];
        expect(sketch.length).toBeLessThanOrEqual(input.k);
        for (let i = 1; i < sketch.length; i += 1) {
            expect(sketch[i - 1]!).toBeLessThanOrEqual(sketch[i]!);
        }
    });

    it("estimates cardinality accurately on a large stream", () => {
        const stream = Array.from({ length: 20000 }, (_, i) => 7 * (i % 1000));
        const k = 200;
        const frames = [...mod.run({ stream, k })];
        const finalMeta = frames[frames.length - 1]!.meta;
        const trueDistinct = new Set(stream).size;
        const estimated = Number(finalMeta["estimate"]);
        expect(Math.abs(estimated - trueDistinct) / trueDistinct).toBeLessThan(0.2);
    });

    it("is deterministic and ignores duplicates", () => {
        const stream = ["apple", "pear", "apple", "plum", "pear", "fig"];
        const a = [...mod.run({ stream, k: 3 })];
        const b = [...mod.run({ stream, k: 3 })];
        expect(a[a.length - 1]!.meta["sketch"]).toEqual(b[b.length - 1]!.meta["sketch"]);
        expect(a[a.length - 1]!.meta["distinct"]).toBe(4);
        const withDupes = [...mod.run({ stream: [...stream, ...stream, "apple"], k: 3 })];
        expect(withDupes[withDupes.length - 1]!.meta["sketch"]).toEqual(a[a.length - 1]!.meta["sketch"]);
    });

    it("returns the exact count before the sample fills and terminates", () => {
        const small = [...mod.run({ stream: [5, 6, 7], k: 10 })];
        const meta = small[small.length - 1]!.meta;
        expect(meta["estimate"]).toBe(3);
        expect((meta["sketch"] as number[]).length).toBe(3);

        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
