/**
 * dihedral-hidden-subgroup.test.ts - Modular sample law, gcd recovery, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./dihedral-hidden-subgroup";
import type { VisualFrame } from "@/types";

function gcd(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}

function checkFrames(frames: VisualFrame[], samples: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["rows"]).toBe(samples + 1);
        expect(frame.meta["cols"]).toBe(2);
        expect(frame.entities.length).toBe(2 * (samples + 1));
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("DihedralHiddenSubgroup", () => {
    it("recovers every hidden rotation step from ideal samples", () => {
        const cases = [
            [8, 2],
            [8, 4],
            [12, 2],
            [12, 3],
            [12, 4],
            [16, 2],
            [16, 4],
            [16, 8],
        ];
        for (const [n, d] of cases) {
            const frames = [...mod.run({ n, d })];
            const expectedSamples = d - 1;
            checkFrames(frames, expectedSamples);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["d"]).toBe(d);
            expect(final?.["recovered"]).toBe(d);
            expect(final?.["valid"]).toBe(true);
            const samples = final?.["samples"] as number[];
            expect(samples).toHaveLength(expectedSamples);
            samples.forEach((k) => {
                expect((k * d) % n).toBe(0);
            });
            const accumulated = samples.reduce((g, k) => gcd(g, k), 0);
            expect(n / accumulated).toBe(d);
        }
    });

    it("reports reflection bits bounded by one across samples", () => {
        const frames = [...mod.run({ n: 12, d: 3 })];
        const final = frames[frames.length - 1]?.meta;
        for (const bit of final?.["bits"] as number[]) {
            expect(bit === 0 || bit === 1).toBe(true);
        }
    });

    it("falls back safely on invalid divisor inputs", () => {
        const frames = [...mod.run({ n: 7, d: 3 })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["n"]).toBe(8);
        expect(final?.["d"]).toBe(2);
        expect(final?.["recovered"]).toBe(2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBe(6);
        expect(frames[frames.length - 1]?.stepNumber).toBe(frames.length - 1);
        expect(generator.next().done).toBe(true);
    });
});
