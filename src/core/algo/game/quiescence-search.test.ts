import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./quiescence-search";

interface QNode { type: "max" | "min" | "horizon"; v?: number; children?: QNode[]; captures?: QNode[] }

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
        expect(f.layout).toBe("tree");
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => expect(Number.isFinite(e.x)).toBe(true));
        f.edges.forEach((ed) => {
            expect(f.entities.some((e) => e.id === ed.sourceId)).toBe(true);
            expect(f.entities.some((e) => e.id === ed.targetId)).toBe(true);
        });
    });
}

// Independent full minimax over the extended capture tree.
function brute(node: QNode, isMax: boolean): number {
    if (node.type === "horizon") {
        let best = node.v ?? 0;
        for (const cap of node.captures ?? []) {
            const val = brute(cap, !isMax);
            best = isMax ? Math.max(best, val) : Math.min(best, val);
        }
        return best;
    }
    const children = node.children ?? [];
    let best = isMax ? -Infinity : Infinity;
    for (const child of children) {
        const val = brute(child, !isMax);
        best = isMax ? Math.max(best, val) : Math.min(best, val);
    }
    return best;
}

describe("QuiescenceSearch", () => {
    const horizon = (v: number, captures: QNode[] = []): QNode => ({ type: "horizon", v, captures });
    const cases: QNode[] = [
        { type: "max", children: [
            { type: "min", children: [horizon(2, [horizon(5, [horizon(4)])]), horizon(6)] },
            { type: "min", children: [horizon(1, [horizon(7)]), horizon(8)] },
        ] },
        { type: "min", children: [
            { type: "max", children: [horizon(9, [horizon(3)]), horizon(2)] },
            { type: "max", children: [horizon(4), horizon(11, [horizon(1, [horizon(6)])])] },
        ] },
        { type: "max", children: [horizon(5), horizon(-2, [horizon(7)])] },
    ];
    it("matches a full minimax of the extended capture tree", () => {
        for (const root of cases) {
            const fs = frames({ root });
            shapes(fs);
            const last = fs[fs.length - 1];
            expect(last?.meta.value).toBe(brute(root, true));
        }
    });
    it("terminates with a settled quiet value", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        expect(Number(last?.meta.terminals)).toBeGreaterThan(0);
        expect(last?.meta.optimal).toBe(last?.meta.value);
    });
});
