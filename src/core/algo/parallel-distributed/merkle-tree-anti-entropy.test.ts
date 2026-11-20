/**
 * merkle-tree-anti-entropy.test.ts - Independent leaf comparison cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./merkle-tree-anti-entropy";
import type { VisualFrame } from "@/types";

/** Independent FNV-1a hash used only to verify tree consistency. */
function refHash(input: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}

/** Number of nodes in a padded binary Merkle tree over n leaves. */
function treeNodeCount(n: number): number {
    let count = n;
    let level = n;
    while (level > 1) {
        level = Math.ceil(level / 2);
        count += level;
    }
    return count;
}

function checkFrames(frames: VisualFrame[], expectedNodes: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBe(expectedNodes);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("Merkle tree anti-entropy", () => {
    it("finds exactly the differing leaves across several replicas", () => {
        const cases: Array<{ keys: string[]; a: string[]; b: string[] }> = [
            { keys: ["a", "b", "c", "d"], a: ["1", "2", "3", "4"], b: ["1", "9", "3", "4"] },
            { keys: ["a", "b", "c", "d"], a: ["1", "2", "3", "4"], b: ["1", "2", "3", "4"] },
            { keys: ["a", "b", "c", "d", "e"], a: ["1", "2", "3", "4", "5"], b: ["9", "2", "8", "4", "0"] },
            { keys: ["k0", "k1"], a: ["x", "y"], b: ["x", "z"] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ keys: testCase.keys, replicaA: testCase.a, replicaB: testCase.b })];
            const expectedNodes = treeNodeCount(testCase.a.length);
            checkFrames(frames, expectedNodes);

            const expectedDiff = testCase.a
                .map((v, i) => (v !== testCase.b[i] ? i : -1))
                .filter((i) => i >= 0);

            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["differingLeaves"]).toEqual(expectedDiff);
            const differingKeys = finalMeta?.["differingKeys"] as string[];
            expect(differingKeys).toEqual(expectedDiff.map((i) => testCase.keys[i]));

            const rootA = finalMeta?.["rootA"] as number;
            const rootB = finalMeta?.["rootB"] as number;
            const equalData = expectedDiff.length === 0;
            expect(rootA === rootB).toBe(equalData);
        }
    });

    it("root hash equals the independent FNV of the concatenation pattern", () => {
        const values = ["1", "2", "3", "4"];
        const frames = [...mod.run({ keys: ["a", "b", "c", "d"], replicaA: values, replicaB: [...values] })];
        const finalMeta = frames[frames.length - 1]?.meta;
        const leafHashes = values.map(refHash);
        const left = refHash(`${leafHashes[0]}:${leafHashes[1]}`);
        const right = refHash(`${leafHashes[2]}:${leafHashes[3]}`);
        const root = refHash(`${left}:${right}`);
        expect(finalMeta?.["rootA"]).toBe(root);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
