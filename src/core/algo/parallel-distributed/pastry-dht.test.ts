/**
 * pastry-dht.test.ts - Brute-force closest-node verification, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./pastry-dht";
import type { VisualFrame } from "@/types";

const SPACE = 4 ** 4;

function dist(a: number, b: number): number {
    const d = Math.abs(a - b) % SPACE;
    return Math.min(d, SPACE - d);
}

function closest(key: number, nodes: number[]): number {
    let best = nodes[0]!;
    let bd = dist(best, key);
    for (const n of nodes) {
        const d = dist(n, key);
        if (d < bd || (d === bd && n < best)) {
            best = n;
            bd = d;
        }
    }
    return best;
}

function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 2 ** 32;
    };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const e of frame.entities) expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(true);
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("PastryDht", () => {
    it("always routes to the numerically closest node (brute force)", () => {
        const rand = rng(2024);
        const cases: Array<{ nodes: number[]; key: number; start: number }> = [
            { nodes: (mod.defaultInput as { nodes: number[] }).nodes, key: 100, start: 3 },
        ];
        for (let t = 0; t < 12; t += 1) {
            const nodes = Array.from(new Set(Array.from({ length: 10 }, () => Math.floor(rand() * SPACE)))).sort((a, b) => a - b);
            if (nodes.length < 2) continue;
            cases.push({ nodes, key: Math.floor(rand() * SPACE), start: nodes[Math.floor(rand() * nodes.length)]! });
        }
        for (const c of cases) {
            const frames = [...mod.run(c)];
            checkFrames(frames);
            const final = frames.at(-1)!;
            const path = final.meta["path"] as number[];
            expect(path[0]).toBe(c.nodes.includes(c.start) ? c.start : c.nodes[0]);
            expect(path.at(-1)).toBe(closest(c.key, c.nodes));
            expect(final.meta["target"]).toBe(closest(c.key, c.nodes));
            expect(path.length - 1).toBeLessThanOrEqual(4 + 8 + 4);
        }
    });

    it("a hop always moves to a different node and the path has no immediate repeats", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const path = frames.at(-1)!.meta["path"] as number[];
        for (let i = 1; i < path.length; i += 1) expect(path[i]).not.toBe(path[i - 1]);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBeGreaterThanOrEqual(3);
        expect(gen.next().done).toBe(true);
    });
});
