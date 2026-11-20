/**
 * transshipment-problem.test.ts - Brute force, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./transshipment-problem";
import type { VisualFrame } from "@/types";

type Arc = [string, string, number, number];

/** Enumerate every integral arc flow and keep the cheapest feasible plan. */
function brute(nodes: string[], arcs: Arc[], supply: Record<string, number>): number | null {
    const balance = new Map(nodes.map((id) => [id, 0]));
    let best = Infinity;
    const ranges = arcs.map(([, , cap]) => cap + 1);
    const total = ranges.reduce((a, b) => a * b, 1);
    for (let code = 0; code < total; code += 1) {
        let x = code;
        const flows: number[] = [];
        for (const range of ranges) {
            flows.push(x % range);
            x = Math.floor(x / range);
        }
        for (const id of nodes) balance.set(id, 0);
        let cost = 0;
        arcs.forEach(([u, v, , arcCost], i) => {
            const f = flows[i] ?? 0;
            balance.set(u, (balance.get(u) ?? 0) + f);
            balance.set(v, (balance.get(v) ?? 0) - f);
            cost += f * arcCost;
        });
        let ok = true;
        for (const id of nodes) {
            if ((balance.get(id) ?? 0) !== (supply[id] ?? 0)) {
                ok = false;
                break;
            }
        }
        if (ok) best = Math.min(best, cost);
    }
    return Number.isFinite(best) ? best : null;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Transshipment Problem", () => {
    it("matches brute-force flow enumeration on small networks", () => {
        const nodes = ["A", "B", "C"];
        const cases: Array<{ arcs: Arc[]; supply: Record<string, number> }> = [
            { arcs: [["A", "B", 3, 2], ["B", "C", 3, 1]], supply: { A: 2, C: -2 } },
            { arcs: [["A", "B", 2, 1], ["B", "C", 2, 4], ["A", "C", 2, 3]], supply: { A: 3, C: -3 } },
            { arcs: [["A", "B", 2, 1], ["B", "A", 2, 1], ["B", "C", 2, 2]], supply: { A: 1, C: -1 } },
            { arcs: [["A", "B", 2, 5], ["B", "C", 2, 5]], supply: { A: 1, C: -1, B: 2 } },
            { arcs: [["A", "B", 2, 1]], supply: { A: 1, C: -1 } },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ nodes, arcs: testCase.arcs, supply: testCase.supply })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["answer"]).toBe(brute(nodes, testCase.arcs, testCase.supply));
        }
    });

    it("reports the documented default answer of 16", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["answer"]).toBe(16);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
