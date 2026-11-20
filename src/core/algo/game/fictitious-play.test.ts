import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./fictitious-play";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThan(2);
    fs.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.layout).toBe("grid");
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => expect(Number.isFinite(e.x)).toBe(true));
    });
}

describe("FictitiousPlay", () => {
    it("best-responds to the empirical distribution recorded in each frame", () => {
        const fs = frames({ payoffsA: [[4, 1], [3, 0]], payoffsB: [[3, 1], [2, 0]], rounds: 20 });
        shapes(fs);
        for (const f of fs) {
            if (f.meta.brA === undefined) continue;
            const pA = f.meta.pA as number[];
            const pB = f.meta.pB as number[];
            const scoreA = [4 * (pB[0] ?? 0) + 1 * (pB[1] ?? 0), 3 * (pB[0] ?? 0) + 0 * (pB[1] ?? 0)];
            const scoreB = [3 * (pA[0] ?? 0) + 2 * (pA[1] ?? 0), 1 * (pA[0] ?? 0) + 0 * (pA[1] ?? 0)];
            expect(f.meta.brA).toBe(scoreA[0]! >= scoreA[1]! ? 0 : 1);
            expect(f.meta.brB).toBe(scoreB[0]! >= scoreB[1]! ? 0 : 1);
        }
    });
    it("converges to the strictly dominant actions and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        const freqA = last?.meta.freqA as number[];
        const freqB = last?.meta.freqB as number[];
        expect(freqA[0]).toBeGreaterThan(0.9);
        expect(freqB[0]).toBeGreaterThan(0.9);
        expect(freqA[0]! + freqA[1]!).toBeCloseTo(1, 9);
    });
});
