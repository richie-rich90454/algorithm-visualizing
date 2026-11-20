import { describe, expect, it } from "vitest";
import mod, { spaceSavingFinal } from "./space-saving-algorithm";

function checkFrame(frame: { stepNumber: number; entities: unknown[]; edges: unknown[]; description: string; codeLineNumber?: number; layout: string; meta: object }, lines: number): void {
    expect(Number.isInteger(frame.stepNumber)).toBe(true);
    expect(frame.entities.length).toBeGreaterThan(0);
    expect(Array.isArray(frame.edges)).toBe(true);
    expect(frame.description.length).toBeGreaterThanOrEqual(10);
    expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
    expect(frame.codeLineNumber as number).toBeLessThan(lines);
    expect(frame.layout).toBe("grid");
    expect(frame.meta).toBeTypeOf("object");
}

function reference(stream: string[], k: number): Map<string, number> {
    const t = new Map<string, number>();
    for (const x of stream) {
        if (t.has(x)) t.set(x, (t.get(x) as number) + 1);
        else if (t.size < k) t.set(x, 1);
        else {
            let minKey = "";
            let min = Infinity;
            for (const [key, v] of t) if (v < min) { min = v; minKey = key; }
            t.delete(minKey);
            t.set(x, min + 1);
        }
    }
    return t;
}

function asMap(pairs: string[]): Map<string, number> {
    const out = new Map<string, number>();
    for (const p of pairs) {
        const [key, val] = p.split("=");
        out.set(key as string, Number(val));
    }
    return out;
}

describe("Space Saving Algorithm", () => {
    const lines = mod.pseudocode?.length ?? 1;

    it("yields sequential, well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((f, i) => {
            expect(f.stepNumber).toBe(i);
            checkFrame(f, lines);
        });
    });

    it("matches an independent reference and obeys the estimation bounds", () => {
        const inputs = [
            mod.defaultInput,
            { stream: ["a", "b", "c", "a", "b", "a"], k: 2 },
            { stream: [], k: 1 },
            { stream: ["a", "a", "a", "a"], k: 3 },
            { stream: Array.from({ length: 60 }, (_, i) => `k${i % 5}`), k: 4 },
        ];
        for (const input of inputs) {
            const frames = [...mod.run(input)];
            const last = frames[frames.length - 1];
            const stream = (input as { stream: string[] }).stream ?? [];
            const k = (input as { k: number }).k ?? 3;
            const got = asMap(last?.meta["estimates"] as string[] ?? []);
            const want = reference(stream, k);
            expect([...got.entries()].sort()).toEqual([...want.entries()].sort());
            expect([...spaceSavingFinal(stream, k).entries()].sort()).toEqual([...want.entries()].sort());
            const counts = new Map<string, number>();
            for (const s of stream) counts.set(s, (counts.get(s) ?? 0) + 1);
            for (const [item, estimate] of got) {
                const truth = counts.get(item) ?? 0;
                expect(estimate).toBeGreaterThanOrEqual(truth);
                expect(estimate - truth).toBeLessThanOrEqual(Math.ceil(stream.length / k) + 1);
            }
        }
    });
});
