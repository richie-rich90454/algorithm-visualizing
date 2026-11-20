/**
 * six-state-protocol.test.ts - Exact rate enumeration, sifting consistency, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./six-state-protocol";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBe(count + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent count of basis matches and intercept-resend errors. */
function exact(): { sift: number; error: number } {
    let matches = 0;
    let errors = 0;
    let total = 0;
    for (let alice = 0; alice < 3; alice += 1) {
        for (let bob = 0; bob < 3; bob += 1) {
            for (let eve = 0; eve < 3; eve += 1) {
                total += 1;
                if (alice === bob) {
                    matches += 1;
                    if (eve !== alice) errors += 0.5;
                }
            }
        }
    }
    return { sift: matches / total, error: errors / matches };
}

describe("SixStateProtocol", () => {
    it("reports the exact one third sifting and one third error rates", () => {
        const expected = exact();
        expect(expected.sift).toBeCloseTo(1 / 3, 12);
        expect(expected.error).toBeCloseTo(1 / 3, 12);
        for (const count of [4, 12, 20]) {
            const frames = [...mod.run({ rounds: count })];
            checkFrames(frames, count);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["siftProbability"] as number).toBeCloseTo(1 / 3, 12);
            expect(meta?.["errorProbability"] as number).toBeCloseTo(1 / 3, 12);
        }
    });

    it("only flags errors on sifted rounds", () => {
        const frames = [...mod.run({ rounds: 12 })];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["errorCount"] as number).toBeLessThanOrEqual(meta?.["siftedCount"] as number);
        const finalBars = frames[frames.length - 1]?.entities ?? [];
        for (const entity of finalBars) {
            const sifted = entity.metadata["sifted"] as boolean;
            const error = entity.metadata["error"] as boolean;
            if (error) expect(sifted).toBe(true);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(14);
        expect(generator.next().done).toBe(true);
    });
});
