/** gaussian-integer-gcd.test.ts - Brute-force divisibility cross-check, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./gaussian-integer-gcd";
import type { VisualFrame } from "@/types";

type Gaussian = [number, number];

const norm = (z: Gaussian): number => z[0] * z[0] + z[1] * z[1];

/** Exact divisibility test in Z[i], independent of the module's algorithm. */
function divides(g: Gaussian, x: Gaussian): boolean {
    const n = norm(g);
    if (n === 0) return false;
    const re = (x[0] * g[0] + x[1] * g[1]) / n;
    const im = (x[1] * g[0] - x[0] * g[1]) / n;
    return Math.abs(re - Math.round(re)) < 1e-9 && Math.abs(im - Math.round(im)) < 1e-9;
}

/** Exhaustively find the largest norm of a common divisor in a bounded window. */
function bruteGcdNorm(a: Gaussian, b: Gaussian): number {
    let best = 0;
    for (let x = -24; x <= 24; x += 1) {
        for (let y = -24; y <= 24; y += 1) {
            const candidate: Gaussian = [x, y];
            if (norm(candidate) > 0 && divides(candidate, a) && divides(candidate, b)) {
                best = Math.max(best, norm(candidate));
            }
        }
    }
    return best;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Gaussian Integer GCD", () => {
    it("matches a brute-force maximal-norm common divisor on random inputs", () => {
        let seed = 7;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return (seed % 17) - 8;
        };
        for (let t = 0; t < 24; t += 1) {
            const a: Gaussian = [rand(), rand()];
            const b: Gaussian = [rand(), rand()];
            if (norm(a) === 0 || norm(b) === 0) continue;
            const frames = [...mod.run({ a, b })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const g: Gaussian = [Number(final?.["gcdRe"]), Number(final?.["gcdIm"])];
            expect(norm(g)).toBeGreaterThan(0);
            expect(divides(g, a)).toBe(true);
            expect(divides(g, b)).toBe(true);
            expect(norm(g)).toBe(bruteGcdNorm(a, b));
        }
    });

    it("returns a unit for coprime inputs and a nonunit for shared factors", () => {
        const coprime = [...mod.run({ a: [7, 4], b: [3, 2] })];
        expect(coprime[coprime.length - 1]?.meta["norm"]).toBe(1);

        const shared = [...mod.run({ a: [6, 0], b: [4, 2] })];
        const g: Gaussian = [
            Number(shared[shared.length - 1]?.meta["gcdRe"]),
            Number(shared[shared.length - 1]?.meta["gcdIm"]),
        ];
        expect(norm(g)).toBeGreaterThan(1);
        expect(divides(g, [6, 0])).toBe(true);
        expect(divides(g, [4, 2])).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
