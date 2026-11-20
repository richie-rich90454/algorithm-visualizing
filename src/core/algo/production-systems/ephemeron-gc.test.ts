/** ephemeron-gc.test.ts - Fixed-point reference and closure property checks. */

import { describe, expect, it } from "vitest";
import mod from "./ephemeron-gc";
import type { VisualFrame } from "@/types";

interface Ephemeron {
    key: string;
    value: string;
}
interface Edge {
    from: string;
    to: string;
}

function reference(nodes: string[], roots: string[], ephemerons: Ephemeron[], edges: Edge[]) {
    const marked = new Set(roots.filter((r) => nodes.includes(r)));
    for (;;) {
        const before = marked.size;
        for (const edge of edges) if (marked.has(edge.from) && nodes.includes(edge.to)) marked.add(edge.to);
        for (const eph of ephemerons) if (marked.has(eph.key) && nodes.includes(eph.value)) marked.add(eph.value);
        if (marked.size === before) break;
    }
    return { marked: [...marked].sort(), garbage: nodes.filter((n) => !marked.has(n)).sort() };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.length).toBeGreaterThan(0);
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

describe("ephemeron-gc", () => {
    it("matches a brute-force fixed point", () => {
        const input = mod.defaultInput as { roots: string[]; ephemerons: Ephemeron[]; edges: Edge[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const nodes = [...new Set([
            ...input.roots,
            ...input.edges.flatMap((e) => [e.from, e.to]),
            ...input.ephemerons.flatMap((e) => [e.key, e.value]),
        ])];
        const expected = reference(nodes, input.roots, input.ephemerons, input.edges);
        const final = frames[frames.length - 1]?.meta;
        expect([...(final?.["marked"] as string[])].sort()).toEqual(expected.marked);
        expect([...(final?.["garbage"] as string[])].sort()).toEqual(expected.garbage);
    });

    it("saturates the fixed point: no rule reaches a garbage node", () => {
        const input = {
            roots: ["R"],
            ephemerons: [
                { key: "R", value: "A" },
                { key: "A", value: "B" },
                { key: "X", value: "Y" },
            ],
            edges: [{ from: "B", to: "C" }],
        };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        const marked = new Set(final?.["marked"] as string[]);
        expect([...marked].sort()).toEqual(["A", "B", "C", "R"]);
        for (const eph of input.ephemerons) {
            if (marked.has(eph.key)) expect(marked.has(eph.value)).toBe(true);
        }
        for (const edge of input.edges) {
            if (marked.has(edge.from)) expect(marked.has(edge.to)).toBe(true);
        }
    });

    it("marks nothing when there are no roots", () => {
        const frames = [...mod.run({ roots: [], ephemerons: [{ key: "A", value: "B" }], edges: [] })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["marked"]).toEqual([]);
        expect([...(final?.["garbage"] as string[])].sort()).toEqual(["A", "B"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
