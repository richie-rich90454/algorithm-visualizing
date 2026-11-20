import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./vcg-mechanism";

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
        expect(f.codeLineNumber ?? 0).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.layout).toBe("array");
        expect(f.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(f.edges)).toBe(true);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => expect(Number.isFinite(e.x)).toBe(true));
    });
}

// Enumerate the welfare of every outcome with and without each agent.
function externality(values: number[], cost: number): { build: boolean; payments: number[] } {
    const total = values.reduce((a, b) => a + b, 0);
    const build = total >= cost;
    const payments = values.map((v) => {
        const others = total - v;
        const bestWithoutI = Math.max(0, others - cost);
        const othersInChosenOutcome = build ? others - cost : 0;
        return bestWithoutI - othersInChosenOutcome;
    });
    return { build, payments };
}

describe("VCGMechanism", () => {
    const cases = [
        { values: [8, 5, 4, 2], cost: 12 },
        { values: [2, 3, 2], cost: 9 },
        { values: [10, 1, 1], cost: 6 },
        { values: [4, 4, 4, 4], cost: 16 },
    ];

    it("matches the externality computed by brute-force welfare enumeration", () => {
        for (const input of cases) {
            const fs = frames(input);
            shapes(fs);
            const expected = externality(input.values, input.cost);
            const last = fs[fs.length - 1];
            expect(last?.meta.build).toBe(expected.build);
            expect(last?.meta.payments).toEqual(expected.payments);
        }
    });

    it("never charges a negative payment and terminates", () => {
        for (const input of cases) {
            const fs = frames(input);
            shapes(fs);
            const payments = fs[fs.length - 1]?.meta.payments as number[];
            expect(payments.every((p) => p >= 0)).toBe(true);
            expect(fs[fs.length - 1]?.stepNumber).toBe(fs.length - 1);
        }
    });
});
