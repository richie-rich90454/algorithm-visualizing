/**
 * differential-phase-shift-qkd.test.ts - Interference probability check,
 * noise extremes, determinism, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./differential-phase-shift-qkd";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode!.length);
        expect(frame.meta).toBeDefined();
    });
}

function finalMeta(frames: VisualFrame[]): Record<string, unknown> {
    return frames[frames.length - 1]!.meta;
}

describe("DifferentialPhaseShiftQkd", () => {
    it("uses the ideal interference probabilities", () => {
        const bits = [0, 1, 1, 0, 1, 0];
        const frames = [...mod.run({ bits, seed: 3, noise: 0 })];
        checkFrames(frames);
        const meta = finalMeta(frames);
        const alice = meta["aliceBits"] as number[];
        const probs = meta["portProbs"] as number[];
        expect(probs.length).toBe(bits.length - 1);
        for (let i = 0; i < probs.length; i += 1) {
            expect(probs[i]).toBe(alice[i] === 0 ? 1 : 0);
        }
    });

    it("gives zero error without noise and full error with total noise", () => {
        const bits = [0, 1, 1, 0, 1, 0, 0, 1];
        const clean = finalMeta([...mod.run({ bits, seed: 11, noise: 0 })]);
        expect(clean["qber"]).toBe(0);
        expect(clean["bobBits"]).toEqual(clean["aliceBits"]);

        const noisy = finalMeta([...mod.run({ bits, seed: 11, noise: 1 })]);
        expect(noisy["qber"]).toBe(1);
        const alice = noisy["aliceBits"] as number[];
        expect(noisy["bobBits"]).toEqual(alice.map((b) => b ^ 1));
    });

    it("is deterministic for a fixed seed", () => {
        const input = { bits: [1, 0, 1, 1, 0, 0, 1], seed: 99, noise: 0.3 };
        const a = finalMeta([...mod.run(input)]);
        const b = finalMeta([...mod.run(input)]);
        expect(a["bobBits"]).toEqual(b["bobBits"]);
        expect(a["qber"]).toBe(b["qber"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
