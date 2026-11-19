/**
 * zipper-ds.test.ts - Zipper edit correctness against an independent model.
 */

import { describe, expect, it } from "vitest";
import mod from "./zipper-ds";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        if (!frame) {
            continue;
        }
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    }
}

interface Node {
    v: number;
    l: Node | null;
    r: Node | null;
}

function referenceInorder(values: number[], moves: string[]): number[] {
    if (values.length === 0) {
        return [];
    }
    const nodes: Node[] = values.map((v) => ({ v, l: null, r: null }));
    for (let i = 0; i < nodes.length; i += 1) {
        nodes[i].l = nodes[2 * i + 1] ?? null;
        nodes[i].r = nodes[2 * i + 2] ?? null;
    }
    const path: number[] = [0];
    for (const raw of moves) {
        const node = nodes[path[path.length - 1] ?? 0];
        if (!node) {
            continue;
        }
        const move = String(raw).trim().toUpperCase();
        if (move === "L" && node.l) {
            path.push(2 * (path[path.length - 1] ?? 0) + 1);
        } else if (move === "R" && node.r) {
            path.push(2 * (path[path.length - 1] ?? 0) + 2);
        } else if (move === "U" && path.length > 1) {
            path.pop();
        } else if (move.startsWith("S:")) {
            node.v = Number(move.slice(2)) || 0;
        }
    }
    const out: number[] = [];
    const walk = (node: Node | null): void => {
        if (!node) {
            return;
        }
        walk(node.l);
        out.push(node.v);
        walk(node.r);
    };
    walk(nodes[0] ?? null);
    return out;
}

describe("Tree Zipper", () => {
    it("rebuilds the edited tree on the default input", () => {
        const input = mod.defaultInput as { values: number[]; moves: string[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["inorder"]).toEqual(referenceInorder(input.values, input.moves));
    });

    it("matches an independent cursor model on random move scripts", () => {
        let seed = 31;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        for (let trial = 0; trial < 30; trial += 1) {
            const n = 1 + Math.floor(rand() * 7);
            const values: number[] = [];
            for (let i = 0; i < n; i += 1) {
                values.push(Math.floor(rand() * 30));
            }
            const moves: string[] = [];
            const count = Math.floor(rand() * 8);
            for (let i = 0; i < count; i += 1) {
                const pick = Math.floor(rand() * 4);
                moves.push(pick === 0 ? "L" : pick === 1 ? "R" : pick === 2 ? "U" : `S:${Math.floor(rand() * 50)}`);
            }
            const frames = [...mod.run({ values, moves })];
            checkFrames(frames);
            const inorder = frames[frames.length - 1]?.meta["inorder"] as number[];
            expect(inorder).toEqual(referenceInorder(values, moves));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
