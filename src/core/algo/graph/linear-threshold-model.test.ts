import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./linear-threshold-model";

function collect(input: unknown): VisualFrame[] {
    return [...mod.run(input)];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("graph");
        expect(frame.edges).toBeInstanceOf(Array);
        expect(frame.meta).toBeTypeOf("object");
        for (const entity of frame.entities) expect(entity.type).toBe("node");
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
    });
}

function bruteForce(
    graph: Record<string, Array<[string, number]>>,
    seeds: string[],
    thresholds: Record<string, number>,
): string[] {
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat().map(([to]) => to)])];
    const active = new Set(seeds.filter((label) => labels.includes(label)));
    let changed = true;
    while (changed) {
        changed = false;
        const influence = new Map<string, number>();
        for (const [source, targets] of Object.entries(graph)) {
            if (!active.has(source)) continue;
            for (const [target, weight] of targets) influence.set(target, (influence.get(target) ?? 0) + weight);
        }
        for (const label of labels) {
            if (active.has(label)) continue;
            if ((influence.get(label) ?? 0) >= (thresholds[label] ?? 0.5) - 1e-12) {
                active.add(label);
                changed = true;
            }
        }
    }
    return [...active].sort();
}

type Input = {
    graph: Record<string, Array<[string, number]>>;
    active: string[];
    threshold: Record<string, number>;
};

describe("Linear Threshold Model", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = collect(mod.defaultInput);
        checkFrames(frames);
        expect(frames.length).toBeLessThan(100);
    });

    it("matches a brute-force fixed point on the default input", () => {
        const input = mod.defaultInput as Input;
        const frames = collect(input);
        checkFrames(frames);
        const last = frames[frames.length - 1] as VisualFrame;
        expect(last.meta.activeNodes).toEqual(bruteForce(input.graph, input.active, input.threshold));
    });

    it("matches brute force on random networks", () => {
        let seed = 776655;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 100; trial += 1) {
            const n = 2 + (next() % 6);
            const labels = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
            const graph: Record<string, Array<[string, number]>> = {};
            const threshold: Record<string, number> = {};
            for (const label of labels) {
                threshold[label] = Math.round((next() % 10) / 10) / 10;
                graph[label] = [];
                for (const target of labels) {
                    if (target === label) continue;
                    if (next() % 3 === 0) {
                        graph[label]?.push([target, Math.round((next() % 10) / 10) / 10]);
                    }
                }
            }
            const active = labels.filter(() => next() % 4 === 0);
            const input = { graph, active, threshold };
            const frames = collect(input);
            checkFrames(frames);
            const last = frames[frames.length - 1] as VisualFrame;
            expect(last.meta.activeNodes).toEqual(bruteForce(graph, active, threshold));
            for (const frame of frames) {
                const count = Number(frame.meta.activeCount);
                expect(count).toBeGreaterThanOrEqual(active.length);
                expect(count).toBeLessThanOrEqual(n);
            }
        }
    });
});
