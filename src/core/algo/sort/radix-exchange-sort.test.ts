/**
 * radix-exchange-sort.test.ts - Correctness and frame-shape checks.
 */

import { describe, expect, it } from "vitest";
import radixExchange from "./radix-exchange-sort";

describe("RadixExchangeSort", () => {
    it("sorts random non-negative integers like the reference sort", () => {
        let seed = 2468;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 50; t += 1) {
            const len = 1 + (rand() % 25);
            const arr = Array.from({ length: len }, () => rand() % 1024);
            const expected = [...arr].sort((a, b) => a - b);
            const frames = [...radixExchange.run(arr)];
            expect(frames.at(-1)?.entities.map((e) => e.value), `failed on ${arr.join(",")}`).toEqual(
                expected,
            );
        }
    });

    it("handles all-equal, zero and already sorted arrays", () => {
        for (const arr of [[3, 3, 3, 3], [0, 0, 1], [1, 2, 3, 4], [7, 0, 0, 3]]) {
            const expected = [...arr].sort((a, b) => a - b);
            const frames = [...radixExchange.run(arr)];
            expect(frames.at(-1)?.entities.map((e) => e.value)).toEqual(expected);
        }
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...radixExchange.run([5, 1, 7, 3, 0, 6, 2, 4])];
        expect(frames.length).toBeGreaterThan(3);
        for (let i = 0; i < frames.length; i += 1) {
            const frame = frames[i];
            expect(frame.stepNumber).toBe(i);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.layout).toBe("array");
            expect(typeof frame.meta).toBe("object");
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThan(radixExchange.pseudocode?.length ?? 0);
        }
    });
});
