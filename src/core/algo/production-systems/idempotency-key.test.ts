/**
 * idempotency-key.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./idempotency-key";
import type { VisualFrame } from "@/types";

interface Request { key: string; value: number }

function reference(requests: Request[]) {
    const cache = new Map<string, number>();
    const actions: string[] = [];
    const results: number[] = [];
    for (const request of requests) {
        if (cache.has(request.key)) {
            actions.push("dedup");
            results.push(cache.get(request.key) ?? 0);
        } else {
            actions.push("execute");
            results.push(request.value);
            cache.set(request.key, request.value);
        }
    }
    return { actions, results, distinctKeys: cache.size };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Idempotency key deduplication", () => {
    it("matches an independent reference for actions and cached results", () => {
        const cases: Request[][] = [
            [
                { key: "a", value: 1 }, { key: "b", value: 2 }, { key: "a", value: 1 },
                { key: "c", value: 3 }, { key: "b", value: 2 },
            ],
            [{ key: "x", value: 10 }, { key: "x", value: 99 }, { key: "x", value: 99 }],
            [{ key: "one", value: 5 }, { key: "two", value: 6 }, { key: "three", value: 7 }],
        ];
        for (const requests of cases) {
            const frames = [...mod.run({ requests })] as VisualFrame[];
            checkFrames(frames, requests.length);
            const expected = reference(requests);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["actions"]).toEqual(expected.actions);
            expect(finalMeta?.["results"]).toEqual(expected.results);
            expect(Number(finalMeta?.["distinctKeys"])).toBe(expected.distinctKeys);
            expect(Number(finalMeta?.["executed"])).toBe(expected.distinctKeys);
            expect(Number(finalMeta?.["deduped"])).toBe(requests.length - expected.distinctKeys);
        }
    });

    it("returns the first stored value even when a repeat carries a different value", () => {
        const requests = [{ key: "k", value: 42 }, { key: "k", value: 999 }];
        const frames = [...mod.run({ requests })];
        checkFrames(frames, 2);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["results"]).toEqual([42, 42]);
        expect(finalMeta?.["actions"]).toEqual(["execute", "dedup"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
