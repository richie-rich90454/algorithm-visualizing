/**
 * paint-house-dp.test.ts - Brute force, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./paint-house-dp";
import type { VisualFrame } from "@/types";

/** Enumerate all colorings and return the cheapest valid total. */
function brute(costs: number[][]): number {
    const n = costs.length;
    if (n === 0) return 0;
    let best = Infinity;
    const total = 3 ** n;
    for (let code = 0; code < total; code += 1) {
        let x = code;
        const colors: number[] = [];
        for (let i = 0; i < n; i += 1) {
            colors.push(x % 3);
            x = Math.floor(x / 3);
        }
        let valid = true;
        for (let i = 1; i < n; i += 1) {
            if (colors[i] === colors[i - 1]) {
                valid = false;
                break;
            }
        }
        if (!valid) continue;
        let cost = 0;
        for (let i = 0; i < n; i += 1) cost += costs[i]?.[colors[i]!] ?? 0;
        best = Math.min(best, cost);
    }
    return best;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        if (frame.meta["rows"] !== 0) {
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Paint House DP", () => {
    it("matches exhaustive enumeration on random small instances", () => {
        let seed = 12345;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % 20;
        };
        for (let trial = 0; trial < 30; trial += 1) {
            const n = trial % 7;
            const costs: number[][] = [];
            for (let i = 0; i < n; i += 1) costs.push([rand(), rand(), rand()]);
            const frames = [...mod.run({ costs })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["answer"]).toBe(brute(costs));
        }
    });

    it("reports the documented default answer of 10", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["answer"]).toBe(10);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
