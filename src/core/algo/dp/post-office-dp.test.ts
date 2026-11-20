import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./post-office-dp";

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
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        frame.entities.forEach((entity) => {
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(typeof entity.metadata["row"]).toBe("number");
        });
    });
}

/** Brute-force choice of office sites among the village positions. */
function bruteOptimal(positions: number[], offices: number): number {
    const values = [...positions].sort((a, b) => a - b);
    const k = Math.max(1, Math.min(values.length, offices));
    let best = Infinity;
    const chosen: number[] = [];
    const visit = (start: number): void => {
        if (chosen.length === k) {
            let total = 0;
            for (const village of values) {
                let nearest = Infinity;
                for (const site of chosen) nearest = Math.min(nearest, Math.abs(village - site));
                total += nearest;
            }
            best = Math.min(best, total);
            return;
        }
        for (let i = start; i < values.length; i += 1) {
            chosen.push(values[i] as number);
            visit(i + 1);
            chosen.pop();
        }
    };
    visit(0);
    return best;
}

const cases: Array<{ positions: number[]; k: number }> = [
    { positions: [1, 2, 4, 7, 10, 14], k: 2 },
    { positions: [0, 3, 8, 12, 20], k: 2 },
    { positions: [1, 1, 2, 5, 9, 15], k: 3 },
    { positions: [-5, -1, 0, 4, 11], k: 2 },
    { positions: [2, 4, 6], k: 5 },
];

describe("Post office problem on a line", () => {
    it("matches brute-force enumeration of office locations", () => {
        for (const input of cases) {
            const fs = frames(input);
            shapes(fs);
            const last = fs[fs.length - 1];
            expect(Number(last?.meta["optimalCost"])).toBe(bruteOptimal(input.positions, input.k));
        }
    });

    it("fills the DP table and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        expect(Number(last?.meta["rows"])).toBe(7);
        expect(Number(last?.meta["cols"])).toBe(3);
        expect(fs.length).toBeGreaterThan(10);
    });
});
