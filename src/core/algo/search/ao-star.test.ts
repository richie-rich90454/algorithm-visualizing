/** ao-star.test.ts - AND-OR optimality against brute force, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./ao-star";
import type { VisualFrame } from "@/types";

interface Op {
    cost: number;
    children: string[];
}
interface NodeDef {
    h: number;
    goal?: boolean;
    ops?: Op[];
}

const alternative: Record<string, NodeDef> = {
    R: { h: 0, ops: [{ cost: 1, children: ["P", "Q"] }, { cost: 4, children: ["T"] }] },
    P: { h: 1, ops: [{ cost: 1, children: ["Z"] }] },
    Q: { h: 1, ops: [{ cost: 1, children: ["Z"] }] },
    T: { h: 4, ops: [{ cost: 4, children: ["Z"] }] },
    Z: { h: 0, goal: true, ops: [] },
};

/** Exhaustive minimum cost over the fully known AND-OR graph. */
function optimal(id: string, defs: Record<string, NodeDef>, path: Set<string>): number {
    const def = defs[id];
    if (!def) {
        return Number.POSITIVE_INFINITY;
    }
    if (def.goal) {
        return 0;
    }
    let best = Number.POSITIVE_INFINITY;
    for (const op of def.ops ?? []) {
        if (op.children.some((c) => path.has(c))) {
            continue;
        }
        const next = new Set(path);
        next.add(id);
        let total = op.cost;
        for (const child of op.children) {
            total += optimal(child, defs, next);
        }
        if (total < best) {
            best = total;
        }
    }
    return best;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("AoStar", () => {
    it("finds the optimal plan on the default problem reduction graph", () => {
        const input = mod.defaultInput as { root: string; nodes: Record<string, NodeDef> };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1] as VisualFrame;
        expect(last.meta["done"]).toBe(true);
        expect(Number(last.meta["bestCost"])).toBe(optimal(input.root, input.nodes, new Set()));
        expect(Number(last.meta["bestCost"])).toBe(4);
        const plan = last.meta["plan"] as string[];
        expect(plan.length).toBeGreaterThan(0);
        expect(plan.join(" ")).toContain("S->E");
    });

    it("matches brute force on a second AND-OR graph", () => {
        const frames = [...mod.run({ root: "R", nodes: alternative })];
        checkFrames(frames);
        const last = frames[frames.length - 1] as VisualFrame;
        expect(Number(last.meta["bestCost"])).toBe(optimal("R", alternative, new Set()));
        expect(Number(last.meta["bestCost"])).toBe(3);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(generator.next().done).toBe(true);
        expect(frames.length).toBeGreaterThan(0);
    });
});
