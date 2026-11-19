/**
 * blakley-secret-sharing.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./blakley-secret-sharing";
import type { VisualFrame } from "@/types";

interface Input {
    secret: number;
    prime: number;
    threshold: number;
    shares: number;
}

function combinations(n: number, k: number): number[][] {
    const out: number[][] = [];
    const pick = (start: number, chosen: number[]): void => {
        if (chosen.length === k) {
            out.push([...chosen]);
            return;
        }
        for (let i = start; i < n; i += 1) {
            chosen.push(i);
            pick(i + 1, chosen);
            chosen.pop();
        }
    };
    pick(0, []);
    return out;
}

function inverse(a: number, m: number): number {
    let oldR = ((a % m) + m) % m;
    let r = m;
    let oldS = 1;
    let s = 0;
    while (r !== 0) {
        const q = Math.floor(oldR / r);
        const nr = oldR - q * r;
        oldR = r;
        r = nr;
        const ns = oldS - q * s;
        oldS = s;
        s = ns;
    }
    return ((oldS % m) + m) % m;
}

/** Rank of a matrix modulo a prime. */
function rank(matrix: number[][], p: number): number {
    const rows = matrix.map((row) => [...row]);
    let r = 0;
    for (let c = 0; c < (rows[0]?.length ?? 0) && r < rows.length; c += 1) {
        let pivot = r;
        while (pivot < rows.length && ((rows[pivot]?.[c] ?? 0) % p) === 0) {
            pivot += 1;
        }
        if (pivot === rows.length) {
            continue;
        }
        const temp = rows[r];
        rows[r] = rows[pivot] ?? [];
        rows[pivot] = temp ?? [];
        const inv = inverse(rows[r]?.[c] ?? 1, p);
        rows[r] = (rows[r] ?? []).map((value) => (value * inv) % p);
        for (let i = 0; i < rows.length; i += 1) {
            if (i === r) {
                continue;
            }
            const factor = rows[i]?.[c] ?? 0;
            if (factor !== 0) {
                rows[i] = (rows[i] ?? []).map(
                    (value, j) => (((value - factor * (rows[r]?.[j] ?? 0)) % p) + p) % p,
                );
            }
        }
        r += 1;
    }
    return r;
}

/** Solve A x = b modulo p, returning the first coordinate. */
function firstCoordinate(matrix: number[][], b: number[], p: number, n: number): number {
    const rows = matrix.map((row, i) => [...row, b[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        while (pivot < n && ((rows[pivot]?.[col] ?? 0) % p) === 0) {
            pivot += 1;
        }
        const temp = rows[col];
        rows[col] = rows[pivot] ?? [];
        rows[pivot] = temp ?? [];
        const inv = inverse(rows[col]?.[col] ?? 1, p);
        rows[col] = (rows[col] ?? []).map((value) => (value * inv) % p);
        for (let i = 0; i < n; i += 1) {
            if (i === col) {
                continue;
            }
            const factor = rows[i]?.[col] ?? 0;
            if (factor !== 0) {
                rows[i] = (rows[i] ?? []).map(
                    (value, j) => (((value - factor * (rows[col]?.[j] ?? 0)) % p) + p) % p,
                );
            }
        }
    }
    return rows[0]?.[n] ?? -1;
}

function buildShares(input: Input): number[][] {
    const { secret, prime: p, threshold: k, shares: m } = input;
    const point = [secret];
    for (let c = 1; c < k; c += 1) {
        point.push((secret * 3 + c * 11) % p);
    }
    const rows: number[][] = [];
    for (let i = 0; i < m; i += 1) {
        const t = (i + 1) % p;
        const coefficients: number[] = [];
        let power = 1;
        for (let d = 0; d < k; d += 1) {
            coefficients.push(power);
            power = (power * t) % p;
        }
        let b = 0;
        for (let d = 0; d < k; d += 1) {
            b = (b + (coefficients[d] ?? 0) * (point[d] ?? 0)) % p;
        }
        rows.push([...coefficients, b]);
    }
    return rows;
}

function checkFrames(frames: VisualFrame[], input: Input): void {
    expect(frames.length).toBe(input.threshold + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("matrix");
        expect(frame.entities.length).toBe(input.shares * (input.threshold + 1));
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Blakley Secret Sharing", () => {
    it("the module recovers the secret with the first k shares", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["recovered"])).toBe(input.secret);
    });

    it("every threshold-sized subset reconstructs the secret", () => {
        const inputs: Input[] = [
            { secret: 42, prime: 97, threshold: 3, shares: 5 },
            { secret: 7, prime: 101, threshold: 2, shares: 4 },
            { secret: 88, prime: 127, threshold: 3, shares: 6 },
        ];
        for (const input of inputs) {
            const shares = buildShares(input);
            for (const subset of combinations(input.shares, input.threshold)) {
                const matrix = subset.map((i) => (shares[i] ?? []).slice(0, input.threshold));
                const b = subset.map((i) => shares[i]?.[input.threshold] ?? 0);
                expect(firstCoordinate(matrix, b, input.prime, input.threshold)).toBe(input.secret);
            }
        }
    });

    it("fewer than k shares leave the point undetermined", () => {
        const input: Input = { secret: 42, prime: 97, threshold: 3, shares: 5 };
        const shares = buildShares(input);
        for (const subset of combinations(input.shares, input.threshold - 1)) {
            const matrix = subset.map((i) => (shares[i] ?? []).slice(0, input.threshold));
            expect(rank(matrix, input.prime)).toBeLessThan(input.threshold);
        }
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
