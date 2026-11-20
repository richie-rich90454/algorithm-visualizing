/**
 * reduce-scatter.test.ts - Brute-force reduction and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./reduce-scatter";
import type { VisualFrame } from "@/types";

function bruteForce(data: number[][]): number[] {
    const p = data.length;
    return Array.from({ length: p }, (_, r) => data.reduce((sum, row) => sum + (row[r] ?? 0), 0));
}

function checkFrames(frames: VisualFrame[], expectedSize: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const result = frame.meta["result"] as number[];
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(expectedSize);
    });
}

describe("Reduce-scatter", () => {
    it("matches a direct column sum on the default input", () => {
        const input = mod.defaultInput as { data: number[][] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.data.length);
        expect(frames[frames.length - 1]!.meta["result"]).toEqual(bruteForce(input.data));
    });

    it("matches direct sums for several power-of-two sizes", () => {
        let seed = 11;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483647;
            return seed / 2147483647;
        };
        for (const p of [2, 4, 8]) {
            const data = Array.from({ length: p }, () =>
                Array.from({ length: p }, () => Math.floor(rand() * 100) - 50),
            );
            const frames = [...mod.run({ data })];
            checkFrames(frames, p);
            expect(frames[frames.length - 1]!.meta["result"]).toEqual(bruteForce(data));
        }
    });

    it("never lets the message counter decrease", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (let i = 1; i < frames.length; i += 1) {
            expect(Number(frames[i]!.meta["messages"])).toBeGreaterThanOrEqual(Number(frames[i - 1]!.meta["messages"]));
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
