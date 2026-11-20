import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./aspiration-windows";

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
        frame.entities.forEach((entity) => expect(Number.isFinite(entity.y)).toBe(true));
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
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27],
    [-5, 9, -3, 12, 0, -8, 4, 7, -1, 6, 2, -4, 11, -2, 3, 8, -6, 1, 5, -9, 10, 0, -7, 13, -1, 4, 2],
];

describe("Aspiration windows search", () => {
    it("returns the exact minimax value for guesses below, inside and above the answer", () => {
        for (const leaves of cases) {
            const truth = brute(leaves, 1, 0);
            for (const guess of [truth - 4, truth - 1, truth, truth + 1, truth + 5]) {
                const fs = frames({ leaves, guess });
                shapes(fs);
                const last = fs[fs.length - 1];
                expect(Number(last?.meta["value"])).toBe(truth);
                expect(Number(last?.meta["passes"])).toBeGreaterThanOrEqual(1);
            }
        }
    });

    it("terminates on the default input and reports a verdict", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        expect(["exact", "fail low", "fail high"]).toContain(String(last?.meta["verdict"]));
    });
});
