import { describe, expect, it } from "vitest";
import mod, { encodeLcrs, lcrsPreorder } from "./left-child-right-sibling-tree";
import type { VisualFrame } from "@/types";

/** Independent n-ary preorder built directly from the parent array. */
function referencePreorder(parents: number[]): number[] {
    const children: number[][] = parents.map(() => []);
    for (let i = 0; i < parents.length; i += 1) {
        if (parents[i] !== undefined && (parents[i] as number) >= 0) {
            children[parents[i] as number]?.push(i);
        }
    }
    const out: number[] = [];
    const visit = (node: number): void => {
        out.push(node);
        for (const kid of children[node] ?? []) {
            visit(kid);
        }
    };
    for (let i = 0; i < parents.length; i += 1) {
        if (parents[i] === -1) {
            visit(i);
        }
    }
    return out;
}

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        expect(frame.edges.every((edge) => edge.sourceId.startsWith("node-") && edge.targetId.startsWith("node-"))).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 8);
        expect(frame.meta).toBeDefined();
    });
}

describe("Left-Child Right-Sibling Tree", () => {
    it("emits well-formed frames and terminates", () => {
        const input = mod.defaultInput as { parents: number[] };
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames, input.parents.length);
        const last = frames[frames.length - 1];
        expect(last?.meta["samePreorder"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });

    it("encodes pointers and preserves preorder on randomized trees", () => {
        let seed = 424242;
        const rand = (limit: number): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed % limit;
        };
        for (let trial = 0; trial < 80; trial += 1) {
            const n = 1 + rand(16);
            const parents: number[] = [];
            for (let i = 0; i < n; i += 1) {
                parents.push(i === 0 ? -1 : rand(i));
            }
            const { left, right } = encodeLcrs(parents);
            const children: number[][] = parents.map(() => []);
            for (let i = 1; i < n; i += 1) {
                children[parents[i] as number]?.push(i);
            }
            for (let parent = 0; parent < n; parent += 1) {
                const kids = children[parent] ?? [];
                expect(left[parent]).toBe(kids.length > 0 ? kids[0] : -1);
                for (let i = 0; i + 1 < kids.length; i += 1) {
                    expect(right[kids[i] as number]).toBe(kids[i + 1]);
                }
                if (kids.length > 0) {
                    expect(right[kids[kids.length - 1] as number]).toBe(-1);
                }
            }
            const encoded = lcrsPreorder(left, right, 0);
            expect(encoded).toEqual(referencePreorder(parents));
        }
    });

    it("encodes a chain and a star correctly", () => {
        const chain = [-1, 0, 1, 2, 3];
        expect(lcrsPreorder(encodeLcrs(chain).left, encodeLcrs(chain).right, 0)).toEqual([0, 1, 2, 3, 4]);
        const star = [-1, 0, 0, 0, 0];
        const encoded = encodeLcrs(star);
        expect(encoded.left[0]).toBe(1);
        expect(encoded.right[1]).toBe(2);
        expect(encoded.right[2]).toBe(3);
        expect(encoded.right[3]).toBe(4);
        expect(encoded.right[4]).toBe(-1);
    });
});
