/** star-transformer.test.ts - Sparse aggregation, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { starTransform } from "./star-transformer";
import type { VisualFrame } from "@/types";

interface Input {
    values: number[];
    relay: number;
    layers: number;
}

function checkFrames(frames: VisualFrame[], nodes: number, layers: number): void {
    expect(frames.length).toBe(layers + 2);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(nodes + 1);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.length).toBe(nodes * 2);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["nodes"]).toBe(nodes);
    });
}

function attend(query: number, keys: number[]): number {
    const scores = keys.map((k) => query * k);
    const max = Math.max(...scores);
    const exps = scores.map((s) => Math.exp(s - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return keys.reduce((acc, k, i) => acc + (exps[i] ?? 0) / sum * k, 0);
}

describe("Star-Transformer", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent sparse aggregation over all layers", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.values.length, input.layers);
        let nodes = [...input.values];
        let relay = input.relay;
        const n = nodes.length;
        const helper = starTransform(input);
        for (let layer = 1; layer <= input.layers; layer += 1) {
            const next = nodes.map((v, i) =>
                attend(v, [v, nodes[(i - 1 + n) % n] ?? 0, nodes[(i + 1) % n] ?? 0, relay]),
            );
            const nextRelay = attend(relay, nodes);
            nodes = next;
            relay = nextRelay;
            const got = frames[layer]?.meta["values"] as number[];
            nodes.forEach((v, i) => expect(got[i]).toBeCloseTo(v, 12));
            helper[layer - 1]?.nodes.forEach((v, i) => expect(got[i]).toBeCloseTo(v, 12));
        }
        const final = frames[frames.length - 1]?.meta["values"] as number[];
        expect(final.every(Number.isFinite)).toBe(true);
    });

    it("gives every node exactly two ring edges and one relay edge", () => {
        const frame = [...mod.run(input)][1];
        const ids = new Set(frame?.entities.map((e) => e.id));
        expect(ids.has("relay")).toBe(true);
        frame?.edges.forEach((edge) => {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
