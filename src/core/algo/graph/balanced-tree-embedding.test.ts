/**
 * balanced-tree-embedding.test.ts - Overlap, centering, depth, and sibling
 * order properties checked by brute force, frame shape, determinism, and
 * termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./balanced-tree-embedding";
import type { VisualFrame } from "@/types";

type EdgePair = [string, string];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

function parsePositions(value: string): Map<string, { x: number; depth: number }> {
    const out = new Map<string, { x: number; depth: number }>();
    for (const entry of value.split("|")) {
        if (!entry) continue;
        const [v, rest] = entry.split(":");
        const [x, d] = (rest ?? "").split("@");
        out.set(v as string, { x: Number(x), depth: Number(d) });
    }
    return out;
}

describe("Tidy Tree Embedding (Reingold-Tilford)", () => {
    it("produces an overlap-free embedding with centered parents and ordered siblings", () => {
        const input = mod.defaultInput as { edges: EdgePair[]; root: string };
        const trees: Array<{ edges: EdgePair[]; root: string }> = [
            input,
            {
                edges: [
                    ["R", "A"],
                    ["R", "B"],
                    ["R", "C"],
                    ["A", "A1"],
                    ["A", "A2"],
                    ["C", "C1"],
                ],
                root: "R",
            },
            {
                edges: [
                    ["1", "2"],
                    ["2", "3"],
                    ["3", "4"],
                    ["3", "5"],
                    ["5", "6"],
                    ["5", "7"],
                ],
                root: "1",
            },
        ];
        for (const tree of trees) {
            const frames = [...mod.run(tree)];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const pos = parsePositions(String(meta?.["positions"] ?? ""));
            const children = new Map<string, string[]>();
            for (const [p, c] of tree.edges) {
                const list = children.get(p) ?? [];
                list.push(c);
                children.set(p, list);
            }
            const all = new Set<string>([tree.root]);
            for (const [p, c] of tree.edges) {
                all.add(p);
                all.add(c);
            }
            expect(pos.size).toBe(all.size);

            const byDepth = new Map<number, number[]>();
            for (const p of pos.values()) {
                const list = byDepth.get(p.depth) ?? [];
                list.push(p.x);
                byDepth.set(p.depth, list);
            }
            for (const xs of byDepth.values()) expect(new Set(xs).size).toBe(xs.length);

            expect((pos.get(tree.root) as { depth: number }).depth).toBe(0);
            const queue = [tree.root];
            while (queue.length > 0) {
                const p = queue.shift() as string;
                const kids = children.get(p) ?? [];
                for (const c of kids) {
                    expect((pos.get(c) as { depth: number }).depth).toBe((pos.get(p) as { depth: number }).depth + 1);
                    queue.push(c);
                }
                if (kids.length > 0) {
                    const xs = kids.map((c) => (pos.get(c) as { x: number }).x);
                    for (let i = 0; i + 1 < xs.length; i += 1) expect(xs[i] as number).toBeLessThan(xs[i + 1] as number);
                    const parentX = (pos.get(p) as { x: number }).x;
                    expect(parentX).toBeGreaterThanOrEqual(Math.min(...xs));
                    expect(parentX).toBeLessThanOrEqual(Math.max(...xs));
                }
            }
        }
    });

    it("is deterministic and terminates on an empty tree", () => {
        const input = mod.defaultInput;
        expect([...mod.run(input)].at(-1)?.meta["positions"]).toBe([...mod.run(input)].at(-1)?.meta["positions"]);
        const frames = [...mod.run({ edges: [], root: "A" })];
        checkFrames(frames);
        expect(frames[0]?.meta["nodes"]).toBe(1);
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
