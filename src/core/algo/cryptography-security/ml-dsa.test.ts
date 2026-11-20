/**
 * ml-dsa.test.ts - Toy ring multiplication correctness, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./ml-dsa";
import type { VisualFrame } from "@/types";

const modv = (value: number, q: number): number => ((value % q) + q) % q;

/** Independent reference: full polynomial product, then reduce modulo x^n + 1. */
function reference(a: number[], b: number[], n: number, q: number): number[] {
    const full = new Array<number>(2 * n - 1).fill(0);
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            full[i + j] = (full[i + j] ?? 0) + (a[i] ?? 0) * (b[j] ?? 0);
        }
    }
    const out: number[] = [];
    for (let k = 0; k < n; k += 1) {
        const wrapped = k + n < full.length ? (full[k + n] ?? 0) : 0;
        out.push(modv((full[k] ?? 0) - wrapped, q));
    }
    return out;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("ML-DSA toy ring multiplication", () => {
    it("matches full multiply-then-reduce and is commutative", () => {
        const input = mod.defaultInput as { n: number; q: number; a: number[]; b: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.n);
        const product = frames[frames.length - 1]?.meta["product"] as number[];
        expect(product).toEqual(reference(input.a, input.b, input.n, input.q));
        const reversed = [...mod.run({ ...input, a: input.b, b: input.a })].pop()?.meta["product"];
        expect(product).toEqual(reversed);
    });

    it("agrees with the reference on other small rings", () => {
        const cases = [
            { n: 2, q: 13, a: [3, 4], b: [5, 6] },
            { n: 4, q: 97, a: [1, 0, 2, 3], b: [4, 5, 0, 7] },
        ];
        for (const input of cases) {
            const product = [...mod.run(input)].pop()?.meta["product"] as number[];
            expect(product).toEqual(reference(input.a, input.b, input.n, input.q));
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
