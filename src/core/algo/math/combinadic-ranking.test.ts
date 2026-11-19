import { describe, expect, it } from "vitest";
import mod from "./combinadic-ranking";
import type { VisualFrame } from "@/types";

function combinations(n: number, k: number): number[][] {
    const result: number[][] = [];
    const current: number[] = [];
    const walk = (start: number): void => {
        if (current.length === k) {
            result.push(current.slice());
            return;
        }
        for (let value = start; value < n; value += 1) {
            current.push(value);
            walk(value + 1);
            current.pop();
        }
    };
    walk(0);
    return result;
}

function colexCompare(a: number[], b: number[]): number {
    for (let i = a.length - 1; i >= 0; i -= 1) {
        if (a[i] !== b[i]) {
            return (a[i] ?? 0) - (b[i] ?? 0);
        }
    }
    return 0;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Combinadic Ranking", () => {
    it("matches colexicographic enumeration and round-trips every subset", () => {
        for (const [n, k] of [
            [7, 3],
            [6, 2],
            [8, 4],
        ]) {
            const subsets = combinations(n, k).sort(colexCompare);
            subsets.forEach((subset, index) => {
                const frames = [...mod.run({ n, k, subset })];
                checkFrames(frames);
                const last = frames[frames.length - 1];
                expect(Number(last?.meta["rank"])).toBe(index);
                expect(last?.meta["roundTrips"]).toBe(true);
                expect(String(last?.meta["recovered"])).toBe(String(subset));
            });
        }
    });

    it("ranks the default subset [1,3,5] as 14", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(Number(frames[frames.length - 1]?.meta["rank"])).toBe(14);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
