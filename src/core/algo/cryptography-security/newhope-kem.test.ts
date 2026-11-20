/** newhope-kem.test.ts - Ring arithmetic, ciphertext equations, bit round trips. */

import { describe, expect, it } from "vitest";
import mod, { buildNewHope, polyMul, polyOp } from "./newhope-kem";
import type { VisualFrame } from "@/types";

interface Input {
    message: number;
    n: number;
    q: number;
    seed: number;
}

const mq = (v: number, q: number): number => ((v % q) + q) % q;

/** Independent negacyclic convolution used to verify the module's arithmetic. */
function mul(a: number[], b: number[], n: number, q: number): number[] {
    const out = Array(n).fill(0) as number[];
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const sign = i + j >= n ? -1 : 1;
            out[(i + j) % n] = mq((out[(i + j) % n] ?? 0) + sign * (a[i] ?? 0) * (b[j] ?? 0), q);
        }
    }
    return out;
}
const add = (a: number[], b: number[], n: number, q: number): number[] =>
    Array.from({ length: n }, (_, i) => mq((a[i] ?? 0) + (b[i] ?? 0), q));

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 2);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("NewHope KEM toy model", () => {
    it("satisfies the public-key and ciphertext polynomial equations", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, 15);
        const final = frames[frames.length - 1]?.meta;
        const n = input.n;
        const q = input.q;
        const a = final?.["a"] as number[];
        const s = final?.["s"] as number[];
        const e = final?.["e"] as number[];
        const b = final?.["b"] as number[];
        const r = final?.["r"] as number[];
        const e1 = final?.["e1"] as number[];
        const e2 = final?.["e2"] as number[];
        const u = final?.["u"] as number[];
        const v = final?.["v"] as number[];
        const w = final?.["w"] as number[];
        expect(b).toEqual(add(mul(a, s, n, q), e, n, q));
        expect(u).toEqual(add(mul(a, r, n, q), e1, n, q));
        const enc = Array(n).fill(0) as number[];
        enc[0] = input.message === 1 ? Math.floor(q / 2) : 0;
        expect(v).toEqual(add(add(mul(b, r, n, q), e2, n, q), enc, n, q));
        const us = mul(u, s, n, q);
        expect(w).toEqual(Array.from({ length: n }, (_, i) => mq((v[i] ?? 0) - (us[i] ?? 0), q)));
        expect(final?.["decoded"]).toBe(input.message);
    });

    it("round-trips both bits over many seeds", () => {
        for (const seed of [1, 7, 42, 20261118, 999983]) {
            for (const message of [0, 1]) {
                const frames = [...mod.run({ message, n: 8, q: 97, seed })];
                const final = frames[frames.length - 1]?.meta;
                expect(final?.["decoded"]).toBe(message);
                expect(final?.["agreed"]).toBe(true);
                const center = Math.abs(Number(final?.["center"]));
                if (message === 1) {
                    expect(center).toBeGreaterThan(97 / 4);
                } else {
                    expect(center).toBeLessThan(97 / 4);
                }
            }
        }
    });

    it("exported ring operations match the independent convolution", () => {
        const a = [1, 2, 3, 4];
        const b = [4, 3, 2, 1];
        expect(polyMul(a, b, 4, 97)).toEqual(mul(a, b, 4, 97));
        expect(polyOp(a, b, 4, 97, 1)).toEqual(add(a, b, 4, 97));
        expect(buildNewHope(8, 97, 1, 11).decoded).toBe(1);
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
