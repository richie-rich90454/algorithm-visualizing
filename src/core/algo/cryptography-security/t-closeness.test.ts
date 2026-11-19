/** t-closeness.test.ts - Brute-force earth mover distance, symmetry, monotonicity, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./t-closeness";
import type { VisualFrame } from "@/types";

interface RecordInput { qi: string; sensitive: number; }

function emd(p: number[], q: number[]): number {
    let cp = 0;
    let cq = 0;
    let total = 0;
    for (let i = 0; i < p.length; i += 1) {
        cp += p[i];
        cq += q[i];
        total += Math.abs(cp - cq);
    }
    return total;
}

function distributions(records: RecordInput[]) {
    const domain = Array.from(new Set(records.map((r) => r.sensitive))).sort((a, b) => a - b);
    const index = new Map(domain.map((v, i) => [v, i]));
    const global = domain.map(() => 0);
    for (const r of records) global[index.get(r.sensitive) as number] += 1 / records.length;
    const byQi = new Map<string, number[]>();
    for (const r of records) {
        if (!byQi.has(r.qi)) byQi.set(r.qi, []);
        byQi.get(r.qi)?.push(r.sensitive);
    }
    return { domain, global, byQi };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("t-Closeness Check", () => {
    it("matches a brute-force earth mover distance on the default input", () => {
        const input = mod.defaultInput as { records: RecordInput[]; t: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const { global, byQi } = distributions(input.records);
        const groups = final?.["groups"] as string[];
        const distances = final?.["distances"] as number[];
        groups.forEach((qi, i) => {
            const values = byQi.get(qi) ?? [];
            const local = global.map(() => 0);
            for (const v of values) {
                const idx = Array.from(new Set(input.records.map((r) => r.sensitive))).sort((a, b) => a - b).indexOf(v);
                local[idx] += 1 / values.length;
            }
            expect(distances[i]).toBeCloseTo(emd(global, local), 10);
        });
    });

    it("earth mover distance is zero for identical distributions and symmetric", () => {
        const p = [0.2, 0.3, 0.5];
        const q = [0.5, 0.3, 0.2];
        expect(emd(p, p)).toBe(0);
        expect(emd(p, q)).toBeCloseTo(emd(q, p), 10);
    });

    it("verdicts are monotone in t", () => {
        const records: RecordInput[] = [
            { qi: "g1", sensitive: 1 }, { qi: "g1", sensitive: 2 }, { qi: "g1", sensitive: 3 },
            { qi: "g2", sensitive: 3 }, { qi: "g2", sensitive: 3 }, { qi: "g2", sensitive: 3 },
        ];
        const verdicts: boolean[] = [];
        for (const t of [0, 0.1, 0.3, 0.7, 1]) {
            verdicts.push(Boolean([...mod.run({ records, t })].at(-1)?.meta["allClose"]));
        }
        for (let i = 1; i < verdicts.length; i += 1) {
            if (verdicts[i - 1]) expect(verdicts[i]).toBe(true);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
