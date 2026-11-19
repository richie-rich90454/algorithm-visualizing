/**
 * resilient-distributed-dataset.test.ts - Independent lineage replay, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./resilient-distributed-dataset";
import type { VisualFrame } from "@/types";

type Transform =
    | { kind: "map"; add: number }
    | { kind: "filter"; mode: "even" | "odd" | "gt" | "lt"; threshold?: number };

function apply(values: number[], t: Transform): number[] {
    if (t.kind === "map") return values.map((v) => v + t.add);
    const th = t.threshold ?? 0;
    if (t.mode === "even") return values.filter((v) => v % 2 === 0);
    if (t.mode === "odd") return values.filter((v) => v % 2 !== 0);
    if (t.mode === "gt") return values.filter((v) => v > th);
    return values.filter((v) => v < th);
}

function split(values: number[], p: number): number[][] {
    const parts: number[][] = Array.from({ length: p }, () => []);
    for (let i = 0; i < values.length; i += 1) parts[Math.floor((i * p) / values.length)]!.push(values[i]!);
    return parts;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"] ?? frame.meta["partitions"]).toBeDefined();
        for (const e of frame.entities) expect(Number.isFinite(e.x) && Number.isFinite(e.y)).toBe(true);
        expect(frame.edges).toEqual([]);
    });
}

describe("ResilientDistributedDataset", () => {
    it("recomputes a lost partition exactly via lineage", () => {
        const d = mod.defaultInput as { values: number[]; partitions: number; transforms: Transform[] };
        const cases = [
            { values: d.values, partitions: d.partitions, transforms: d.transforms, losePartition: 0 },
            { values: [2, 4, 6, 8, 10, 12], partitions: 2, transforms: [{ kind: "map" as const, add: 3 }, { kind: "filter" as const, mode: "even" as const }], losePartition: 1 },
            { values: [1, 5, 9, 13, 17], partitions: 3, transforms: [{ kind: "filter" as const, mode: "gt" as const, threshold: 4 }, { kind: "map" as const, add: 100 }], losePartition: 2 },
        ];
        for (const c of cases) {
            const frames = [...mod.run(c)];
            checkFrames(frames);
            const parts = split(c.values, c.partitions);
            let replayed = [...parts[c.losePartition]!];
            let finalStage = [...parts[c.losePartition]!];
            for (const t of c.transforms) {
                replayed = apply(replayed, t);
                finalStage = apply(finalStage, t);
            }
            const last = frames.at(-1)!;
            expect(last.meta["recomputed"]).toEqual(replayed);
            expect(last.meta["lostValues"]).toEqual(finalStage);
            expect(last.meta["verified"]).toBe(true);
        }
    });

    it("records one stage per transform", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const transforms = (mod.defaultInput as { transforms: Transform[] }).transforms;
        expect(frames.at(-1)!.meta["stages"]).toBe(transforms.length + 1);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBe(1 + 3 + 1 + 1 + 1);
        expect(gen.next().done).toBe(true);
    });
});
