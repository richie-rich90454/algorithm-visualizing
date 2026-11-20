/**
 * sha3-keccak-f1600.test.ts - Independent round replay, hand-computed steps, frame shape.
 */

import { describe, expect, it } from "vitest";
import mod, { keccakRound, rotl64, seedState } from "./sha3-keccak-f1600";
import type { VisualFrame } from "@/types";

const MASK = (1n << 64n) - 1n;

/** Rotation offsets as r[x][y] from the Keccak specification. */
const R: number[][] = [
    [0, 36, 3, 41, 18],
    [1, 44, 10, 45, 2],
    [62, 6, 43, 15, 61],
    [28, 55, 25, 21, 56],
    [27, 20, 39, 8, 14],
];

function referenceRotl(value: bigint, n: number): bigint {
    if (n === 0) {
        return value & MASK;
    }
    return (((value << BigInt(n)) & MASK) | (value >> BigInt(64 - n))) & MASK;
}

/** Independent round implementation using the Keccak [x][y] lane convention. */
function referenceRound(input: bigint[]) {
    const s = input.slice(0, 25).map((lane) => lane & MASK);
    const c: bigint[] = [];
    for (let x = 0; x < 5; x += 1) {
        c.push(s[x]! ^ s[x + 5]! ^ s[x + 10]! ^ s[x + 15]! ^ s[x + 20]!);
    }
    const d: bigint[] = [];
    for (let x = 0; x < 5; x += 1) {
        d.push(c[(x + 4) % 5]! ^ referenceRotl(c[(x + 1) % 5]!, 1));
    }
    for (let i = 0; i < 25; i += 1) {
        s[i] = s[i]! ^ d[i % 5]!;
    }
    const theta = s.slice();

    const b = Array<bigint>(25).fill(0n);
    for (let y = 0; y < 5; y += 1) {
        for (let x = 0; x < 5; x += 1) {
            const col = y;
            const row = (2 * x + 3 * y) % 5;
            b[col + 5 * row] = referenceRotl(s[x + 5 * y]!, R[x]![y]!);
        }
    }
    const rhoPi = b.slice();

    const chi = Array<bigint>(25).fill(0n);
    for (let y = 0; y < 5; y += 1) {
        for (let x = 0; x < 5; x += 1) {
            const here = b[x + 5 * y]!;
            const nxt = b[((x + 1) % 5) + 5 * y]!;
            const nn = b[((x + 2) % 5) + 5 * y]!;
            chi[x + 5 * y] = here ^ (~nxt & nn & MASK);
        }
    }
    const iota = chi.slice();
    iota[0] = iota[0]! ^ 1n;
    return { theta, rhoPi, chi, iota };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(6);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(25);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(5);
        expect(frame.meta["cols"]).toBe(5);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const state = frame.meta["state"] as string[];
        expect(state.length).toBe(25);
        for (const hex of state) {
            expect(hex).toMatch(/^[0-9a-f]{16}$/);
        }
    });
}

describe("SHA-3 Keccak-f[1600] Round", () => {
    it("rotates 64-bit lanes correctly", () => {
        expect(rotl64(1n, 0)).toBe(1n);
        expect(rotl64(1n, 1)).toBe(2n);
        expect(rotl64(1n, 63)).toBe(1n << 63n);
        expect(rotl64(1n << 63n, 1)).toBe(1n);
        expect(rotl64(0x0123456789abcdefn, 4)).toBe(0x123456789abcdef0n);
    });

    it("matches an independent round implementation at every stage", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const start = seedState();
        const actual = keccakRound(start);
        const expected = referenceRound(start);
        expect(actual.afterTheta).toEqual(expected.theta);
        expect(actual.afterRhoPi).toEqual(expected.rhoPi);
        expect(actual.afterChi).toEqual(expected.chi);
        expect(actual.afterIota).toEqual(expected.iota);
        const finalState = frames[5]?.meta["state"] as string[];
        expect(finalState[0]).toBe((expected.iota[0] ?? 0n).toString(16).padStart(16, "0"));
    });

    it("matches hand-computed theta and iota behavior", () => {
        const state = Array<bigint>(25).fill(0n);
        state[0] = 1n; // lane (x=0, y=0)
        const { afterTheta, afterIota } = keccakRound(state);
        // Column parities: C[0] = 1, rest 0. D[1] = C[0] = 1, D[4] = rotl(C[0],1) = 2.
        expect(afterTheta[0]).toBe(1n);
        expect(afterTheta[1 + 5 * 0]).toBe(1n);
        expect(afterTheta[4 + 5 * 0]).toBe(2n);
        // The all-zero state has zero parity; only iota turns lane 0 into the constant 1.
        const zero = keccakRound(Array<bigint>(25).fill(0n));
        expect(zero.afterTheta.every((lane) => lane === 0n)).toBe(true);
        expect(zero.afterChi[0]).toBe(0n);
        expect(zero.afterIota[0]).toBe(1n);
        expect(zero.afterIota.slice(1).every((lane) => lane === 0n)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
