/**
 * consistent-hashing-with-bounded-loads.test.ts - Brute-force assignment cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./consistent-hashing-with-bounded-loads";
import type { VisualFrame } from "@/types";

interface NodeSpec { id: string; position: number }
interface KeySpec { id: string; hash: number }

/** Independent greedy first-fit clockwise assignment. */
function reference(nodes: NodeSpec[], keys: KeySpec[], capacity: number): Map<string, string> {
    const ring = [...nodes].sort((a, b) => a.position - b.position);
    const load = new Map<string, number>(ring.map((n) => [n.id, 0]));
    const out = new Map<string, string>();
    for (const key of [...keys].sort((a, b) => a.hash - b.hash)) {
        let start = ring.findIndex((n) => n.position >= key.hash);
        if (start === -1) start = 0;
        for (let step = 0; step < ring.length; step += 1) {
            const node = ring[(start + step) % ring.length] as NodeSpec;
            if ((load.get(node.id) ?? 0) < capacity) {
                out.set(key.id, node.id);
                load.set(node.id, (load.get(node.id) ?? 0) + 1);
                break;
            }
        }
    }
    return out;
}

function checkFrames(frames: VisualFrame[], nodes: number, keys: number): void {
    expect(frames.length).toBe(keys + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(nodes + keys);
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

describe("Consistent hashing with bounded loads", () => {
    it("matches an independent greedy assignment and respects capacity", () => {
        const cases: Array<{ nodes: NodeSpec[]; keys: KeySpec[]; capacity: number }> = [
            {
                nodes: [
                    { id: "A", position: 0.1 },
                    { id: "B", position: 0.45 },
                    { id: "C", position: 0.8 },
                ],
                keys: [0.05, 0.2, 0.3, 0.5, 0.6, 0.7, 0.85, 0.95].map((hash, i) => ({ id: `k${i}`, hash })),
                capacity: 3,
            },
            {
                nodes: [
                    { id: "A", position: 0.0 },
                    { id: "B", position: 0.33 },
                    { id: "C", position: 0.66 },
                    { id: "D", position: 0.9 },
                ],
                keys: Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, hash: (i * 0.07) % 1 })),
                capacity: 2,
            },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.nodes.length, testCase.keys.length);
            const expected = reference(testCase.nodes, testCase.keys, testCase.capacity);
            const assignment = Object.fromEntries(
                JSON.parse(String(frames[frames.length - 1]?.meta["assigned"] ?? "[]")) as Array<[string, string]>,
            );
            expect(assignment).toEqual(Object.fromEntries(expected));

            const loads = JSON.parse(String(frames[frames.length - 1]?.meta["loads"] ?? "{}")) as Record<string, number>;
            for (const node of testCase.nodes) {
                expect(loads[node.id] ?? 0).toBeLessThanOrEqual(testCase.capacity);
                expect(loads[node.id] ?? 0).toBe(
                    [...expected.values()].filter((id) => id === node.id).length,
                );
            }
        }
    });

    it("assigns a key past the last node by wrapping to the first", () => {
        const input = {
            nodes: [{ id: "A", position: 0.2 }, { id: "B", position: 0.6 }],
            keys: [{ id: "late", hash: 0.9 }],
            capacity: 1,
        };
        const frames = [...mod.run(input)];
        const assignment = Object.fromEntries(JSON.parse(String(frames[frames.length - 1]?.meta["assigned"] ?? "[]")) as Array<[string, string]>);
        expect(assignment["late"]).toBe("A");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
