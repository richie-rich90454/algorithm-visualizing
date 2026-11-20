/**
 * oblivious-prf.test.ts - Brute-force OPRF equality, modular arithmetic
 * properties, frame shape checks, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, {
    GROUP_ORDER,
    PRIME,
    blind,
    chooseBlind,
    directPrf,
    hashExponent,
    modInverse,
    modPow,
    serverEvaluate,
    unblind,
} from "./oblivious-prf";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["matches"]).toBe(true);
    });
}

function gcd(a: number, b: number): number {
    while (b !== 0) {
        [a, b] = [b, a % b];
    }
    return a;
}

describe("Blinded exponentiation OPRF (toy)", () => {
    it("computes modular powers and inverses correctly", () => {
        expect(modPow(2, 10, 1009)).toBe(1024 % 1009);
        for (let value = 1; value < 200; value += 1) {
            if (gcd(value, GROUP_ORDER) === 1) {
                expect((value * modInverse(value, GROUP_ORDER)) % GROUP_ORDER).toBe(1);
            }
        }
        expect(hashExponent(1)).toBe(2);
        expect(hashExponent(1009)).toBe(3);
        for (let i = 0; i < 20; i += 1) {
            expect(gcd(chooseBlind(i), GROUP_ORDER)).toBe(1);
        }
    });

    it("brute-forces OPRF equality across items, keys, and blinds", () => {
        for (let item = 0; item < 50; item += 1) {
            const direct = directPrf(37, item);
            for (let i = 0; i < BLIND_COUNT; i += 1) {
                const r = chooseBlind(i);
                const response = serverEvaluate(blind(item, r), 37);
                expect(unblind(response, r)).toBe(direct);
            }
        }
        for (let key = 1; key <= 30; key += 1) {
            for (const item of [0, 7, 42, 500]) {
                const r = chooseBlind(key);
                expect(unblind(serverEvaluate(blind(item, r), key), r)).toBe(directPrf(key, item));
            }
        }
    });

    it("rejects a wrong unblinding exponent and stays in range", () => {
        const item = 42;
        const key = 37;
        const r = chooseBlind(0);
        const response = serverEvaluate(blind(item, r), key);
        const good = unblind(response, r);
        const wrong = unblind(response, chooseBlind(1));
        expect(wrong).not.toBe(good);
        expect(blind(item, r)).toBeGreaterThan(0);
        expect(blind(item, r)).toBeLessThan(PRIME);
        expect(response).toBeGreaterThan(0);
        expect(response).toBeLessThan(PRIME);
        expect(directPrf(key, item)).toBe(directPrf(key, item));
    });

    it("emits well-formed frames matching a fresh run", () => {
        const input = mod.defaultInput as { item: number; key: number; blindIndex: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        expect(last["result"]).toBe(directPrf(input.key, input.item));
        expect(last["directPrf"]).toBe(directPrf(input.key, input.item));
        expect(last["blind"]).toBe(chooseBlind(input.blindIndex));
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBe(5);
        expect(gen.next().done).toBe(true);
    });
});

const BLIND_COUNT = 12;
