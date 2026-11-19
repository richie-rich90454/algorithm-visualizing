/**
 * union-find-decoder.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./union-find-decoder";
import type { VisualFrame } from "@/types";

function syndromeOf(errors: number[]): number[] {
    const out: number[] = [];
    for (let i = 0; i + 1 < errors.length; i += 1) out.push((errors[i] ?? 0) ^ (errors[i + 1] ?? 0));
    return out;
}

/** Brute-force minimum weight over every error pattern with the given syndrome. */
function minWeight(syndrome: number[]): number {
    const n = syndrome.length + 1;
    let best = n;
    for (let mask = 0; mask < 1 << n; mask += 1) {
        const errors = Array.from({ length: n }, (_, q) => (mask >> q) & 1);
        const s = syndromeOf(errors);
        if (s.every((bit, i) => bit === syndrome[i])) {
            best = Math.min(best, errors.reduce((sum, bit) => sum + bit, 0));
        }
    }
    return best;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Union-Find Decoder", () => {
    it("returns a correction that reproduces the default syndrome", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["converged"]).toBe(true);
        const correction = (final?.["residual"] as number[] | undefined) ?? [];
        expect(correction).toEqual([0, 1, 0, 1, 0]);
    });

    it("matches a brute-force minimum weight on deterministic syndromes", () => {
        const cases = [
            [0, 0, 0, 0, 0],
            [1, 0, 0, 0, 0],
            [0, 1, 0, 1, 0],
            [1, 1, 0, 0, 0],
            [1, 0, 1, 0, 1],
            [1, 1, 1, 1, 1],
        ];
        for (const syndrome of cases) {
            const frames = [...mod.run({ syndrome })];
            const final = frames[frames.length - 1]?.meta;
            expect(Number(final?.["weight"])).toBe(minWeight(syndrome));
            expect(final?.["converged"]).toBe(true);
        }
    });

    it("handles every syndrome of a five-check code with valid residual", () => {
        const length = 5;
        for (let mask = 0; mask < 1 << length; mask += 1) {
            const syndrome = Array.from({ length }, (_, i) => (mask >> i) & 1);
            const frames = [...mod.run({ syndrome })];
            const lastFrame = frames[frames.length - 1]!;
            const final = lastFrame.meta;
            const n = length + 1;
            const correction: number[] = [];
            for (let col = 0; col < n; col += 1) {
                const cell = lastFrame.entities.find((e) => e.id === `cell-1-${col}`);
                correction.push(Number(cell?.value ?? 0));
            }
            expect(syndromeOf(correction)).toEqual(syndrome);
            expect(Number(final["weight"])).toBe(minWeight(syndrome));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
