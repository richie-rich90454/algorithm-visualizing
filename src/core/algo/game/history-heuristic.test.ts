import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./history-heuristic";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThan(2);
    fs.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBeGreaterThan(0);
    });
}

function brute(leaves: number[], i: number, level: number): number {
    if (i >= 27) return leaves[i - 27] ?? 0;
    const a = brute(leaves, i * 3, level + 1);
    const b = brute(leaves, i * 3 + 1, level + 1);
    const c = brute(leaves, i * 3 + 2, level + 1);
    return level % 2 === 0 ? Math.max(a, b, c) : Math.min(a, b, c);
}

const cases = [
    [3, 5, 2, 6, 1, 4, 7, 2, 8, 1, 9, 3, 5, 4, 2, 8, 6, 3, 2, 7, 1, 4, 9, 5, 3, 8, 6],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    [-2, 7, -4, 11, 0, 6, -9, 3, 8, -1, 5, 2, 10, -6, 4, 1, -3, 9, -8, 6, 0, 12, -5, 7, 3, -2, 10],
];

describe("History heuristic move ordering", () => {
    it("preserves the brute-force minimax value across inputs", () => {
        for (const leaves of cases) {
            const fs = frames({ leaves });
            shapes(fs);
            const last = fs[fs.length - 1];
            expect(Number(last?.meta["value"])).toBe(brute(leaves, 1, 0));
        }
    });

    it("records real cutoff counts and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        const history = last?.meta["history"] as Record<string, number>;
        expect(Object.keys(history).length).toBeGreaterThan(0);
        expect(Object.values(history).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
        expect(Number(last?.meta["cutoffs"])).toBeGreaterThan(0);
        expect(Number(last?.meta["passes"])).toBe(2);
    });
});
