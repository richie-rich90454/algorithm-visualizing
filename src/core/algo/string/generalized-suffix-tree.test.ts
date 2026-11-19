/**
 * generalized-suffix-tree.test.ts - Brute-force leaf set, sentinel ownership,
 * compression preserving labels, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./generalized-suffix-tree";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], expectedCount: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
    expect(frames.length).toBe(expectedCount);
    expect(frames[frames.length - 1].entities.some((e) => e.state === "sorted")).toBe(true);
}

function leafPairs(frame: VisualFrame): Array<{ doc: number; suffix: string }> {
    const paths = frame.meta["leafPaths"] as string[];
    const owners = frame.meta["leafOwners"] as number[];
    return paths.map((p, i) => ({ doc: owners[i] ?? -1, suffix: p.slice(0, -1) }));
}

describe("GeneralizedSuffixTree", () => {
    it("has exactly one leaf per suffix with the correct document ownership", () => {
        const strings = ["banana", "bandana"];
        const frames = [...mod.run({ strings })];
        const total = strings.reduce((sum, s) => sum + s.length, 0);
        checkFrames(frames, total + 2);
        const final = frames[frames.length - 1];
        expect(final.meta["leaves"]).toBe(total);
        const pairs = leafPairs(final);
        strings.forEach((text, doc) => {
            const actual = pairs.filter((p) => p.doc === doc).map((p) => p.suffix).sort();
            const expected = Array.from({ length: text.length }, (_, i) => text.slice(i)).sort();
            expect(actual).toEqual(expected);
        });
    });

    it("keeps every root-to-leaf label when compressing the trie", () => {
        const strings = ["abab", "baba", "ab"];
        const frames = [...mod.run({ strings })];
        const rawPaths = (frames[frames.length - 2].meta["leafPaths"] as string[]).slice().sort();
        const compactPaths = (frames[frames.length - 1].meta["leafPaths"] as string[]).slice().sort();
        expect(compactPaths).toEqual(rawPaths);
    });

    it("uses distinct sentinels and fewer nodes after compaction", () => {
        const frames = [...mod.run({ strings: ["abc", "xyz", "aaa"] })];
        const final = frames[frames.length - 1];
        const paths = final.meta["leafPaths"] as string[];
        const sentinels = new Set(paths.map((p) => p[p.length - 1]));
        expect(sentinels.size).toBe(3);
        const rawNodes = Number(frames[frames.length - 2].meta["nodes"]);
        expect(Number(final.meta["nodes"])).toBeLessThan(rawNodes);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBe(6 + 7 + 2);
        expect(generator.next().done).toBe(true);
    });
});
