import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./dawg-minimization";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(f.edges)).toBe(true);
        expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber).toBeLessThan(module.pseudocode!.length);
        expect(f.layout).toBe(module.visualType);
        expect(f.meta).toBeDefined();
        const ids = new Set(f.entities.map((e) => e.id));
        for (const e of f.edges) {
            expect(ids.has(e.sourceId)).toBe(true);
            expect(ids.has(e.targetId)).toBe(true);
        }
    });
}

type Node = { final: boolean; children: Map<string, number> };

function automatonFrom(frame: VisualFrame): { nodes: Map<number, Node>; start: number } {
    const nodes = new Map<number, Node>();
    let start = -1;
    for (const e of frame.entities) {
        const id = Number(e.metadata["stateId"]);
        nodes.set(id, { final: Boolean(e.metadata["final"]), children: new Map() });
        if (e.metadata["start"] === true) start = id;
    }
    for (const edge of frame.edges) {
        const from = Number(edge.sourceId.replace("node-", ""));
        const to = Number(edge.targetId.replace("node-", ""));
        nodes.get(from)!.children.set(edge.label, to);
    }
    return { nodes, start };
}

function accepts(auto: ReturnType<typeof automatonFrom>, word: string): boolean {
    let cur = auto.start;
    for (const ch of word) {
        const next = auto.nodes.get(cur)!.children.get(ch);
        if (next === undefined) return false;
        cur = next;
    }
    return auto.nodes.get(cur)!.final;
}

describe("DawgMinimization", () => {
    it("terminates with well-formed frames and valid edge endpoints", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("minimal DAWG accepts exactly the input words and is fully merged", () => {
        const cases = [
            ["cat", "car", "dog", "do"],
            ["he", "she", "hers", "his"],
            ["a", "ab", "abc"],
            ["to", "tea", "ted", "ten", "in", "inn"],
        ];
        for (const words of cases) {
            const frames = [...module.run({ words })];
            checkFrames(frames);
            const auto = automatonFrom(frames[frames.length - 1]!);
            for (const w of words) expect(accepts(auto, w)).toBe(true);
            const rejects = ["zzz", "qx", "xyz", "ba", "cado", "the", "abab", "t", "ado"];
            for (const w of rejects) {
                if (!words.includes(w)) expect(accepts(auto, w)).toBe(false);
            }
            // Minimality: no two states share the same final flag and successor set.
            const sigs = new Set<string>();
            for (const node of auto.nodes.values()) {
                const sig = `${node.final ? 1 : 0}|${[...node.children.entries()].sort().map(([c, t]) => `${c}:${t}`).join(",")}`;
                sigs.add(sig);
            }
            expect(sigs.size).toBe(auto.nodes.size);
        }
    });
});
