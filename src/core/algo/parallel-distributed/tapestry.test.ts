/** tapestry.test.ts - Brute-force prefix-route checks, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./tapestry";
import type { VisualFrame } from "@/types";

const NODES = ["000", "007", "070", "077", "700", "707", "770", "777"];

function sharedPrefix(a: string, b: string): number {
    let count = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
        if (a[i] !== b[i]) {
            break;
        }
        count += 1;
    }
    return count;
}

/** Independent Plaxton table lookup for the next digit. */
function tableNeighbor(current: string, target: string, nodes: string[]): string | null {
    const j = sharedPrefix(current, target);
    if (j >= current.length) {
        return null;
    }
    let best: string | null = null;
    for (const candidate of nodes) {
        if (candidate === current || sharedPrefix(candidate, current) < j || candidate[j] !== target[j]) {
            continue;
        }
        if (best === null || parseInt(candidate, 8) < parseInt(best, 8)) {
            best = candidate;
        }
    }
    return best;
}

/** Breadth-first search over Plaxton table hops for the minimum hop count. */
function shortestHops(source: string, target: string, nodes: string[]): number {
    const queue: Array<{ id: string; depth: number }> = [{ id: source, depth: 0 }];
    const seen = new Set([source]);
    while (queue.length > 0) {
        const front = queue.shift();
        if (!front) {
            break;
        }
        if (front.id === target) {
            return front.depth;
        }
        const next = tableNeighbor(front.id, target, nodes);
        if (next !== null && !seen.has(next)) {
            seen.add(next);
            queue.push({ id: next, depth: front.depth + 1 });
        }
    }
    return -1;
}

function checkFrames(frames: VisualFrame[], codeLines: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(codeLines);
        expect(frame.meta).toBeDefined();
        const ids = new Set(frame.entities.map((entity) => entity.id));
        frame.edges.forEach((edge) => {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        });
        frame.entities.forEach((entity) => {
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(Number.isFinite(entity.y)).toBe(true);
        });
    });
}

describe("Tapestry overlay routing", () => {
    it("routes every ordered node pair along prefix-increasing hops", () => {
        for (const source of NODES) {
            for (const target of NODES) {
                const frames = [...mod.run({ nodes: NODES, source, target })];
                checkFrames(frames, mod.pseudocode?.length ?? 0);
                const final = frames[frames.length - 1]?.meta;
                const path = final?.["path"] as string[];
                const prefixes = final?.["prefixes"] as number[];
                expect(final?.["reached"]).toBe(true);
                expect(path[0]).toBe(source);
                expect(path[path.length - 1]).toBe(target);
                expect(path.length - 1).toBeLessThanOrEqual(3);
                for (let i = 1; i < path.length; i += 1) {
                    expect(sharedPrefix(path[i] ?? "", target)).toBeGreaterThan(sharedPrefix(path[i - 1] ?? "", target));
                    expect(tableNeighbor(path[i - 1] ?? "", target, NODES)).toBe(path[i]);
                }
                for (let i = 1; i < prefixes.length; i += 1) {
                    expect(prefixes[i] ?? 0).toBeGreaterThan(prefixes[i - 1] ?? 0);
                }
                expect(path.length - 1).toBe(shortestHops(source, target, NODES));
            }
        }
    });

    it("reports the worked example path", () => {
        const frames = [...mod.run({ source: "000", target: "777" })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["path"]).toEqual(["000", "700", "770", "777"]);
        expect(final?.["hops"]).toBe(3);
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
