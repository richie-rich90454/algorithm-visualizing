import { describe, expect, it } from "vitest";
import type { VisualEntity, VisualFrame } from "@/types";
import module from "./weiner-algorithm";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(module.pseudocode!.length);
        expect(frame.layout).toBe(module.visualType);
        expect(frame.meta).toBeDefined();
        for (const edge of frame.edges) {
            const ids = new Set(frame.entities.map((entity) => entity.id));
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

/** Reconstruct root-to-node strings from the final frame's edge labels. */
function pathStrings(frame: VisualFrame): Map<string, string> {
    const byId = new Map<string, VisualEntity>(frame.entities.map((entity) => [entity.id, entity]));
    const memo = new Map<string, string>();
    const path = (id: string): string => {
        const cached = memo.get(id);
        if (cached !== undefined) {
            return cached;
        }
        const entity = byId.get(id);
        expect(entity).toBeDefined();
        let result: string;
        if (entity!.metadata["isRoot"]) {
            result = "";
        } else {
            result = path(String(entity!.metadata["parentId"])) + String(entity!.metadata["fullLabel"]);
        }
        memo.set(id, result);
        return result;
    };
    for (const entity of frame.entities) {
        path(entity.id);
    }
    return memo;
}

function bruteSuffixes(text: string): string[] {
    return Array.from({ length: text.length }, (_, i) => text.slice(i)).sort();
}

describe("WeinerAlgorithm", () => {
    it("terminates with well-formed frames and valid edge endpoints", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("builds a suffix tree whose root-to-leaf strings are exactly the suffixes", () => {
        const texts = ["banana", "aaaa", "mississippi", "abc", "ababab", "a", "abacaba"];
        for (const raw of texts) {
            const frames = [...module.run({ text: raw })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!;
            const paths = pathStrings(last);
            const leaves = last.entities.filter((entity) => entity.metadata["isLeaf"]);
            const actual = leaves.map((entity) => paths.get(entity.id) as string).sort();
            expect(actual).toEqual(bruteSuffixes(raw + "\u0000"));
            expect(leaves.length).toBe(raw.length + 1);
            expect(last.meta.nodeCount).toBe(last.entities.length);
            expect(last.meta.showLinks).toBe(true);
        }
    });

    it("reports a suffix array consistent with the leaf strings", () => {
        const raw = "banana";
        const frames = [...module.run({ text: raw })];
        const last = frames[frames.length - 1]!;
        const paths = pathStrings(last);
        const leaves = last.entities.filter((entity) => entity.metadata["isLeaf"]);
        const ordered = [...leaves].sort((a, b) => (paths.get(a.id) as string).localeCompare(paths.get(b.id) as string));
        const expected = ordered.map((entity) => String(entity.metadata["suffixStart"])).join(",");
        expect(last.meta.suffixArray).toBe(expected);
    });
});
