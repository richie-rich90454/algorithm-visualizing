/**
 * merkle-patricia-tree.test.ts - Independent trie reconstruction, hash and lookup checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./merkle-patricia-tree";
import type { VisualFrame } from "@/types";

type Pair = [string, string];

function toyHash(text: string): string {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}

interface FullNode {
    children: Map<string, FullNode>;
    value: string | null;
}
interface CompNode {
    prefix: string;
    value: string | null;
    children: Map<string, CompNode>;
}

/** Build an UNCOMPRESSED nibble trie, then compress it - independent of the module's split insertion. */
function reference(entries: Pair[]) {
    const full: FullNode = { children: new Map(), value: null };
    for (const [key, value] of entries) {
        let node = full;
        for (const nibble of key) {
            let child = node.children.get(nibble);
            if (!child) {
                child = { children: new Map(), value: null };
                node.children.set(nibble, child);
            }
            node = child;
        }
        node.value = value;
    }
    const compress = (node: FullNode, path: string, parentPath: string): CompNode => {
        if (node.value === null && node.children.size === 1) {
            const [nibble, only] = [...node.children.entries()][0]!;
            return compress(only!, path + nibble, parentPath);
        }
        const children = new Map<string, CompNode>();
        for (const [nibble, child] of node.children) {
            const cc = compress(child, path + nibble, path);
            children.set(cc.prefix[0] ?? "", cc);
        }
        return { prefix: path.slice(parentPath.length), value: node.value, children };
    };
    const rootChildren = new Map<string, CompNode>();
    for (const [nibble, child] of full.children) {
        const cc = compress(child, nibble, "");
        rootChildren.set(cc.prefix[0] ?? "", cc);
    }
    const root: CompNode = { prefix: "", value: full.value, children: rootChildren };
    const hash = (node: CompNode): string => {
        const parts = [node.prefix, node.value ?? ""];
        for (const [nibble, child] of [...node.children.entries()].sort((a, b) =>
            a[0].localeCompare(b[0]),
        )) {
            parts.push(`${nibble}:${hash(child)}`);
        }
        return toyHash(parts.join("|"));
    };
    const lookup = (key: string): string | null => {
        let node = root;
        let used = 0;
        while (used < key.length) {
            const child = node.children.get(key[used] ?? "");
            if (!child || !key.startsWith(child.prefix, used)) {
                return null;
            }
            node = child;
            used += child.prefix.length;
        }
        return used === key.length ? node.value : null;
    };
    return { rootHash: hash(root), lookup };
}

function checkFrames(frames: VisualFrame[], expectedEntries: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        expect(ids.size).toBe(frame.entities.length);
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["entries"]).toBe(expectedEntries);
        expect(frame.meta["rootHash"]).toBeDefined();
    });
}

describe("MerklePatriciaTrie", () => {
    it("matches an independently compressed trie's root hash and lookups", () => {
        const datasets: Pair[][] = [
            [
                ["do", "dog"],
                ["dog", "puppy"],
                ["doge", "coin"],
                ["horse", "stallion"],
            ],
            [["a", "1"]],
            [
                ["a", "1"],
                ["ab", "2"],
                ["abc", "3"],
                ["b", "4"],
            ],
            [
                ["f0", "zero"],
                ["ff", "one"],
                ["0a", "two"],
            ],
        ];
        for (const entries of datasets) {
            const frames = [...mod.run({ entries })];
            checkFrames(frames, entries.length);
            const expected = reference(entries);
            const final = frames[frames.length - 1];
            expect(final?.meta["rootHash"]).toBe(expected.rootHash);
            for (const [key, value] of entries) {
                const found = [...mod.run({ entries, query: key })].pop()?.meta["queryValue"];
                expect(found).toBe(value);
                expect(expected.lookup(key)).toBe(value);
            }
            expect(expected.lookup("missing")).toBeNull();
        }
    });

    it("the root hash changes when any value changes", () => {
        const base: Pair[] = [
            ["do", "dog"],
            ["dog", "puppy"],
            ["horse", "stallion"],
        ];
        const baseHash = [...mod.run({ entries: base })].pop()?.meta["rootHash"];
        const changed: Pair[] = base.map(([key, value], i) =>
            i === 1 ? [key, `${value}!`] : [key, value],
        );
        const changedHash = [...mod.run({ entries: changed })].pop()?.meta["rootHash"];
        expect(changedHash).not.toBe(baseHash);
    });

    it("empty input is well formed and reports the empty trie hash", () => {
        const frames = [...mod.run({ entries: [] })];
        checkFrames(frames, 0);
        expect(frames[frames.length - 1]?.meta["rootHash"]).toBe(reference([]).rootHash);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
