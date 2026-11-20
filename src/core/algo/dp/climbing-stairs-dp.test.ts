/** climbing-stairs-dp.test.ts - Correctness against brute-force enumeration. */
import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./climbing-stairs-dp";

/** Count climbs by exhaustive recursion (one or two steps at a time). */
function brute(remaining: number): number {
    if (remaining === 0) return 1;
    if (remaining < 0) return 0;
    return brute(remaining - 1) + brute(remaining - 2);
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
        expect(f.entities.every((e) => e.type === "cell")).toBe(true);
        expect(f.meta).toBeDefined();
        expect(f.entities.every((e) => Number.isFinite(e.x))).toBe(true);
    });
}

describe("Climbing Stairs DP", () => {
    it("matches brute-force counts for many stair counts", () => {
        for (let n = 0; n <= 20; n += 1) {
            const fs = frames({ stairs: n });
            shapes(fs);
            const ways = fs[fs.length - 1]?.meta["ways"];
            expect(ways).toBe(brute(n));
        }
    });

    it("reports the full table and Fibonacci growth", () => {
        const fs = frames({ stairs: 10 });
        const final = fs[fs.length - 1];
        const table = final?.entities.map((e) => Number(e.value)) ?? [];
        expect(table).toEqual([1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]);
        expect(final?.meta["ways"]).toBe(89);
    });

    it("terminates cleanly", () => {
        const g = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of g) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(g.next().done).toBe(true);
    });
});
