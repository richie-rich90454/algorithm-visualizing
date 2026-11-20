/**
 * cache-gdsf.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { gdsfTrace } from "./cache-gdsf";
import type { VisualFrame } from "@/types";

type Req = { key: string; size: number; cost?: number };

function reference(capacity: number, requests: Req[]) {
    const cache = new Map<string, { size: number; freq: number; prio: number; order: number }>();
    let used = 0;
    let H = 0;
    let order = 0;
    let hits = 0;
    let misses = 0;
    let evictions = 0;
    const actions: string[] = [];
    const usedHistory: number[] = [];
    for (const req of requests) {
        const size = Math.max(1, Math.floor(req.size));
        const cost = req.cost ?? 1;
        const hit = cache.get(req.key);
        if (hit) {
            hits += 1;
            H = hit.prio;
            hit.freq += 1;
            hit.prio = H + (cost * hit.freq) / size;
            actions.push("hit");
        } else {
            misses += 1;
            let evicted = false;
            while (used + size > capacity && cache.size > 0) {
                let victimKey = "";
                let victim: { size: number; freq: number; prio: number; order: number } | null = null;
                for (const [k, e] of cache) {
                    if (!victim || e.prio < victim.prio || (e.prio === victim.prio && e.order < victim.order)) {
                        victimKey = k;
                        victim = e;
                    }
                }
                if (!victim) break;
                H = victim.prio;
                used -= victim.size;
                cache.delete(victimKey);
                evictions += 1;
                evicted = true;
            }
            if (size <= capacity) {
                cache.set(req.key, { size, freq: 1, prio: H + cost / size, order: order++ });
                used += size;
                actions.push(evicted ? "miss+evict" : "miss");
            } else {
                actions.push("skip");
            }
        }
        usedHistory.push(used);
    }
    return { actions, usedHistory, finalKeys: [...cache.keys()].sort(), hits, misses, evictions, used };
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 5);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("GDSF Cache Replacement", () => {
    it("matches an independent trace reference", () => {
        const cases: Array<{ capacity: number; requests: Req[] }> = [
            {
                capacity: 10,
                requests: [
                    { key: "a", size: 2 }, { key: "b", size: 3 }, { key: "a", size: 2 }, { key: "c", size: 4 },
                    { key: "b", size: 3 }, { key: "d", size: 5 }, { key: "a", size: 2 }, { key: "c", size: 4 },
                ],
            },
            {
                capacity: 6,
                requests: [
                    { key: "x", size: 2, cost: 2 }, { key: "y", size: 3 }, { key: "x", size: 2, cost: 2 },
                    { key: "z", size: 4 }, { key: "w", size: 7 }, { key: "y", size: 3 },
                ],
            },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.requests.length);
            const expected = reference(input.capacity, input.requests);
            const final = frames[frames.length - 1]!.meta;
            expect(final["actions"]).toEqual(expected.actions);
            expect(final["finalKeys"]).toEqual(expected.finalKeys);
            expect(final["hits"]).toBe(expected.hits);
            expect(final["misses"]).toBe(expected.misses);
            expect(final["evictions"]).toBe(expected.evictions);
            expect(final["used"]).toBe(expected.used);
            expect(gdsfTrace(input.capacity, input.requests).finalKeys).toEqual(expected.finalKeys);
        }
    });

    it("never exceeds capacity", () => {
        const requests: Req[] = Array.from({ length: 20 }, (_, i) => ({ key: `k${i % 7}`, size: 1 + (i % 4) }));
        const final = [...mod.run({ capacity: 8, requests })][0]!.meta;
        (final["usedHistory"] as number[]).forEach((used) => expect(used).toBeLessThanOrEqual(8));
    });

    it("rejects an object larger than the whole cache", () => {
        const frames = [...mod.run({ capacity: 3, requests: [{ key: "big", size: 9 }] })];
        const final = frames[frames.length - 1]!.meta;
        expect(final["actions"]).toEqual(["skip"]);
        expect(final["finalKeys"]).toEqual([]);
        expect(final["used"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
