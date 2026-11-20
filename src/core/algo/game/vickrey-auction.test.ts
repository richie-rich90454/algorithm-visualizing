import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./vickrey-auction";

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
        expect(f.layout).toBe("array");
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => expect(Number.isFinite(e.x)).toBe(true));
    });
}

function outcome(bids: number[]): { winner: number; payment: number } {
    const order = bids.map((b, i) => ({ b, i })).sort((x, y) => y.b - x.b || x.i - y.i);
    return { winner: order[0]?.i ?? -1, payment: order[1]?.b ?? 0 };
}

describe("VickreyAuction", () => {
    const cases = [
        { valuations: [10, 7, 5], bids: [9, 8, 4] },
        { valuations: [4, 9, 6], bids: [3, 11, 7] },
        { valuations: [5, 5, 5], bids: [3, 4, 2] },
    ];
    it("awards the top bid and charges the second price", () => {
        for (const input of cases) {
            const fs = frames(input);
            shapes(fs);
            const expected = outcome(input.bids);
            const last = fs[fs.length - 1];
            expect(last?.meta.winner).toBe(expected.winner);
            expect(last?.meta.payment).toBe(expected.payment);
            expect(Number(last?.meta.utility)).toBe(input.valuations[expected.winner]! - expected.payment);
        }
    });
    it("verifies by exhaustive deviation that truthful bidding is never worse", () => {
        const valuation = 10;
        const others = [8, 4];
        let best = -Infinity;
        for (let bid = 0; bid <= 20; bid += 1) {
            const res = outcome([bid, ...others]);
            const utility = res.winner === 0 ? valuation - res.payment : 0;
            best = Math.max(best, utility);
        }
        const truthful = outcome([valuation, ...others]);
        const truthfulUtility = truthful.winner === 0 ? valuation - truthful.payment : 0;
        expect(truthfulUtility).toBe(best);

        const fs = frames(mod.defaultInput);
        shapes(fs);
        for (const f of fs) {
            if (f.meta.currentUtility === undefined) continue;
            expect(Number(f.meta.currentUtility)).toBeLessThanOrEqual(Number(f.meta.truthfulUtility));
        }
    });
});
