import { describe, expect, it } from "vitest";
import mod from "./jonker-volgenant-algorithm";
import type { VisualFrame } from "@/types";

function bruteForce(costs: number[][]): number {
    const n = costs.length;
    const cols = Array.from({ length: n }, (_, i) => i);
    let best = Infinity;
    const recurse = (at: number): void => {
        if (at === n) {
            let total = 0;
            for (let i = 0; i < n; i += 1) {
                total += costs[i]?.[cols[i] ?? 0] ?? 0;
            }
            best = Math.min(best, total);
            return;
        }
        for (let k = at; k < n; k += 1) {
            [cols[at], cols[k]] = [cols[k] ?? 0, cols[at] ?? 0];
            recurse(at + 1);
            [cols[at], cols[k]] = [cols[k] ?? 0, cols[at] ?? 0];
        }
    };
    recurse(0);
    return best;
}

function checkFrames(frames: VisualFrame[], cells: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("matrix");
        expect(frame.entities.length).toBe(cells);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Jonker-Volgenant Assignment Algorithm", () => {
    it("matches exhaustive search on fixed cases", () => {
        const cases = [
            [[8, 4, 7], [5, 2, 3], [9, 4, 8]],
            [[4, 1, 3], [2, 0, 5], [3, 2, 2]],
            [[0, 9], [9, 0]],
            [[-3, 1], [2, -4]],
        ];
        for (const costs of cases) {
            const frames = [...mod.run({ costs })];
            checkFrames(frames, costs.length * (costs[0]?.length ?? 0));
            expect(frames[frames.length - 1]?.meta["totalCost"]).toBe(bruteForce(costs));
        }
    });

    it("matches exhaustive search on random square matrices", () => {
        for (let trial = 0; trial < 30; trial += 1) {
            const n = 2 + (trial % 3);
            const costs = Array.from({ length: n }, () =>
                Array.from({ length: n }, () => Math.floor(Math.random() * 30) - 10),
            );
            const frames = [...mod.run({ costs })];
            expect(frames[frames.length - 1]?.meta["totalCost"]).toBe(bruteForce(costs));
        }
    });

    it("handles empty input and terminates cleanly", () => {
        expect([...mod.run({ costs: [] })].length).toBe(1);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
