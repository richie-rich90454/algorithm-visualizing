/** babai-nearest-plane.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./babai-nearest-plane";
import type { VisualFrame } from "@/types";

type Vec = number[];

function dist(a: Vec, b: Vec): number {
    return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const entity of frame.entities) {
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(Number.isFinite(entity.y)).toBe(true);
        }
    });
}

describe("Babai nearest plane", () => {
    it("returns a genuine lattice point within the approximation factor of optimal", () => {
        const basis: Vec[] = [
            [3, 1],
            [1, 2],
        ];
        const targets: Vec[] = [
            [4.1, 3.7],
            [0.3, -1.2],
            [7.6, 2.4],
            [-2.1, 5.5],
            [1.9, 1.1],
        ];
        for (const target of targets) {
            const frames = [...mod.run({ basis, target })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const closest = final?.["closest"] as Vec | undefined;
            const coeffs = final?.["coefficients"] as number[] | undefined;
            expect(closest).toBeDefined();
            expect(coeffs?.length).toBe(2);

            // The returned point must be the exact integer combination reported.
            const expected: Vec = [
                coeffs![0]! * basis[0]![0]! + coeffs![1]! * basis[1]![0]!,
                coeffs![0]! * basis[0]![1]! + coeffs![1]! * basis[1]![1]!,
            ];
            expect(expected[0]).toBeCloseTo(closest![0]!, 9);
            expect(expected[1]).toBeCloseTo(closest![1]!, 9);

            // Brute-force the true closest lattice point in a generous box.
            let best = Infinity;
            for (let i = -8; i <= 8; i += 1) {
                for (let j = -8; j <= 8; j += 1) {
                    const candidate: Vec = [
                        i * basis[0]![0]! + j * basis[1]![0]!,
                        i * basis[0]![1]! + j * basis[1]![1]!,
                    ];
                    best = Math.min(best, dist(candidate, target));
                }
            }
            const achieved = dist(expected, target);
            expect(achieved).toBeLessThanOrEqual(4 * best + 1e-9);
        }
    });

    it("terminates cleanly on the default input", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
