/**
 * schoenhage-strassen.test.ts - Exact BigInt cross-check, frame shape, and
 * termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./schoenhage-strassen";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Schonhage-Strassen Multiplication", () => {
    it("matches exact BigInt multiplication", () => {
        const cases: Array<[bigint, bigint]> = [
            [123456789n, 987654321n],
            [0n, 987654321n],
            [1n, 1n],
            [255n, 256n],
            [12345678901234567890n, 98765432109876543210n],
            [2n ** 200n + 12345n, 2n ** 150n + 6789n],
        ];
        for (const [a, b] of cases) {
            const frames = [...mod.run({ a: a.toString(), b: b.toString() })];
            checkFrames(frames);
            const final = frames[frames.length - 1] as VisualFrame;
            expect(final.meta["product"]).toBe((a * b).toString());
        }
    });

    it("reproduces the worked example", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1] as VisualFrame;
        expect(final.meta["product"]).toBe("121932631112635269");
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
