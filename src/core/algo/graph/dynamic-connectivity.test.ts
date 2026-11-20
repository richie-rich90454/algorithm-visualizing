/**
 * dynamic-connectivity.test.ts - Brute-force per-time connectivity check,
 * partition comparison, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./dynamic-connectivity";
import type { VisualFrame } from "@/types";

interface TimedEdge {
    u: string;
    v: string;
    start: number;
    end: number;
}
interface Input {
    vertices?: string[];
    edges?: TimedEdge[];
    times?: number[];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Canonical label: smallest vertex index in each connected component. */
function canonical(labels: string[], roots: number[]): number[] {
    const groups = new Map<number, number[]>();
    roots.forEach((root, i) => {
        const group = groups.get(root) ?? [];
        group.push(i);
        groups.set(root, group);
    });
    const result = Array<number>(labels.length).fill(-1);
    for (const group of groups.values()) {
        const min = Math.min(...group);
        for (const i of group) {
            result[i] = min;
        }
    }
    return result;
}

function bruteForce(input: Input): number[][] {
    const edges = input.edges ?? [];
    const times = input.times ?? [];
    const labels = [...new Set(edges.flatMap((e) => [e.u, e.v]))].sort();
    return times.map((_t, t) => {
        const parent = Array.from({ length: labels.length }, (_v, i) => i);
        const find = (x: number): number => {
            while (parent[x] !== x) {
                x = parent[x] as number;
            }
            return x;
        };
        for (const e of edges) {
            if (e.start <= t && t <= e.end) {
                const a = labels.indexOf(e.u);
                const b = labels.indexOf(e.v);
                if (a >= 0 && b >= 0) {
                    parent[find(a)] = find(b);
                }
            }
        }
        return canonical(labels, labels.map((_v, i) => find(i)));
    });
}

describe("Offline Dynamic Connectivity", () => {
    it("matches a fresh union-find at every query time", () => {
        const inputs: Input[] = [
            mod.defaultInput as Input,
            {
                vertices: ["A", "B", "C"],
                edges: [
                    { u: "A", v: "B", start: 0, end: 1 },
                    { u: "B", v: "C", start: 1, end: 2 },
                ],
                times: [0, 1, 2],
            },
        ];
        for (const input of inputs) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const labels = [...new Set((input.edges ?? []).flatMap((e) => [e.u, e.v]))].sort();
            const timeFrames = frames.filter((f) => Number(f.meta["time"]) >= 0);
            const expected = bruteForce(input);
            expect(timeFrames.length).toBe(expected.length);
            timeFrames.forEach((frame, t) => {
                const got = canonical(labels, frame.meta["components"] as number[]);
                expect(got).toEqual(expected[t]);
                expect(Number(frame.meta["activeEdges"])).toBe(
                    (input.edges ?? []).filter((e) => e.start <= t && t <= e.end).length,
                );
            });
        }
    });

    it("handles an empty input and terminates", () => {
        const empty = [...mod.run({ edges: [], times: [] })];
        checkFrames(empty);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
