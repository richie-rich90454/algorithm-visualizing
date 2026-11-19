import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./queap";

type Op = ["enqueue", number] | ["dequeue"] | ["min"];

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
        expect(f.entities.length).toBeGreaterThanOrEqual(0);
        expect(Array.isArray(f.edges)).toBe(true);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => expect(Number.isFinite(e.x)).toBe(true));
    });
}

function brute(ops: Op[]): { queue: number[]; minima: number[] } {
    const q: number[] = [];
    const minima: number[] = [];
    for (const op of ops) {
        if (op[0] === "enqueue") q.push(op[1]);
        else if (op[0] === "dequeue") q.shift();
        else minima.push(q.length ? Math.min(...q) : Number.POSITIVE_INFINITY);
    }
    return { queue: q, minima };
}

describe("Queap", () => {
    const cases: Op[][] = [
        [["enqueue", 5], ["enqueue", 2], ["min"], ["enqueue", 3], ["dequeue"], ["min"]],
        [
            ["enqueue", 9], ["enqueue", 1], ["enqueue", 7], ["min"], ["dequeue"], ["min"],
            ["dequeue"], ["dequeue"], ["enqueue", 4], ["min"], ["dequeue"], ["min"],
        ],
        [["min"], ["enqueue", 3], ["dequeue"], ["min"], ["enqueue", 2], ["enqueue", 1], ["min"]],
    ];

    it("matches a brute-force FIFO queue with a scanned minimum", () => {
        for (const ops of cases) {
            const fs = frames({ ops });
            shapes(fs);
            const expected = brute(ops);
            const last = fs[fs.length - 1];
            expect(last?.meta.queue).toEqual(expected.queue);
            expect(last?.meta.minima).toEqual(expected.minima);
        }
    });

    it("never reports a minimum larger than the true minimum and terminates", () => {
        const ops = cases[1]!;
        const fs = frames({ ops });
        shapes(fs);
        const minima = fs[fs.length - 1]?.meta.minima as number[];
        expect(minima.length).toBe(ops.filter((o) => o[0] === "min").length);
        expect(fs[fs.length - 1]?.stepNumber).toBe(fs.length - 1);
    });
});
