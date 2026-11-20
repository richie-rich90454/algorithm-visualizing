/** telephone-dp.test.ts - Correctness against brute-force matching counts. */
import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./telephone-dp";

/** Enumerate all sets of disjoint pairs among the first n people. */
function brute(n: number, used: boolean[] = new Array(n).fill(false)): number {
    let first = -1;
    for (let i = 0; i < n; i += 1) {
        if (!used[i]) { first = i; break; }
    }
    if (first < 0) return 1;
    let total = brute(n, used.map((v, i) => (i === first ? true : v)));
    for (let j = first + 1; j < n; j += 1) {
        if (used[j]) continue;
        const next = used.map((v, i) => (i === first || i === j ? true : v));
        total += brute(n, next);
    }
    return total;
}

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThanOrEqual(2);
    fs.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.layout).toBe("grid");
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.meta).toBeDefined();
        expect(f.entities.every((e) => Number.isFinite(e.x))).toBe(true);
    });
}

describe("Telephone Numbers DP", () => {
    it("matches brute-force pairings for many sizes", () => {
        for (let n = 0; n <= 9; n += 1) {
            const fs = frames({ people: n });
            shapes(fs);
            expect(fs[fs.length - 1]?.meta["ways"]).toBe(brute(n));
        }
    });

    it("produces the known telephone-number sequence", () => {
        const fs = frames({ people: 8 });
        const table = fs[fs.length - 1]?.entities.map((e) => Number(e.value)) ?? [];
        expect(table).toEqual([1, 1, 2, 4, 10, 26, 76, 232, 764]);
    });

    it("terminates cleanly", () => {
        const g = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of g) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(g.next().done).toBe(true);
    });
});
