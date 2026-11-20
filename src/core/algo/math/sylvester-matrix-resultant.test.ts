/**
 * sylvester-matrix-resultant.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./sylvester-matrix-resultant";
import type { VisualFrame } from "@/types";

interface Polynomial {
    leading: number;
    roots: number[];
}

/** Resultant from the root product a^n b^m prod(ri - sj) for known roots. */
function resultantByRoots(f: Polynomial, g: Polynomial): number {
    let product = f.leading ** g.roots.length * g.leading ** f.roots.length;
    for (const r of f.roots) {
        for (const s of g.roots) {
            product *= r - s;
        }
    }
    return product;
}

/** Expand (x - r1)(x - r2)... scaled by leading coefficient into coefficients. */
function coefficients(poly: Polynomial): number[] {
    let coeffs = [1];
    for (const root of poly.roots) {
        const next = new Array<number>(coeffs.length + 1).fill(0);
        for (let i = 0; i < coeffs.length; i += 1) {
            next[i] = (next[i] ?? 0) + (coeffs[i] ?? 0);
            next[i + 1] = (next[i + 1] ?? 0) - (coeffs[i] ?? 0) * root;
        }
        coeffs = next;
    }
    return coeffs.map((c) => c * poly.leading);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const entity of frame.entities) {
            expect(entity.type).toBe("cell");
            expect(Number.isInteger(entity.metadata.row)).toBe(true);
            expect(Number.isInteger(entity.metadata.col)).toBe(true);
        }
    });
}

describe("Sylvester Matrix Resultant", () => {
    it("matches the root-product formula", () => {
        const cases: Array<[Polynomial, Polynomial]> = [
            [{ leading: 1, roots: [1] }, { leading: 1, roots: [2] }],
            [{ leading: 1, roots: [1, -1] }, { leading: 1, roots: [2] }],
            [{ leading: 2, roots: [1, 3] }, { leading: 3, roots: [0, 4] }],
            [{ leading: 1, roots: [-2, 5] }, { leading: 1, roots: [1, 6] }],
        ];
        for (const [f, g] of cases) {
            const frames = [...mod.run({ f: coefficients(f), g: coefficients(g) })];
            checkFrames(frames);
            const resultant = Number(frames[frames.length - 1]?.meta["resultant"]);
            expect(resultant).toBe(resultantByRoots(f, g));
        }
    });

    it("returns zero when the polynomials share a root", () => {
        const f = { leading: 1, roots: [1, 2] };
        const g = { leading: 1, roots: [1, 3] };
        const frames = [...mod.run({ f: coefficients(f), g: coefficients(g) })];
        expect(Number(frames[frames.length - 1]?.meta["resultant"])).toBe(0);
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
