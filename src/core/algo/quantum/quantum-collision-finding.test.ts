/**
 * quantum-collision-finding.test.ts - Collision correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-collision-finding";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function bruteMarked(values: number[]): number {
    let count = 0;
    for (let i = 0; i < values.length; i += 1) {
        for (let j = i + 1; j < values.length; j += 1) {
            if (values[i] === values[j]) {
                count += 1;
            }
        }
    }
    return count;
}

describe("Quantum Collision Finding", () => {
    it("returns a genuine collision and matches brute-force marking", () => {
        const values = [0, 1, 2, 0, 3, 1, 4, 2, 5, 3, 6, 4];
        const frames = [...mod.run({ values })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const pair = final?.["pair"] as number[];
        expect(final?.["found"]).toBe(true);
        expect(pair[0]).not.toBe(pair[1]);
        expect(values[pair[0] as number]).toBe(values[pair[1] as number]);
        expect(Number(final?.["marked"])).toBe(bruteMarked(values));
    });

    it("handles multiple valid collision tables", () => {
        const cases = [
            [1, 1, 2, 3],
            [5, 6, 5, 6, 5],
            [9, 8, 7, 9],
        ];
        for (const values of cases) {
            const frames = [...mod.run({ values })];
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["found"]).toBe(true);
            const pair = final?.["pair"] as number[];
            expect(values[pair[0] as number]).toBe(values[pair[1] as number]);
            expect(Number(final?.["marked"])).toBe(bruteMarked(values));
        }
    });

    it("reports no collision for an injective table", () => {
        const frames = [...mod.run({ values: [0, 1, 2, 3, 4] })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["found"]).toBe(false);
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
