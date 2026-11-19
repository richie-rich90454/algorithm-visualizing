import { describe, expect, it } from "vitest";
import mod, { lossyCountingCandidates } from "./lossy-counting";

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

/** Independent reimplementation used as the oracle. */
function reference(stream: string[], epsilon: number): string[] {
    const w = Math.ceil(1 / epsilon);
    const table = new Map<string, { c: number; e: number }>();
    let b = 1;
    for (let i = 0; i < stream.length; i += 1) {
        const item = stream[i] as string;
        const cur = table.get(item);
        if (cur) cur.c += 1;
        else table.set(item, { c: 1, e: b - 1 });
        if ((i + 1) % w === 0) {
            for (const [key, v] of [...table.entries()]) if (v.c + v.e <= b) table.delete(key);
            b += 1;
        }
    }
    return [...table.entries()].filter(([, v]) => v.c > epsilon * stream.length).map(([k]) => k).sort();
}

describe("Lossy Counting", () => {
    const lines = mod.pseudocode?.length ?? 1;

    it("yields sequential, well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((f, i) => {
            expect(f.stepNumber).toBe(i);
            checkFrame(f, lines);
        });
    });

    it("agrees with an independent reference and never drops a truly frequent item", () => {
        const streams = [
            ["a", "b", "a", "c", "a", "b", "a", "d", "a", "b", "a", "e", "a", "b", "a", "c", "a", "b", "a", "d"],
            ["x", "y", "x", "z", "x", "y", "x"],
            ["a", "b", "c", "d", "e"],
            [],
            Array.from({ length: 80 }, (_, i) => `k${i % 6}`),
        ];
        for (const stream of streams) {
            for (const eps of [0.1, 0.25]) {
                const frames = [...mod.run({ stream, epsilon: eps })];
                const last = frames[frames.length - 1];
                const got = [...(last?.meta["candidates"] as string[] ?? [])].sort();
                expect(got).toEqual(reference(stream, eps));
                expect(got).toEqual([...lossyCountingCandidates(stream, eps)].sort());
                const counts = new Map<string, number>();
                for (const s of stream) counts.set(s, (counts.get(s) ?? 0) + 1);
                for (const [item, c] of counts) {
                    // Conservative no-false-negative bound for short streams: the
                    // textbook epsilon*N guarantee assumes many full buckets.
                    if (c > 2 * eps * stream.length + 1) expect(got).toContain(item);
                }
            }
        }
    });
});
