/** zopfli-compression.test.ts - Optimal-cost, round-trip, frame and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./zopfli-compression";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function bitLength(value: number): number {
    return value <= 0 ? 0 : Math.floor(Math.log2(value)) + 1;
}

/** Independent exhaustive minimum-cost search over parses for short inputs. */
function bruteCost(text: string): number {
    const bytes = [...text].map((c) => c.charCodeAt(0));
    const n = bytes.length;
    const memo = new Map<number, number>();
    const solve = (i: number): number => {
        if (i === n) return 0;
        const cached = memo.get(i);
        if (cached !== undefined) return cached;
        let best = 9 + solve(i + 1);
        for (let length = 3; length <= Math.min(32, n - i); length += 1) {
            let position = -1;
            for (let j = i - 1; j >= 0; j -= 1) {
                let ok = true;
                for (let k = 0; k < length; k += 1) {
                    if (bytes[j + k] !== bytes[i + k]) {
                        ok = false;
                        break;
                    }
                }
                if (ok) {
                    position = j;
                    break;
                }
            }
            if (position < 0) break;
            best = Math.min(best, 12 + bitLength(length) + bitLength(i - position) + solve(i + length));
        }
        memo.set(i, best);
        return best;
    };
    return solve(0);
}

describe("Zopfli-Style Optimal Parse", () => {
    it("matches an exhaustive minimum-cost search and round-trips", () => {
        const texts = ["ABABABAB", "TOBEORNOTTOBEORTOBEORNOT", "AAAAAAAAAAAAAAAA", "abcabcxyzabcxyz"];
        for (const text of texts) {
            const frames = [...mod.run({ text })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["decoded"]).toBe(text);
            expect(meta?.["totalBits"]).toBe(bruteCost(text));
            expect(meta?.["totalBits"] as number).toBeLessThanOrEqual(meta?.["greedyBits"] as number);
        }
    });

    it("never emits an impossible match and keeps cumulative costs sorted", () => {
        const frames = [...mod.run({ text: "TOBEORNOTTOBEORTOBEORNOT" })];
        const finalMeta = frames[frames.length - 1]?.meta;
        const tokens = finalMeta?.["tokens"] as Array<{ type: string; length?: number; distance?: number }>;
        let position = 0;
        for (const token of tokens) {
            if (token.type === "match") {
                expect(token.length as number).toBeGreaterThanOrEqual(3);
                expect(token.distance as number).toBeGreaterThanOrEqual(1);
                expect(token.distance as number).toBeLessThanOrEqual(position);
                position += token.length as number;
            } else {
                position += 1;
            }
        }
        expect(position).toBe((finalMeta?.["inputLength"] as number));
        const cumulative = finalMeta?.["cumulative"] as number[];
        for (let i = 1; i < cumulative.length; i += 1) {
            expect(cumulative[i] as number).toBeGreaterThan(cumulative[i - 1] as number);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
