/**
 * medusa-decoding.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./medusa-decoding";
import type { VisualFrame } from "@/types";

interface Node {
    id: string;
    token: number;
    parentId: string;
    level: number;
}

function reference(last: number, vocab: number, depth: number, branch: number) {
    const greedy: number[] = [];
    let cursor = last;
    for (let i = 0; i <= depth; i += 1) {
        cursor = (5 * cursor + 3) % vocab;
        greedy.push(cursor);
    }
    const nodes: Node[] = [{ id: "n0", token: last, parentId: "", level: 0 }];
    let frontier = ["n0"];
    for (let level = 1; level <= depth; level += 1) {
        const next: string[] = [];
        for (const parentId of frontier) {
            const parent = nodes.find((node) => node.id === parentId)!;
            for (let head = 0; head < branch; head += 1) {
                const id = `n${nodes.length}`;
                nodes.push({ id, token: (7 * parent.token + 3 * head + 1) % vocab, parentId, level });
                next.push(id);
            }
        }
        frontier = next;
    }
    let bestMatch = -1;
    for (const leaf of nodes.filter((node) => node.level === depth)) {
        const chain: Node[] = [];
        let current: Node | undefined = leaf;
        while (current && current.level > 0) {
            chain.unshift(current);
            current = nodes.find((node) => node.id === current?.parentId);
        }
        let matched = 0;
        while (matched < chain.length && chain[matched]?.token === greedy[matched]) {
            matched += 1;
        }
        if (matched > bestMatch) {
            bestMatch = matched;
        }
    }
    const acceptedLen = Math.max(0, bestMatch);
    return {
        nodes: nodes.length,
        greedy,
        acceptedLen,
        output: greedy.slice(0, Math.min(acceptedLen + 1, greedy.length)),
        targetCalls: acceptedLen + 1,
    };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        frame.edges.forEach((edge) => {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        });
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Medusa Decoding (Tree Verification)", () => {
    it("matches an independent tree-verification reference", () => {
        const input = mod.defaultInput as {
            lastToken: number;
            vocabSize: number;
            depth: number;
            branch: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input.lastToken, input.vocabSize, input.depth, input.branch);
        expect(final?.["nodes"]).toBe(expected.nodes);
        expect(final?.["acceptedLen"]).toBe(expected.acceptedLen);
        expect(final?.["targetCalls"]).toBe(expected.targetCalls);
        expect(final?.["output"]).toEqual(expected.output);
        expect(final?.["greedy"]).toEqual(expected.greedy);
    });

    it("always emits a lossless prefix of greedy decoding", () => {
        const cases = [
            { lastToken: 0, vocabSize: 12, depth: 2, branch: 2 },
            { lastToken: 7, vocabSize: 12, depth: 3, branch: 3 },
            { lastToken: 11, vocabSize: 7, depth: 4, branch: 2 },
            { lastToken: 3, vocabSize: 5, depth: 1, branch: 4 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            const final = frames[frames.length - 1]?.meta;
            const output = final?.["output"] as number[];
            const greedy = final?.["greedy"] as number[];
            expect(output.length).toBeGreaterThan(0);
            output.forEach((token, index) => expect(token).toBe(greedy[index]));
            expect(output.length).toBeLessThanOrEqual(greedy.length);
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
