/**
 * wald-confidence-interval.test.ts - Known-quantile check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./wald-confidence-interval";
import type { VisualFrame } from "@/types";

const Z: Record<number, number> = { 0.9: 1.644854, 0.95: 1.959964, 0.99: 2.575829 };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("WaldConfidenceInterval", () => {
    it("matches hand-computed intervals at several confidence levels", () => {
        for (const [level, z] of Object.entries(Z)) {
            const confidence = Number(level);
            const successes = 45;
            const trials = 100;
            const phat = successes / trials;
            const se = Math.sqrt((phat * (1 - phat)) / trials);
            const frames = [...mod.run({ successes, trials, confidence })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(Number(final?.["z"])).toBeCloseTo(z, 4);
            expect(Number(final?.["phat"])).toBeCloseTo(phat, 10);
            expect(Number(final?.["se"])).toBeCloseTo(se, 10);
            expect(Number(final?.["lower"])).toBeCloseTo(phat - z * se, 4);
            expect(Number(final?.["upper"])).toBeCloseTo(phat + z * se, 4);
        }
    });

    it("keeps the estimate inside a symmetric interval across random samples", () => {
        let seed = 11;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        for (let i = 0; i < 20; i += 1) {
            const trials = 20 + Math.floor(rand() * 200);
            const successes = Math.floor(rand() * (trials + 1));
            const frames = [...mod.run({ successes, trials, confidence: 0.95 })];
            const final = frames[frames.length - 1]?.meta;
            const phat = Number(final?.["phat"]);
            const lower = Number(final?.["lower"]);
            const upper = Number(final?.["upper"]);
            expect(lower).toBeLessThanOrEqual(phat);
            expect(upper).toBeGreaterThanOrEqual(phat);
            expect(upper - phat).toBeCloseTo(phat - lower, 10);
        }
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
