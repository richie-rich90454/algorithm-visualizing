/** quadratic-integer-factorization.test.ts - Splitting law, frames, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./quadratic-integer-factorization";
import type { VisualFrame } from "@/types";

const modn = (n: number, m: number): number => ((n % m) + m) % m;
function powMod(a: number, e: number, m: number): number {
    let r = 1;
    let b = modn(a, m);
    while (e > 0) {
        if (e % 2 === 1) r = (r * b) % m;
        b = (b * b) % m;
        e = Math.floor(e / 2);
    }
    return r;
}
function legendre(a: number, p: number): number {
    const v = modn(a, p);
    if (v === 0) return 0;
    const r = powMod(v, Math.floor((p - 1) / 2), p);
    return r === 1 ? 1 : r === p - 1 ? -1 : 0;
}
function kronecker(D: number, p: number): number {
    if (p === 2) {
        if (D % 2 === 0) return 0;
        const r = modn(D, 8);
        return r === 1 || r === 7 ? 1 : r === 3 || r === 5 ? -1 : 0;
    }
    return legendre(D, p);
}
function hasRoot(a: number, p: number): boolean {
    for (let x = 0; x < p; x += 1) if (modn(x * x, p) === modn(a, p)) return true;
    return false;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        frame.entities.forEach((e) => expect(e.type).toBe("cell"));
    });
}

describe("Prime factorization in quadratic integer rings", () => {
    it("agrees with brute-force square-root tests for several fields", () => {
        for (const d of [2, 3, 5, 6, 7, 11]) {
            const primes = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 2];
            const frames = [...mod.run({ d, primes })];
            checkFrames(frames, primes.length);
            frames.slice(1, -1).forEach((frame, i) => {
                const p = primes[i]!;
                const symbol = Number(frame.meta["symbol"]);
                const type = String(frame.meta["type"]);
                const D = Number(frame.meta["discriminant"]);
                expect(D).toBe(modn(d, 4) === 1 ? d : 4 * d);
                expect(symbol).toBe(kronecker(D, p));
                if (symbol === 1) {
                    expect(type).toBe("split");
                    const x = Number(frame.meta["x"]);
                    expect(modn(x * x, p)).toBe(modn(d, p));
                } else if (symbol === -1) {
                    expect(type).toBe("inert");
                    if (p !== 2) expect(hasRoot(d, p)).toBe(false);
                } else {
                    expect(type).toBe("ramified");
                }
            });
        }
    });

    it("handles the ramified prime dividing the field discriminant", () => {
        const frames = [...mod.run({ d: 2, primes: [2] })];
        checkFrames(frames, 1);
        expect(frames[1]!.meta["type"]).toBe("ramified");
        expect(Number(frames[1]!.meta["symbol"])).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
