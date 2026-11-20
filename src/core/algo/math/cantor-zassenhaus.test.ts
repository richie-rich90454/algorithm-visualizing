/** cantor-zassenhaus.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./cantor-zassenhaus";
import type { VisualFrame } from "@/types";

type Poly = number[];
const trim = (a: Poly): Poly => {
    const r = a.slice();
    while (r.length > 1 && r[r.length - 1] === 0) r.pop();
    return r;
};
const trimInPlace = (a: Poly): Poly => {
    while (a.length > 1 && a[a.length - 1] === 0) a.pop();
    return a;
};
const deg = (a: Poly): number => a.length - 1;
const mul = (a: Poly, b: Poly): Poly => {
    const r = Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < b.length; j += 1) if (a[i] && b[j]) r[i + j] ^= 1;
    }
    return trim(r);
};
function divmod(a: Poly, b: Poly): [Poly, Poly] {
    const rem = a.slice();
    const q = Array(Math.max(1, a.length - b.length + 1)).fill(0);
    while (!(rem.length === 1 && rem[0] === 0) && deg(rem) >= deg(b)) {
        const shift = deg(rem) - deg(b);
        q[shift] ^= 1;
        for (let i = 0; i < b.length; i += 1) rem[i + shift] ^= b[i];
        trimInPlace(rem);
    }
    return [trim(q), rem];
}
const divides = (f: Poly, g: Poly): boolean => {
    const r = divmod(f, g)[1];
    return r.length === 1 && r[0] === 0;
};
function irreducible(f: Poly): boolean {
    for (let e = 1; e <= Math.floor(deg(f) / 2); e += 1) {
        for (let mask = 0; mask < 1 << e; mask += 1) {
            const cand = Array(e + 1).fill(0);
            cand[e] = 1;
            for (let k = 0; k < e; k += 1) cand[k] = (mask >> k) & 1;
            if (divides(f, cand)) return false;
        }
    }
    return true;
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

const IRR: Record<number, Poly[]> = {
    1: [[0, 1], [1, 1]],
    2: [[1, 1, 1]],
    3: [[1, 1, 0, 1], [1, 0, 1, 1]],
    4: [[1, 1, 0, 0, 1], [1, 0, 0, 1, 1], [1, 1, 1, 1, 1]],
};

const CASES: Array<Array<[number, number]>> = [
    [[2, 0]],
    [[3, 0], [3, 1]],
    [[1, 0], [2, 0], [4, 0]],
    [[1, 1], [3, 0], [4, 1]],
];

describe("Cantor-Zassenhaus factorization", () => {
    it("factors squarefree polynomials into irreducibles", () => {
        for (const factors of CASES) {
            const f = factors.reduce((acc, [d, idx]) => mul(acc, IRR[d]![idx]!), [1]);
            const frames = [...mod.run({ polynomial: f })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const found = (meta?.["factors"] as string[]).map((s) => s.split(",").map(Number));
            expect(found.length).toBe(factors.length);
            for (const factor of found) expect(irreducible(factor)).toBe(true);
            expect(meta?.["product"]).toBe(f.join(","));
            const expected = factors.map(([d]) => d).sort((a, b) => a - b);
            expect(found.map(deg).sort((a, b) => a - b)).toEqual(expected);
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
