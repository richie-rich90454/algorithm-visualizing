/**
 * fischer-heun-rmq.test.ts - Correctness and frame checks for Fischer-Heun RMQ.
 */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./fischer-heun-rmq";

type Query = [number, number];

function drain(input: unknown): VisualFrame[] {
    const out: VisualFrame[] = [];
    for (const frame of mod.run(input)) out.push(frame);
    return out;
}

function checkShapes(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("grid");
        expect(frame.meta).toBeTypeOf("object");
        for (const entity of frame.entities) {
            expect(entity.metadata).toHaveProperty("row");
            expect(entity.metadata).toHaveProperty("col");
        }
    });
}

/** Brute force: scan the range and pick the smallest value, breaking ties by index. */
function brute(values: number[], l: number, r: number): { value: number; index: number } {
    let best = l;
    for (let i = l + 1; i <= r; i += 1) {
        if ((values[i] ?? Infinity) < (values[best] ?? Infinity)) best = i;
    }
    return { value: values[best] ?? 0, index: best };
}

describe("FischerHeunRmq", () => {
    it("emits well-formed frames with sequential steps", () => {
        checkShapes(drain(mod.defaultInput));
    });

    it("matches brute-force RMQ on the default input", () => {
        const input = mod.defaultInput as { values: number[]; queries: Query[] };
        const frames = drain(input);
        const final = frames[frames.length - 1];
        const expected = input.queries.map(([l, r]) => brute(input.values, l, r));
        expect(final?.meta.answers).toEqual(expected.map((e) => e.value));
        expect(final?.meta.indices).toEqual(expected.map((e) => e.index));
    });

    it("matches brute force on randomized ranges", () => {
        for (let trial = 0; trial < 8; trial += 1) {
            const values = Array.from({ length: 25 }, () => Math.floor(Math.random() * 30) - 15);
            const queries: Query[] = [];
            for (let k = 0; k < 6; k += 1) {
                const a = Math.floor(Math.random() * values.length);
                const b = Math.floor(Math.random() * values.length);
                queries.push([Math.min(a, b), Math.max(a, b)]);
            }
            const frames = drain({ values, queries });
            const final = frames[frames.length - 1];
            const expected = queries.map(([l, r]) => brute(values, l, r));
            expect(final?.meta.answers).toEqual(expected.map((e) => e.value));
            expect(final?.meta.indices).toEqual(expected.map((e) => e.index));
        }
    });

    it("handles single-element and full-array ranges", () => {
        const values = [4, 4, 1, 1, 9];
        const queries: Query[] = [
            [0, 0],
            [0, 4],
            [2, 3],
            [1, 1],
        ];
        const frames = drain({ values, queries });
        const final = frames[frames.length - 1];
        expect(final?.meta.indices).toEqual([0, 2, 2, 1]);
    });

    it("terminates cleanly", () => {
        const input = mod.defaultInput as { queries: Query[] };
        const gen = mod.run(input);
        let count = 0;
        for (const _ of gen) count += 1;
        expect(count).toBe(input.queries.length + 2);
        expect(gen.next().done).toBe(true);
    });
});
