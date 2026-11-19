/**
 * coalitional-game-core.test.ts - Independent core check, frames, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./coalitional-game-core";
import type { VisualFrame } from "@/types";

/** Reference core check by direct subset sums over all integer divisions. */
function bruteCore(values: Record<string, number>, n: number, total: number): string[] {
    const key = (s: number[]) => [...s].sort((a, b) => a - b).join(",");
    const v = (s: number[]) => values[key(s)] ?? 0;
    const result: string[] = [];
    const walk = (i: number, left: number, row: number[]) => {
        if (i === n - 1) {
            if (left < 0) return;
            const full = [...row, left];
            for (let mask = 1; mask < (1 << n) - 1; mask += 1) {
                const subset: number[] = [];
                for (let k = 0; k < n; k += 1) if (mask & (1 << k)) subset.push(k);
                let sum = 0;
                for (const member of subset) sum += full[member];
                if (sum < v(subset)) return;
            }
            result.push(full.join(","));
            return;
        }
        for (let x = 0; x <= left; x += 1) walk(i + 1, left - x, [...row, x]);
    };
    walk(0, total, []);
    return result.sort();
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Coalitional Game Core", () => {
    it("matches a direct core check on the default game", () => {
        const input = mod.defaultInput as { values: Record<string, number>; players: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["core"]).toEqual(bruteCore(input.values, 3, 6));
        expect(final?.["nonempty"]).toBe(true);
        expect(final?.["core"]).toEqual(["2,2,2"]);
    });

    it("detects an empty core", () => {
        const values: Record<string, number> = {
            "0": 0, "1": 0, "2": 0,
            "0,1": 5, "0,2": 5, "1,2": 5,
            "0,1,2": 6,
        };
        const frames = [...mod.run({ players: 3, values, step: 1 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["nonempty"]).toBe(false);
        expect(final?.["core"]).toEqual(bruteCore(values, 3, 6));
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
