/**
 * e91-protocol.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./e91-protocol";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], visibleRows: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(5 * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(5);
    });
    expect(visibleRows).toBeGreaterThan(0);
}

function finalMeta(frames: VisualFrame[]): Record<string, unknown> {
    return frames[frames.length - 1]?.meta as Record<string, unknown>;
}

describe("E91 protocol", () => {
    it("violates the Bell inequality with no eavesdropper", () => {
        const frames = [...mod.run({ trialsPerSetting: 4000, keyBits: 128, seed: 11, eavesdropper: false })];
        checkFrames(frames, 5);
        const metaFrame = finalMeta(frames);
        const S = metaFrame["S"] as number;
        // Quantum prediction is 2*sqrt(2) ~ 2.828.
        expect(S).toBeGreaterThan(2.6);
        expect(S).toBeLessThan(2.95);
        expect(metaFrame["violated"]).toBe(true);
        expect(metaFrame["keyAgreement"] as number).toBeGreaterThan(0.98);
    });

    it("loses the Bell violation under intercept-and-resend", () => {
        const frames = [...mod.run({ trialsPerSetting: 4000, keyBits: 128, seed: 11, eavesdropper: true })];
        checkFrames(frames, 5);
        const metaFrame = finalMeta(frames);
        const S = metaFrame["S"] as number;
        expect(S).toBeLessThan(2);
        expect(metaFrame["violated"]).toBe(false);
        expect(metaFrame["keyAgreement"] as number).toBeLessThan(0.9);
        expect(metaFrame["keyErrors"] as number).toBeGreaterThan(0);
    });

    it("keeps each correlation in the valid range and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const frame of generator) {
            count += 1;
        }
        const metaFrame = finalMeta([...mod.run(mod.defaultInput)]);
        const correlations = metaFrame["correlations"] as number[];
        expect(correlations.length).toBe(4);
        for (const E of correlations) {
            expect(E).toBeGreaterThanOrEqual(-1);
            expect(E).toBeLessThanOrEqual(1);
        }
        const S = metaFrame["S"] as number;
        expect(S).toBeGreaterThanOrEqual(0);
        expect(S).toBeLessThanOrEqual(4);
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
