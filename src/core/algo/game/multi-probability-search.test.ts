import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./multi-probability-search";

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
    const children = [brute(leaves, i * 3, level + 1), brute(leaves, i * 3 + 1, level + 1), brute(leaves, i * 3 + 2, level + 1)];
    return level % 2 === 0 ? Math.max(...children) : Math.min(...children);
}

const cases = [
    [3, 5, 2, 6, 1, 4, 7, 2, 8, 1, 9, 3, 5, 4, 2, 8, 6, 3, 2, 7, 1, 4, 9, 5, 3, 8, 6],
    [8, 1, 6, 2, 7, 3, 5, 4, 9, 0, 8, 4, 6, 2, 7, 1, 5, 3, 9, 2, 4, 6, 0, 8, 5, 3, 7],
    [-4, 10, -2, 7, 0, -9, 5, 11, 1, -6, 8, 3, -1, 6, 12, -3, 4, 9, -8, 2, 7, 0, 5, -5, 11, 1, -2],
];

describe("Multi-probability search", () => {
    it("keeps the minimax value and a valid probability distribution at the root", () => {
        for (const leaves of cases) {
            for (const temperature of [0.5, 1, 2]) {
                const fs = frames({ leaves, temperature });
                shapes(fs);
                const last = fs[fs.length - 1];
                expect(Number(last?.meta["value"])).toBe(brute(leaves, 1, 0));
                const probs = last?.meta["rootProbabilities"] as number[];
                expect(probs.length).toBe(3);
                expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4);
                probs.forEach((p) => expect(p).toBeGreaterThan(0));
                const childValues = [brute(leaves, 3, 1), brute(leaves, 4, 1), brute(leaves, 5, 1)];
                const bestValue = Math.max(...childValues);
                const bestIndex = childValues.findIndex((v) => v === bestValue);
                expect(probs[bestIndex]).toBe(Math.max(...probs));
            }
        }
    });

    it("terminates and reports a principal variation", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        expect(String(last?.meta["variation"]).split("->").length).toBe(3);
    });
});
