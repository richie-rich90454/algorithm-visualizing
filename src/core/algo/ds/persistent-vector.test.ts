import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./persistent-vector";

type Op = ["get", number] | ["set", number, number] | ["push", number];

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
        expect(Array.isArray(f.entities)).toBe(true);
        expect(Array.isArray(f.edges)).toBe(true);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => expect(Number.isFinite(e.x)).toBe(true));
    });
}

function brute(values: number[], ops: Op[]): { array: number[]; gets: number[] } {
    const arr = values.slice();
    const gets: number[] = [];
    for (const op of ops) {
        if (op[0] === "get") gets.push(arr[op[1]]);
        else if (op[0] === "set") arr[op[1]] = op[2];
        else arr.push(op[1]);
    }
    return { array: arr, gets };
}

describe("PersistentVector", () => {
    const cases: Array<{ values: number[]; ops: Op[] }> = [
        { values: [1, 2, 3, 4, 5, 6, 7], ops: [["get", 2], ["set", 2, 30], ["push", 8], ["get", 2]] },
        {
            values: Array.from({ length: 20 }, (_, i) => i),
            ops: [["get", 0], ["get", 19], ["set", 19, 999], ["push", 20], ["push", 21], ["get", 19]],
        },
        {
            values: [5, 4, 3, 2, 1],
            ops: [["set", 0, 50], ["set", 4, 10], ["get", 0], ["get", 4], ["push", 7]],
        },
    ];

    it("matches a plain mutable array under the same operations", () => {
        for (const input of cases) {
            const fs = frames(input);
            shapes(fs);
            const got = brute(input.values, input.ops);
            const last = fs[fs.length - 1];
            const final = last?.meta.gets as number[];
            for (let i = 0; i < got.gets.length; i += 1) {
                expect(final[i]).toBe(got.gets[i]);
            }
            expect(Number(last?.meta.count)).toBe(got.array.length);
            const bars = fs[fs.length - 1]?.entities ?? [];
            expect(bars.map((e) => Number(e.value))).toEqual(got.array);
            expect(Array.isArray(final)).toBe(true);
        }
    });

    it("keeps old versions readable and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const getFrames = fs.filter((f) => f.description.startsWith("get("));
        expect(getFrames.length).toBeGreaterThanOrEqual(2);
        const first = getFrames[0]?.meta.gets as number[];
        const last = fs[fs.length - 1]?.meta.gets as number[];
        expect(first[0]).toBe(3);
        expect(last[last.length - 1]).toBe(30);
        expect(fs[fs.length - 1]?.stepNumber).toBe(fs.length - 1);
    });
});
