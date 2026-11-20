/** cipollas-algorithm.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./cipollas-algorithm";
import type { VisualFrame } from "@/types";

function modPow(a: number, e: number, m: number): number {
    let r = 1;
    let base = ((a % m) + m) % m;
    let exp = e;
    while (exp > 0) {
        if (exp % 2 === 1) r = (r * base) % m;
        base = (base * base) % m;
        exp = Math.floor(exp / 2);
    }
    return r;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

const primes = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 41, 43, 101];

describe("Cipolla's algorithm", () => {
    it("finds a square root for every quadratic residue and rejects non-residues", () => {
        for (const p of primes) {
            const residues = new Set<number>();
            for (let x = 0; x < p; x += 1) residues.add((x * x) % p);
            for (let n = 0; n < p; n += 1) {
                const frames = [...mod.run({ n, p })];
                checkFrames(frames);
                const root = frames[frames.length - 1]?.meta["root"] as number;
                if (residues.has(n)) {
                    expect(root).toBeGreaterThanOrEqual(0);
                    expect(modPow(root, 2, p)).toBe(n % p);
                } else {
                    expect(root).toBe(-1);
                }
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
