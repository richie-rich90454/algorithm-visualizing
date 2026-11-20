/**
 * read-through-cache.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./read-through-cache";
import type { VisualFrame } from "@/types";

interface Req {
    op?: string;
    key?: string | number;
    value?: number;
}
interface Input {
    capacity: number;
    initial: Record<string, number>;
    requests: Req[];
}

/** Independent model: map value plus an explicit least-to-most-recent key list. */
function reference(input: Input) {
    const store = new Map<string | number, number>();
    for (const [k, v] of Object.entries(input.initial)) store.set(k, v);
    const cache = new Map<string | number, number>();
    const order: Array<string | number> = [];
    const values: Array<number | null> = [];
    const verdicts: string[] = [];
    let hits = 0;
    let misses = 0;
    let loads = 0;
    let evictions = 0;
    for (const request of input.requests) {
        const key = request.key ?? "";
        if (!store.has(key)) store.set(key, 0);
        if (request.op === "write") {
            const value = Number(request.value) || 0;
            store.set(key, value);
            if (cache.has(key)) {
                cache.set(key, value);
                verdicts.push("write-hit");
            } else {
                verdicts.push("write-around");
            }
            values.push(null);
            continue;
        }
        if (cache.has(key)) {
            hits += 1;
            values.push(cache.get(key)!);
            verdicts.push("hit");
            order.splice(order.indexOf(key), 1);
            order.push(key);
        } else {
            misses += 1;
            loads += 1;
            values.push(store.get(key) ?? 0);
            verdicts.push("miss");
            if (order.length >= input.capacity) {
                cache.delete(order.shift()!);
                evictions += 1;
            }
            cache.set(key, store.get(key) ?? 0);
            order.push(key);
        }
    }
    return { values, verdicts, hits, misses, loads, evictions, order: order.map(String), store };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Read-Through Cache", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent LRU cache model on the default trace", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input);
        expect(final?.["values"]).toEqual(expected.values);
        expect(final?.["verdicts"]).toEqual(expected.verdicts);
        expect(final?.["hits"]).toBe(expected.hits);
        expect(final?.["misses"]).toBe(expected.misses);
        expect(final?.["loads"]).toBe(expected.loads);
        expect(final?.["evictions"]).toBe(expected.evictions);
        expect(final?.["order"]).toEqual(expected.order);
    });

    it("matches the reference across randomized traces and respects capacity", () => {
        let seed = 2024;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        const keys = ["a", "b", "c", "d", "e", "f"];
        for (let trial = 0; trial < 40; trial += 1) {
            const capacity = 1 + (rand() % 4);
            const initial: Record<string, number> = {};
            for (const key of keys) initial[key] = rand() % 100;
            const requests: Req[] = Array.from({ length: 20 }, () => {
                const key = keys[rand() % keys.length]!;
                return rand() % 4 === 0
                    ? { op: "write", key, value: rand() % 1000 }
                    : { op: "read", key };
            });
            const testInput: Input = { capacity, initial, requests };
            const frames = [...mod.run(testInput)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(testInput);
            expect(final?.["values"]).toEqual(expected.values);
            expect(final?.["verdicts"]).toEqual(expected.verdicts);
            expect(final?.["order"]).toEqual(expected.order);
            expect((final?.["order"] as string[]).length).toBeLessThanOrEqual(capacity);
            for (const [key, value] of expected.store) {
                const stored = (final?.["store"] as Array<[string, number]>).find(([k]) => k === String(key));
                expect(stored?.[1]).toBe(value);
            }
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
