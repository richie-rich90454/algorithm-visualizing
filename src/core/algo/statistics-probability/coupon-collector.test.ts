/**
 * coupon-collector.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./coupon-collector";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function harmonic(n: number): number {
    let sum = 0;
    for (let k = 1; k <= n; k += 1) {
        sum += 1 / k;
    }
    return sum;
}

describe("Coupon collector", () => {
    it("collects every type and reports the exact expectation", () => {
        for (const n of [1, 2, 5, 6, 10]) {
            const frames = [...mod.run({ coupons: n, seed: 11 })];
            checkFrames(frames, n);
            const final = frames[frames.length - 1]!.meta;
            expect(final["complete"]).toBe(true);
            const firstSeen = final["firstSeen"] as number[];
            expect(firstSeen.length).toBe(n);
            expect(firstSeen.every((t) => t > 0)).toBe(true);
            expect(new Set(firstSeen).size).toBe(n);
            const draws = final["draws"] as number[];
            expect(draws.length).toBe(final["drawsUsed"]);
            expect(draws.length).toBeGreaterThanOrEqual(n);
            expect(Math.max(...draws)).toBeLessThan(n);
            expect(Math.min(...draws)).toBeGreaterThanOrEqual(0);
            expect(final["expected"]).toBeCloseTo(n * harmonic(n), 10);
        }
    });

    it("rebuilds the collection from the recorded draw sequence", () => {
        const frames = [...mod.run({ coupons: 5, seed: 21 })];
        const final = frames[frames.length - 1]!.meta;
        const draws = final["draws"] as number[];
        expect(new Set(draws).size).toBe(5);
        const reported = final["firstSeen"] as number[];
        for (let type = 0; type < 5; type += 1) {
            expect(reported[type]).toBe(draws.indexOf(type) + 1);
        }
    });

    it("is deterministic for a fixed seed", () => {
        const a = [...mod.run({ coupons: 6, seed: 7 })];
        const b = [...mod.run({ coupons: 6, seed: 7 })];
        expect(JSON.stringify(a[a.length - 1]!.meta["draws"])).toBe(JSON.stringify(b[b.length - 1]!.meta["draws"]));
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
