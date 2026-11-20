/**
 * two-phase-locking.test.ts - Lock compatibility, deadlock resolution, serializability, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./two-phase-locking";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.edges).toEqual([]);
        for (const entity of frame.entities) {
            expect(entity.id).toBeTruthy();
            expect(entity.type).toBe("cell");
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(entity.metadata).toBeDefined();
        }
    });
}

/** Independently test acyclicity of the precedence graph with Kahn's algorithm. */
function acyclic(nodes: number[], edges: Array<[number, number]>): boolean {
    const indegree = new Map<number, number>(nodes.map((n) => [n, 0]));
    const adjacency = new Map<number, number[]>(nodes.map((n) => [n, []]));
    for (const [from, to] of edges) {
        if (!indegree.has(to)) continue;
        indegree.set(to, (indegree.get(to) as number) + 1);
        (adjacency.get(from) ?? []).push(to);
    }
    const queue = nodes.filter((n) => indegree.get(n) === 0);
    let removed = 0;
    while (queue.length) {
        const node = queue.shift() as number;
        removed += 1;
        for (const next of adjacency.get(node) ?? []) {
            const degree = (indegree.get(next) as number) - 1;
            indegree.set(next, degree);
            if (degree === 0) queue.push(next);
        }
    }
    return removed === nodes.length;
}

describe("TwoPhaseLocking", () => {
    it("never grants conflicting locks in any frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        for (const frame of frames) {
            const keys = frame.meta["keys"] as string[];
            const cells = frame.meta["cells"] as string[];
            const txs = frame.meta["txs"] as number[];
            for (let row = 0; row < keys.length; row += 1) {
                const rowCells = cells.slice(row * txs.length, (row + 1) * txs.length);
                const exclusive = rowCells.filter((label) => label === "X").length;
                const shared = rowCells.filter((label) => label === "S").length;
                expect(exclusive <= 1).toBe(true);
                if (exclusive === 1) expect(shared).toBe(0);
            }
        }
    });

    it("detects the deadlock, aborts a victim, and ends serializable", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(Number(meta?.["aborts"])).toBeGreaterThanOrEqual(1);
        expect(meta?.["waits"]).toEqual([]);
        expect(meta?.["serializable"]).toBe(true);

        const granted = meta?.["grantedOps"] as string[];
        const txs = meta?.["txs"] as number[];
        const edges: Array<[number, number]> = [];
        for (let i = 0; i < granted.length; i += 1) {
            for (let j = i + 1; j < granted.length; j += 1) {
                const [txA, modeA, keyA] = (granted[i] as string).split(":");
                const [txB, modeB, keyB] = (granted[j] as string).split(":");
                if (keyA === keyB && txA !== txB && (modeA === "X" || modeB === "X")) {
                    edges.push([Number(txA), Number(txB)]);
                }
            }
        }
        expect(acyclic(txs, edges)).toBe(true);
    });

    it("reports no abort or phase violation for a non-conflicting schedule", () => {
        const operations = [
            { tx: 1, key: "A", mode: "X" as const },
            { tx: 2, key: "B", mode: "X" as const },
            { tx: 1, key: "A", mode: "U" as const },
            { tx: 2, key: "B", mode: "U" as const },
        ];
        const frames = [...mod.run({ operations })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        expect(Number(meta?.["aborts"])).toBe(0);
        expect(Number(meta?.["violations"])).toBe(0);
        expect(meta?.["serializable"]).toBe(true);
    });

    it("does not grant a new lock after a transaction releases one", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const events = frames[frames.length - 1]?.meta["events"] as string[];
        const released = new Set<number>();
        for (const event of events) {
            const [kind, txText] = event.split(":");
            const tx = Number(txText);
            if (kind === "release" || kind === "commit") released.add(tx);
            if (kind === "grant") expect(released.has(tx)).toBe(false);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(8);
        expect(generator.next().done).toBe(true);
    });
});
