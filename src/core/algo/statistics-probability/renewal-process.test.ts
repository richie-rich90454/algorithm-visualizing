/**
 * renewal-process.test.ts - Renewal-equation and frame-shape checks.
 */

import { describe, expect, it } from "vitest";
import mod, { countRenewals, renewalEpochs, renewalMass } from "./renewal-process";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Enumerate every ordered composition of t using allowed gap lengths. */
function bruteMass(t: number, pmf: number[]): number {
    if (t === 0) {
        return 1;
    }
    let total = 0;
    for (let k = 1; k < pmf.length && k <= t; k += 1) {
        if (pmf[k] === 0) {
            continue;
        }
        total += pmf[k]! * bruteMass(t - k, pmf);
    }
    return total;
}

describe("Renewal process", () => {
    it("accumulates epochs and counts renewals", () => {
        const gaps = [1, 2, 1, 3];
        expect(renewalEpochs(gaps)).toEqual([1, 3, 4, 7]);
        expect(countRenewals([1, 3, 4, 7], 0)).toBe(0);
        expect(countRenewals([1, 3, 4, 7], 3)).toBe(2);
        expect(countRenewals([1, 3, 4, 7], 8)).toBe(4);
    });

    it("matches brute-force enumeration of all gap compositions", () => {
        for (const pmf of [
            [0, 0.5, 0.3, 0.2],
            [0, 1],
            [0, 0.25, 0.25, 0.25, 0.25],
        ]) {
            const horizon = 11;
            const mass = renewalMass(pmf, horizon);
            for (let t = 0; t <= horizon; t += 1) {
                expect(mass[t]).toBeCloseTo(bruteMass(t, pmf), 10);
            }
        }
    });

    it("produces well-formed frames with consistent meta sequences", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta as {
            epochs: number[];
            counting: number[];
            mass: number[];
            done: boolean;
        };
        expect(final.done).toBe(true);
        expect(final.epochs).toEqual(renewalEpochs([1, 2, 1, 3, 2, 1]));
        for (let t = 0; t < final.counting.length; t += 1) {
            expect(final.counting[t]).toBe(countRenewals(final.epochs, t));
        }
        expect(final.mass[0]).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(3);
        expect(generator.next().done).toBe(true);
    });
});
