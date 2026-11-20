import { describe, expect, it } from "vitest";
import mod from "./auction-algorithm-assignment";
import type { VisualFrame } from "@/types";

/** Exhaustive optimum of the linear assignment problem for small n. */
function bruteForce(costs: number[][]): { cost: number; perm: number[] } {
    const n = costs.length;
    const cols = Array.from({ length: n }, (_, i) => i);
    let best = Infinity;
    let bestPerm: number[] = [];
    const visit = (at: number): void => {
        if (at === n) {
            let sum = 0;
            for (let i = 0; i < n; i += 1) {
                sum += costs[i]?.[cols[i] ?? 0] ?? 0;
            }
            if (sum < best) {
                best = sum;
                bestPerm = [...cols];
            }
            return;
        }
        for (let k = at; k < n; k += 1) {
            [cols[at], cols[k]] = [cols[k] ?? 0, cols[at] ?? 0];
            visit(at + 1);
            [cols[at], cols[k]] = [cols[k] ?? 0, cols[at] ?? 0];
        }
    };
    visit(0);
    return { cost: best, perm: bestPerm };
}

function checkFrames(frames: VisualFrame[], cells: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("matrix");
        expect(frame.entities.length).toBe(cells);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Auction Algorithm for Assignment", () => {
    it("matches brute force on the default input and hand cases", () => {
        const cases = [
            [[4, 1, 3], [2, 0, 5], [3, 2, 2]],
            [[8, 4, 7], [5, 2, 3], [9, 4, 8]],
            [[0, 9], [9, 0]],
            [[3]],
        ];
        for (const costs of cases) {
            const frames = [...mod.run({ costs })];
            checkFrames(frames, costs.length * (costs[0]?.length ?? 0));
            const expected = bruteForce(costs);
            const last = frames[frames.length - 1]?.meta;
            expect(last?.["complete"]).toBe(true);
            expect(last?.["totalCost"]).toBe(expected.cost);
        }
    });

    it("matches brute force on random matrices", () => {
        for (let trial = 0; trial < 30; trial += 1) {
            const n = 2 + (trial % 3);
            const costs = Array.from({ length: n }, () =>
                Array.from({ length: n }, () => Math.floor(Math.random() * 20)),
            );
            const frames = [...mod.run({ costs })];
            const last = frames[frames.length - 1]?.meta;
            expect(last?.["complete"]).toBe(true);
            expect(last?.["totalCost"]).toBe(bruteForce(costs).cost);
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
