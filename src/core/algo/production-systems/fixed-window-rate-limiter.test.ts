/**
 * fixed-window-rate-limiter.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./fixed-window-rate-limiter";
import type { VisualFrame } from "@/types";

interface Input {
    limit: number;
    windowMs: number;
    requests: number[];
}

/** Independent reference: one counter per floor(timestamp/window) bucket. */
function reference(limit: number, windowMs: number, requests: number[]): boolean[] {
    const counts = new Map<number, number>();
    return requests.map((time) => {
        const bucket = Math.floor(time / windowMs);
        const used = counts.get(bucket) ?? 0;
        if (used < limit) {
            counts.set(bucket, used + 1);
            return true;
        }
        return false;
    });
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Fixed Window Rate Limiter", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent reference on the default trace", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input.limit, input.windowMs, input.requests);
        expect(final?.["decisions"]).toEqual(expected.map((d) => (d ? 1 : 0)));
        expect(final?.["allowed"]).toBe(expected.filter(Boolean).length);
        expect(final?.["rejected"]).toBe(expected.filter((d) => !d).length);
    });

    it("never allows more than the limit inside any single bucket", () => {
        let seed = 42;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const limit = 1 + (rand() % 5);
            const windowMs = 1 + (rand() % 100);
            const requests = Array.from({ length: 25 }, () => rand() % 500);
            const frames = [...mod.run({ limit, windowMs, requests })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const decisions = (final?.["decisions"] as number[]).map((d) => d === 1);
            expect(decisions).toEqual(reference(limit, windowMs, requests));
            const perBucket = new Map<number, number>();
            requests.forEach((time, i) => {
                if (!decisions[i]) return;
                const bucket = Math.floor(time / windowMs);
                perBucket.set(bucket, (perBucket.get(bucket) ?? 0) + 1);
            });
            for (const count of perBucket.values()) expect(count).toBeLessThanOrEqual(limit);
        }
    });

    it("handles an empty request list", () => {
        const frames = [...mod.run({ limit: 2, windowMs: 10, requests: [] })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["allowed"]).toBe(0);
        expect(final?.["rejected"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
