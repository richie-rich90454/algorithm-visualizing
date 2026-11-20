/**
 * crdt-g-counter.test.ts - CRDT algebra properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { mergeVector, simulateGCounter } from "./crdt-g-counter";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], replicas: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(replicas);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("CRDT G-Counter", () => {
    it("satisfies commutativity, associativity, and idempotence on random vectors", () => {
        let seed = 7;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed;
        };
        for (let trial = 0; trial < 200; trial += 1) {
            const r = 1 + (rand() % 6);
            const a = Array.from({ length: r }, () => rand() % 20);
            const b = Array.from({ length: r }, () => rand() % 20);
            const c = Array.from({ length: r }, () => rand() % 20);
            expect(mergeVector(a, b)).toEqual(mergeVector(b, a));
            expect(mergeVector(mergeVector(a, b), c)).toEqual(mergeVector(a, mergeVector(b, c)));
            expect(mergeVector(a, a)).toEqual(a);
        }
    });

    it("converges to the true total regardless of merge order", () => {
        for (let r = 1; r <= 6; r += 1) {
            for (let base = 0; base < 12; base += 1) {
                const updates = Array.from({ length: r }, (_, i) => (base + i * 3) % 11);
                const data = simulateGCounter(updates);
                expect(data.finalVector).toEqual(updates);
                expect(data.value).toBe(updates.reduce((a, b) => a + b, 0));
                expect(data.idempotent).toBe(true);
                expect(data.orders.every((o) => o.every((v, i) => v === data.finalVector[i]))).toBe(true);
                for (let i = 0; i < r; i += 1) {
                    expect(data.localVectors[i]![i]).toBe(updates[i]);
                    expect(data.localVectors[i]!.every((v, j) => j === i || v === 0)).toBe(true);
                }
            }
        }
    });

    it("emits well-formed frames with a converged final value", () => {
        const input = mod.defaultInput as { updates: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.updates.length);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["value"]).toBe(10);
        expect(final?.["converged"]).toBe(true);
        expect(final?.["vector"]).toEqual([3, 5, 2]);
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
