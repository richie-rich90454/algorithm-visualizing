/**
 * aitken-acceleration.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./aitken-acceleration";
import type { VisualFrame } from "@/types";

/** Independent Aitken estimate for three consecutive terms. */
function reference(a0: number, a1: number, a2: number): number {
    const d1 = a1 - a0;
    const d2 = a2 - 2 * a1 + a0;
    return Math.abs(d2) < 1e-15 ? a2 : a0 - (d1 * d1) / d2;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThanOrEqual(4);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Aitken Acceleration", () => {
    it("returns the exact limit for a geometric error sequence", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const estimate = Number(final?.["estimate"]);
        expect(estimate).toBeCloseTo(2, 10);
        expect(Math.abs(estimate - 2)).toBeLessThan(1e-9);
    });

    it("matches an independent formula on every emitted triple", () => {
        const sequence = [3, 2.5, 2.25, 2.125, 2.0625, 2.03125];
        const frames = [...mod.run({ sequence, limit: 2 })];
        const estimates: number[] = [];
        for (let i = 0; i + 2 < sequence.length; i += 1) {
            estimates.push(reference(sequence[i]!, sequence[i + 1]!, sequence[i + 2]!));
        }
        const emitted = frames.slice(1, -1).map((frame) => Number(frame.meta["estimate"]));
        expect(emitted).toHaveLength(estimates.length);
        emitted.forEach((value, i) => expect(value).toBeCloseTo(estimates[i]!, 10));
    });

    it("beats the raw sequence on a linearly convergent nontrivial case", () => {
        const limit = 5;
        const sequence = Array.from({ length: 8 }, (_, k) => limit + 3 * Math.pow(0.7, k));
        const frames = [...mod.run({ sequence, limit })];
        const estimate = Number(frames[frames.length - 1]?.meta["estimate"]);
        const rawLast = sequence[sequence.length - 1]!;
        expect(Math.abs(estimate - limit)).toBeLessThan(Math.abs(rawLast - limit) / 100);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
