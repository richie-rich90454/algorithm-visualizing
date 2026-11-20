import { describe, expect, it } from "vitest";
import mod from "./assortativity-coefficient";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Newman's degree-assortativity formula, implemented independently. */
function newmanAssortativity(edges: Array<[string, string]>): number {
    const degree = new Map<string, number>();
    const unique = new Set<string>();
    const pairs: Array<[string, string]> = [];
    for (const [a, b] of edges) {
        degree.set(a, (degree.get(a) ?? 0) + 1);
        degree.set(b, (degree.get(b) ?? 0) + 1);
        const k = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (!unique.has(k)) {
            unique.add(k);
            pairs.push(a < b ? [a, b] : [b, a]);
        }
    }
    const m = pairs.length;
    if (m === 0) return 0;
    let jk = 0;
    let jkavg = 0;
    let j2k2avg = 0;
    for (const [a, b] of pairs) {
        const da = degree.get(a) ?? 0;
        const db = degree.get(b) ?? 0;
        jk += da * db;
        jkavg += (da + db) / 2;
        j2k2avg += (da * da + db * db) / 2;
    }
    jk /= m;
    jkavg /= m;
    j2k2avg /= m;
    const denominator = j2k2avg - jkavg * jkavg;
    return Math.abs(denominator) < 1e-12 ? 0 : (jk - jkavg * jkavg) / denominator;
}

describe("Assortativity Coefficient", () => {
    it("matches an independent Newman formula on the default graph", () => {
        const input = mod.defaultInput as { edges: Array<[string, string]> };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        expect(meta["assortativity"] as number).toBeCloseTo(newmanAssortativity(input.edges), 9);
        expect((meta["assortativity"] as number)).toBeGreaterThanOrEqual(-1);
        expect((meta["assortativity"] as number)).toBeLessThanOrEqual(1);
    });

    it("reports minus one for a star and zero for a regular triangle", () => {
        const star: Array<[string, string]> = [["A", "C"], ["B", "C"], ["D", "C"], ["E", "C"]];
        const starFrames = [...mod.run({ edges: star })];
        expect(starFrames[starFrames.length - 1]!.meta["assortativity"] as number).toBeCloseTo(-1, 9);
        expect(newmanAssortativity(star)).toBeCloseTo(-1, 9);

        const triangle: Array<[string, string]> = [["A", "B"], ["B", "C"], ["A", "C"]];
        const triFrames = [...mod.run({ edges: triangle })];
        expect(triFrames[triFrames.length - 1]!.meta["assortativity"] as number).toBeCloseTo(0, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
