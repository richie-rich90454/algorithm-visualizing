/**
 * quantum-lanczos.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-lanczos";
import type { VisualFrame } from "@/types";

/** Determinant of a tridiagonal (H - lambda I) by the leading-minor recurrence. */
function detShifted(diag: number[], off: number, lambda: number): number {
    let prev = 1;
    let cur = (diag[0] ?? 0) - lambda;
    for (let k = 1; k < diag.length; k += 1) {
        const next = ((diag[k] ?? 0) - lambda) * cur - off * off * prev;
        prev = cur;
        cur = next;
    }
    return cur;
}

/** Independent eigenvalues by scanning and bisecting characteristic roots. */
function trueEigenvalues(diag: number[], off: number): number[] {
    const lo = Math.min(...diag) - 3 * Math.abs(off) - 2;
    const hi = Math.max(...diag) + 3 * Math.abs(off) + 2;
    const roots: number[] = [];
    const steps = 20000;
    let left = lo;
    let fLeft = detShifted(diag, off, left);
    for (let i = 1; i <= steps; i += 1) {
        const right = lo + ((hi - lo) * i) / steps;
        const fRight = detShifted(diag, off, right);
        if (fLeft === 0) {
            roots.push(left);
        } else if (fLeft * fRight < 0) {
            let a = left;
            let b = right;
            for (let _ = 0; _ < 100; _ += 1) {
                const mid = (a + b) / 2;
                if (detShifted(diag, off, a) * detShifted(diag, off, mid) <= 0) {
                    b = mid;
                } else {
                    a = mid;
                }
            }
            roots.push((a + b) / 2);
        }
        left = right;
        fLeft = fRight;
    }
    return roots.sort((x, y) => x - y);
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["n"]).toBe(n);
    });
}

describe("Quantum Lanczos", () => {
    it("recovers the exact spectrum when the Krylov space is complete", () => {
        const cases = [
            { energies: [0, 2], coupling: 0.3 },
            { energies: [0, 1, 2], coupling: 0.3 },
            { energies: [-1, 0.5, 2], coupling: 0.2 },
        ];
        for (const testCase of cases) {
            const n = testCase.energies.length;
            const frames = [...mod.run({ ...testCase, initial: new Array<number>(n).fill(1), krylov: n })];
            checkFrames(frames, n);
            const final = frames[frames.length - 1]?.meta;
            const ritz = (final?.["ritzValues"] as number[]) ?? [];
            const exact = trueEigenvalues(testCase.energies, testCase.coupling);

            expect(ritz.length).toBe(n);
            ritz.forEach((value, i) => {
                expect(value).toBeCloseTo(exact[i] ?? 0, 5);
            });

            const lowest = Number(final?.["lowest"]);
            expect(lowest).toBeGreaterThanOrEqual((exact[0] ?? 0) - 1e-6);
        }
    });

    it("produces an orthonormal Krylov basis", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta;
        const gram = (final?.["gram"] as number[]) ?? [];
        const dim = Math.round(Math.sqrt(gram.length));
        expect(dim).toBe(3);
        gram.forEach((value, index) => {
            const row = Math.floor(index / dim);
            const col = index % dim;
            expect(value).toBeCloseTo(row === col ? 1 : 0, 8);
        });
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
