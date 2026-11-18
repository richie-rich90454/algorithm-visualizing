/**
 * format-preserving-encryption.test.ts - Feistel reference, exhaustive domain,
 * frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./format-preserving-encryption";
import type { VisualFrame } from "@/types";

function roundFunction(round: number, value: number, key: number, modulus: number): number {
    return (key + value * (round + 1) + round * round * 7 + 13) % modulus;
}

function reference(text: string, key: number, rounds: number) {
    const half = text.length / 2;
    const modulus = 10 ** half;
    let left = Number(text.slice(0, half));
    let right = Number(text.slice(half));
    const trace: number[][] = [];
    for (let r = 0; r < rounds; r += 1) {
        const f = roundFunction(r, right, key, modulus);
        const nextRight = (left + f) % modulus;
        trace.push([left, right, f, nextRight]);
        left = right;
        right = nextRight;
    }
    const cipher = String(left).padStart(half, "0") + String(right).padStart(half, "0");
    let dl = left;
    let dr = right;
    for (let r = rounds - 1; r >= 0; r -= 1) {
        const previousRight = dl;
        const f = roundFunction(r, previousRight, key, modulus);
        const previousLeft = (dr - f + modulus) % modulus;
        dl = previousLeft;
        dr = previousRight;
    }
    const plain = String(dl).padStart(half, "0") + String(dr).padStart(half, "0");
    return { cipher, plain, trace };
}

function checkFrames(frames: VisualFrame[], rounds: number): void {
    expect(frames.length).toBe(rounds + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rounds * 5);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("FormatPreservingEncryption", () => {
    it("matches a reference Feistel network and round trips", () => {
        const cases = [
            { digits: "123456", key: 7, rounds: 4 },
            { digits: "000000", key: 0, rounds: 1 },
            { digits: "9876543210", key: 42, rounds: 6 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.rounds);
            const expected = reference(input.digits, input.key, input.rounds);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["ciphertext"]).toBe(expected.cipher);
            expect(meta?.["plaintext"]).toBe(expected.plain);
            expect(String(meta?.["ciphertext"]).length).toBe(input.digits.length);
        }
    });

    it("is a bijection on the full two-digit domain", () => {
        const outputs = new Set<string>();
        for (let value = 0; value < 100; value += 1) {
            const digits = String(value).padStart(2, "0");
            const frames = [...mod.run({ digits, key: 11, rounds: 3 })];
            checkFrames(frames, 3);
            const meta = frames[frames.length - 1]?.meta;
            const cipher = String(meta?.["ciphertext"]);
            expect(cipher).toMatch(/^[0-9]{2}$/);
            expect(meta?.["plaintext"]).toBe(digits);
            outputs.add(cipher);
        }
        expect(outputs.size).toBe(100);
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
