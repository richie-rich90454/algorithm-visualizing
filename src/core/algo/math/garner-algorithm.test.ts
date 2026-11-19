/** garner-algorithm.test.ts - Brute-force CRT cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./garner-algorithm";
import type { VisualFrame } from "@/types";

function bruteForceCrt(residues: number[], moduli: number[]): number {
    const total = moduli.reduce((a, b) => a * b, 1);
    for (let x = 0; x < total; x += 1) {
        if (moduli.every((m, i) => ((x - residues[i]!) % m + m) % m === 0)) return x;
    }
    return -1;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Garner algorithm", () => {
    it("matches brute-force CRT on several coprime systems", () => {
        const cases = [
            { residues: [2, 3, 2], moduli: [3, 5, 7] },
            { residues: [1, 4, 3], moduli: [2, 5, 7] },
            { residues: [0, 2, 1, 5], moduli: [3, 5, 7, 11] },
            { residues: [4, 0, 6], moduli: [5, 7, 11] },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            const expected = bruteForceCrt(input.residues, input.moduli);
            expect(final["value"]).toBe(expected);
            expect(final["allResiduesMatch"]).toBe(true);
            input.moduli.forEach((m, i) => {
                expect(((Number(final["value"]) % m) + m) % m).toBe(
                    ((input.residues[i]! % m) + m) % m,
                );
            });
        }
    });

    it("handles a single congruence and empty input", () => {
        const single = [...mod.run({ residues: [4], moduli: [9] })];
        expect(single[single.length - 1]!.meta["value"]).toBe(4);
        const empty = [...mod.run({ residues: [], moduli: [] })];
        expect(empty[0]!.meta["value"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
