/** cyclegan.test.ts - Brute-force cycle losses, inverse-generator property, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./cyclegan";
import type { VisualFrame } from "@/types";

interface Input {
    a: number[];
    b: number[];
    sAB: number;
    bAB: number;
    sBA: number;
    bBA: number;
    lambda: number;
}

function reference(input: Input) {
    const gAB = (x: number) => input.sAB * x + input.bAB;
    const gBA = (y: number) => input.sBA * y + input.bBA;
    const ab = input.a.map(gAB);
    const aba = ab.map(gBA);
    const ba = input.b.map(gBA);
    const bab = ba.map(gAB);
    const idA = input.a.map(gBA);
    const idB = input.b.map(gAB);
    const cycleLossA = aba.reduce((s, v, i) => s + Math.abs(v - input.a[i]!), 0);
    const cycleLossB = bab.reduce((s, v, i) => s + Math.abs(v - input.b[i]!), 0);
    const identityLoss = idA.reduce((s, v, i) => s + Math.abs(v - input.a[i]!), 0)
        + idB.reduce((s, v, i) => s + Math.abs(v - input.b[i]!), 0);
    return { ab, aba, ba, bab, cycleLossA, cycleLossB, identityLoss, total: cycleLossA + cycleLossB + input.lambda * identityLoss };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("CycleGAN cycle consistency", () => {
    const cases: Input[] = [
        { a: [1, 2, 3], b: [0.5, 1, 1.5], sAB: 2, bAB: 0.3, sBA: 0.5, bBA: -0.2, lambda: 10 },
        { a: [-1, 0, 2], b: [3, -2], sAB: -1, bAB: 1, sBA: -1, bBA: 1, lambda: 5 },
        { a: [4], b: [4], sAB: 1, bAB: 0, sBA: 1, bBA: 0, lambda: 7 },
        mod.defaultInput as Input,
    ];

    it("matches a brute-force cycle computation", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            expect(Number(final?.["cycleLossA"])).toBeCloseTo(expected.cycleLossA, 9);
            expect(Number(final?.["cycleLossB"])).toBeCloseTo(expected.cycleLossB, 9);
            expect(Number(final?.["identityLoss"])).toBeCloseTo(expected.identityLoss, 9);
            expect(Number(final?.["total"])).toBeCloseTo(expected.total, 9);
            const ab = final?.["ab"] as number[];
            ab.forEach((v, i) => expect(v).toBeCloseTo(expected.ab[i]!, 9));
        }
    });

    it("vanishes for mutually inverse generators", () => {
        const input: Input = { a: [1, 2, 3], b: [0.5, 1], sAB: 2, bAB: 1, sBA: 0.5, bBA: -0.5, lambda: 10 };
        const final = [...mod.run(input)].at(-1)?.meta;
        expect(Number(final?.["cycleLossA"])).toBeCloseTo(0, 9);
        expect(Number(final?.["cycleLossB"])).toBeCloseTo(0, 9);
    });

    it("identity term is zero when each generator is the identity map", () => {
        const input: Input = { a: [1, -2], b: [3, 4], sAB: 1, bAB: 0, sBA: 1, bBA: 0, lambda: 10 };
        const final = [...mod.run(input)].at(-1)?.meta;
        expect(Number(final?.["identityLoss"])).toBeCloseTo(0, 9);
        expect(Number(final?.["total"])).toBeCloseTo(0, 9);
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
