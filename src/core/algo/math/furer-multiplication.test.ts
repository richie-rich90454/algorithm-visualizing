/** furer-multiplication.test.ts - BigInt cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./furer-multiplication";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Furer-style FFT multiplication", () => {
    it("returns the exact BigInt product for many inputs", () => {
        const cases: Array<[number, number]> = [
            [12345, 6789],
            [999, 999],
            [1000000, 1000000],
            [7, 13],
            [987654321, 123456789],
            [0, 12345],
            [1001, 1001],
        ];
        for (const [a, b] of cases) {
            const frames = [...mod.run({ a, b })];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            expect(final["matches"]).toBe(true);
            expect(final["product"]).toBe((BigInt(a) * BigInt(b)).toString());
        }
    });

    it("handles large limb counts with many carries", () => {
        const a = 999999999999;
        const b = 999999999999;
        const frames = [...mod.run({ a, b })];
        const final = frames[frames.length - 1]!.meta;
        expect(final["product"]).toBe((BigInt(a) * BigInt(b)).toString());
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
