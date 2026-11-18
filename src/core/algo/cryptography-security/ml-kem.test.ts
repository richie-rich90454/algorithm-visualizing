/**
 * ml-kem.test.ts - Rounding/reconciliation correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./ml-kem";
import type { VisualFrame } from "@/types";

const Q = 3329;

function posMod(value: number, modulus: number): number {
    return ((value % modulus) + modulus) % modulus;
}

function compress(value: number, d: number): number {
    return posMod(Math.round((2 ** d / Q) * value), 2 ** d);
}

function decompress(value: number, d: number): number {
    return posMod(Math.round((Q / 2 ** d) * value), Q);
}

function encodeBit(bit: number): number {
    return posMod(Math.round((Q / 2) * bit), Q);
}

function decodeBit(value: number): number {
    return posMod(Math.round((2 / Q) * value), 2);
}

function checkFrames(frames: VisualFrame[], width: number): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(5 * width);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("ML-KEM", () => {
    it("matches an independent compress, decompress, and bit codec", () => {
        const input = mod.defaultInput as { coefficients: number[]; bits: number[]; d: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.coefficients.length);
        const meta = frames[frames.length - 1]?.meta;
        const expectedCompressed = input.coefficients.map((value) => compress(value, input.d));
        const expectedRecovered = expectedCompressed.map((value) => decompress(value, input.d));
        const expectedDecoded = input.bits.map((bit) => decodeBit(encodeBit(bit)));
        expect(meta?.["compressed"]).toEqual(expectedCompressed);
        expect(meta?.["recovered"]).toEqual(expectedRecovered);
        expect(meta?.["decoded"]).toEqual(expectedDecoded);
    });

    it("keeps the rounding error small over many coefficients and widths", () => {
        for (const d of [4, 8, 10, 12]) {
            const coefficients = [0, 1, 500, 1664, 2500, Q - 1, 777];
            const frames = [...mod.run({ coefficients, bits: [0, 1, 0, 1, 1, 0, 1], d })];
            checkFrames(frames, coefficients.length);
            const recovered = frames[frames.length - 1]?.meta["recovered"] as number[];
            for (let i = 0; i < coefficients.length; i += 1) {
                const raw = Math.abs((recovered[i] ?? 0) - (coefficients[i] ?? 0));
                expect(Math.min(raw, Q - raw)).toBeLessThanOrEqual(Math.ceil(Q / 2 ** (d + 1)) + 1);
            }
            expect(frames[frames.length - 1]?.meta["decoded"]).toEqual([0, 1, 0, 1, 1, 0, 1]);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
