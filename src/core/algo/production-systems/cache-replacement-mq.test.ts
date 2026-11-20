/** cache-replacement-mq.test.ts - Independent policy, hit-count cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./cache-replacement-mq";
import type { VisualFrame } from "@/types";

type Q = "high" | "middle" | "low";

function reference(trace: string[], capacity: number, historyLimit: number): { hits: number; queues: Record<Q, string[]> } {
    const q: Record<Q, string[]> = { high: [], middle: [], low: [] };
    let history: string[] = [];
    const where = (k: string): Q | null =>
        (["high", "middle", "low"] as Q[]).find((name) => q[name].includes(k)) ?? null;
    const move = (k: string, from: Q, to: Q): void => {
        q[from] = q[from].filter((x) => x !== k);
        q[to] = [k, ...q[to]];
    };
    const size = (): number => q.high.length + q.middle.length + q.low.length;
    const evict = (): void => {
        for (const name of ["low", "middle", "high"] as Q[]) {
            if (q[name].length > 0) {
                const v = q[name].pop();
                if (v !== undefined && name === "high") {
                    history = [v, ...history.filter((x) => x !== v)].slice(0, 4);
                }
                return;
            }
        }
    };
    let hits = 0;
    for (const key of trace) {
        const loc = where(key);
        if (loc === "high") { move(key, "high", "high"); hits += 1; continue; }
        if (loc === "middle") { move(key, "middle", "high"); hits += 1; continue; }
        if (loc === "low") { move(key, "low", "middle"); hits += 1; continue; }
        const remembered = history.includes(key);
        history = history.filter((x) => x !== key).slice(0, historyLimit);
        if (remembered) { q.high = [key, ...q.high]; } else { q.low = [key, ...q.low]; }
        while (size() > capacity) { evict(); }
    }
    return { hits, queues: q };
}

function checkFrames(frames: VisualFrame[], traceLen: number, capacity: number): void {
    expect(frames.length).toBe(traceLen + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(capacity * 3);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("CacheReplacementMq", () => {
    it("matches an independent policy on fixed traces", () => {
        const cases = [
            { trace: ["a", "b", "a", "c", "b", "d", "a"], capacity: 3 },
            { trace: ["x", "y", "z", "x", "y", "w", "z", "x"], capacity: 2 },
            { trace: ["a", "b", "c", "d", "e", "a", "b"], capacity: 4 },
        ];
        for (const input of cases) {
            const expected = reference(input.trace, input.capacity, 4);
            const frames = [...mod.run(input)];
            checkFrames(frames, input.trace.length, input.capacity);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["hits"]).toBe(expected.hits);
            expect(final?.["misses"]).toBe(input.trace.length - expected.hits);
            expect(final?.["high"]).toEqual(expected.queues.high);
            expect(final?.["middle"]).toEqual(expected.queues.middle);
            expect(final?.["low"]).toEqual(expected.queues.low);
        }
    });

    it("never exceeds capacity and stays deterministic on random traces", () => {
        let seed = 17;
        for (let trial = 0; trial < 20; trial += 1) {
            const capacity = 2 + (trial % 4);
            const trace: string[] = [];
            for (let i = 0; i < 25; i += 1) {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                trace.push(String.fromCharCode(97 + (seed % 8)));
            }
            const expected = reference(trace, capacity, 4);
            const frames = [...mod.run({ trace, capacity })];
            checkFrames(frames, trace.length, capacity);
            frames.slice(1).forEach((frame) => {
                const total = (frame.meta["high"] as string[]).length
                    + (frame.meta["middle"] as string[]).length
                    + (frame.meta["low"] as string[]).length;
                expect(total).toBeLessThanOrEqual(capacity);
            });
            expect(frames[frames.length - 1]?.meta["hits"]).toBe(expected.hits);
            expect([...mod.run({ trace, capacity })]).toEqual(frames);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBe(9);
        expect(generator.next().done).toBe(true);
    });
});
