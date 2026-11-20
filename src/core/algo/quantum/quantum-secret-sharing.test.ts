/**
 * quantum-secret-sharing.test.ts - Independent circuit simulation, parity law, reduced state, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-secret-sharing";
import type { VisualFrame } from "@/types";

const INV_SQRT2 = Math.SQRT1_2;

function hadamardOn(state: Array<[number, number]>, q: number): Array<[number, number]> {
    const mask = 1 << (2 - q);
    const next = [...state];
    for (let i = 0; i < 8; i += 1) {
        if ((i & mask) !== 0) continue;
        const j = i | mask;
        const a = state[i] ?? [0, 0];
        const b = state[j] ?? [0, 0];
        next[i] = [(a[0] + b[0]) * INV_SQRT2, (a[1] + b[1]) * INV_SQRT2];
        next[j] = [(a[0] - b[0]) * INV_SQRT2, (a[1] - b[1]) * INV_SQRT2];
    }
    return next;
}

function parity(index: number): number {
    let bits = index;
    let result = 0;
    while (bits !== 0) {
        result ^= bits & 1;
        bits >>= 1;
    }
    return result;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const amplitudes = toPairs(frame.meta["amplitudes"] as number[]);
        const norm = amplitudes.reduce((sum, z) => sum + (z[0] ?? 0) ** 2 + (z[1] ?? 0) ** 2, 0);
        expect(norm).toBeCloseTo(1, 10);
    });
}

function toPairs(flat: number[]): Array<[number, number]> {
    return Array.from({ length: flat.length / 2 }, (_, i) => [flat[2 * i] ?? 0, flat[2 * i + 1] ?? 0]);
}

describe("QuantumSecretSharing", () => {
    it("matches an independent Hadamard circuit and the parity probability law", () => {
        for (const theta of [0, 0.4, Math.PI / 3, Math.PI / 2, 2.5]) {
            const frames = [...mod.run({ theta })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;

            const encoded = Array.from({ length: 8 }, () => [0, 0] as [number, number]);
            encoded[0] = [INV_SQRT2, 0];
            encoded[7] = [Math.cos(theta) * INV_SQRT2, Math.sin(theta) * INV_SQRT2];
            let measured = encoded;
            for (let q = 0; q < 3; q += 1) measured = hadamardOn(measured, q);

            const amplitudes = toPairs(meta?.["amplitudes"] as number[]);
            for (let i = 0; i < 8; i += 1) {
                expect(amplitudes[i]?.[0]).toBeCloseTo(measured[i]?.[0] ?? 0, 10);
                expect(amplitudes[i]?.[1]).toBeCloseTo(measured[i]?.[1] ?? 0, 10);
                const expected = (1 + (parity(i) === 0 ? 1 : -1) * Math.cos(theta)) / 8;
                expect((meta?.["probabilities"] as number[])[i]).toBeCloseTo(expected, 10);
            }
            expect(meta?.["evenParityProbability"] as number).toBeCloseTo(Math.cos(theta / 2) ** 2, 10);
            expect(meta?.["oddParityProbability"] as number).toBeCloseTo(Math.sin(theta / 2) ** 2, 10);
        }
    });

    it("leaves every single qubit maximally mixed", () => {
        const frames = [...mod.run({ theta: 1.1 })];
        const probabilities = frames[frames.length - 1]?.meta["probabilities"] as number[];
        for (let q = 0; q < 3; q += 1) {
            const mask = 1 << (2 - q);
            let zero = 0;
            let one = 0;
            for (let i = 0; i < 8; i += 1) {
                if ((i & mask) === 0) zero += probabilities[i] ?? 0;
                else one += probabilities[i] ?? 0;
            }
            expect(zero).toBeCloseTo(0.5, 10);
            expect(one).toBeCloseTo(0.5, 10);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
