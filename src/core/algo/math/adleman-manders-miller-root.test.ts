/** adleman-manders-miller-root.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./adleman-manders-miller-root";
import type { VisualFrame } from "@/types";

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

function powMod(a: number, e: number, m: number): number {
    let r = 1;
    let b = ((a % m) + m) % m;
    let x = e;
    while (x > 0) {
        if (x % 2 === 1) r = (r * b) % m;
        b = (b * b) % m;
        x = Math.floor(x / 2);
    }
    return r;
}

function isPrime(n: number): boolean {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d += 1) if (n % d === 0) return false;
    return true;
}

describe("Adleman-Manders-Miller root", () => {
    it("finds r-th roots for every residue and rejects non-residues", () => {
        const primes = [7, 11, 13, 17, 19, 23, 29, 31, 41, 53, 61, 71, 101];
        for (const p of primes) {
            const rs = Array.from({ length: p - 1 }, (_, i) => i + 1).filter(
                (r) => isPrime(r) && (p - 1) % r === 0,
            );
            for (const r of rs) {
                const residues = new Set<number>();
                for (let x = 0; x < p; x += 1) residues.add(powMod(x, r, p));
                for (let a = 0; a < p; a += 1) {
                    const frames = [...mod.run({ a, r, p })];
                    checkFrames(frames);
                    const final = frames[frames.length - 1]?.meta;
                    const root = final?.["root"] as number;
                    if (residues.has(a)) {
                        expect(root).toBeGreaterThanOrEqual(0);
                        expect(powMod(root, r, p)).toBe(a);
                        if (final?.["verified"] === false) {
                            throw new Error(`unverified root for a=${a}, r=${r}, p=${p}`);
                        }
                    } else {
                        expect(root).toBe(-1);
                    }
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
