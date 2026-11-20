/** beaver-triples-mpc.test.ts - Brute-force and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./beaver-triples-mpc";
import type { VisualFrame } from "@/types";

function modValue(value: number, p: number): number {
    return ((value % p) + p) % p;
}

/** Independent reconstruction of the secret product. */
function reference(x: number, y: number, a: number, b: number, p: number) {
    const c = modValue(a * b, p);
    const d = modValue(x - a, p);
    const e = modValue(y - b, p);
    const product = modValue(c + d * b + e * a + d * e, p);
    return { c, d, e, product, direct: modValue(x * y, p) };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(6);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Beaver triples MPC toy", () => {
    it("reconstructs the product for many random-looking inputs", () => {
        const prime = 97;
        let seed = 12345;
        const next = () => {
            seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
            return seed;
        };
        for (let trial = 0; trial < 200; trial += 1) {
            const x = next() % prime;
            const y = next() % prime;
            const a = next() % prime;
            const b = next() % prime;
            const expected = reference(x, y, a, b, prime);
            expect(expected.product).toBe(expected.direct);
        }
    });

    it("matches the module output on the default and alternate inputs", () => {
        const cases = [
            { p: 97, x: 15, y: 20, a: 7, b: 11 },
            { p: 101, x: 40, y: 33, a: 9, b: 2 },
            { p: 23, x: 5, y: 19, a: 4, b: 6 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = reference(input.x, input.y, input.a, input.b, input.p);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["tripleValid"]).toBe(true);
            expect(finalMeta?.["d"]).toBe(expected.d);
            expect(finalMeta?.["e"]).toBe(expected.e);
            expect(finalMeta?.["product"]).toBe(expected.product);
            expect(finalMeta?.["direct"]).toBe(expected.direct);
            expect(finalMeta?.["correct"]).toBe(true);
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
