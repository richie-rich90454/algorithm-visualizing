/**
 * tree-of-thoughts.test.ts - Independent beam-search replay, goal-path
 * reconstruction, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./tree-of-thoughts";
import type { VisualFrame } from "@/types";

interface Thought {
    id: string;
    parent: string;
    score: number;
    goal?: boolean;
}

function beamReplay(nodes: Thought[], width: number) {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const childrenOf = new Map<string, Thought[]>();
    for (const node of nodes) {
        if (node.parent === "") continue;
        const list = childrenOf.get(node.parent) ?? [];
        list.push(node);
        childrenOf.set(node.parent, list);
    }
    const root = nodes.find((node) => node.parent === "") ?? nodes[0]!;
    let frontier = [root.id];
    const frontiers: string[][] = [frontier.slice()];
    let depth = 0;
    while (frontier.length > 0) {
        const goal = frontier.find((id) => byId.get(id)?.goal === true);
        if (goal !== undefined) {
            const path: string[] = [];
            let cursor: string | undefined = goal;
            while (cursor !== undefined && cursor !== "") {
                path.push(cursor);
                cursor = byId.get(cursor)?.parent;
            }
            return { solution: goal, path, depth, frontiers };
        }
        const next: Thought[] = [];
        for (const id of frontier) {
            for (const child of childrenOf.get(id) ?? []) {
                next.push(child);
            }
        }
        if (next.length === 0) break;
        next.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
        frontier = next.slice(0, width).map((node) => node.id);
        depth += 1;
        frontiers.push(frontier.slice());
    }
    return { solution: "", path: [] as string[], depth, frontiers };
}

function checkFrames(frames: VisualFrame[], nodes: Thought[]): void {
    const edgeCount = nodes.filter((node) => node.parent !== "").length;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBe(nodes.length);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.length).toBe(edgeCount);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("TreeOfThoughts", () => {
    it("finds the same goal and path as an independent beam replay", () => {
        const input = mod.defaultInput as { nodes: Thought[]; beamWidth: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.nodes);
        const final = frames[frames.length - 1]?.meta;
        const expected = beamReplay(input.nodes, input.beamWidth);
        expect(final?.["found"]).toBe(true);
        expect(final?.["solution"]).toBe(expected.solution);
        expect(final?.["path"]).toEqual(expected.path);
    });

    it("keeps exactly the top-k children at every depth", () => {
        const input = mod.defaultInput as { nodes: Thought[]; beamWidth: number };
        for (const width of [1, 2, 3]) {
            const expected = beamReplay(input.nodes, width);
            const frames = [...mod.run({ ...input, beamWidth: width })];
            const observed = frames
                .map((frame) => frame.meta)
                .filter((meta) => Array.isArray(meta["frontier"]) && (meta["frontier"] as string[]).length > 0)
                .map((meta) => meta["frontier"] as string[]);
            expect(observed).toEqual(expected.frontiers);
        }
    });

    it("reports failure when no goal survives the beam", () => {
        const nodes: Thought[] = [
            { id: "r", parent: "", score: 0 },
            { id: "a", parent: "r", score: 1 },
            { id: "b", parent: "r", score: 2 },
            { id: "g", parent: "a", score: 9, goal: true },
        ];
        const frames = [...mod.run({ nodes, beamWidth: 1 })];
        checkFrames(frames, nodes);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["found"]).toBe(false);
        expect(final?.["solution"]).toBe("");
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
