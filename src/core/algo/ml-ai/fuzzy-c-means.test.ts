/** fuzzy-c-means.test.ts - Membership constraints, center recomputation, objective descent, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./fuzzy-c-means";
import type { VisualFrame } from "@/types";

interface Input {
    points: [number, number][];
    clusters: number;
    fuzzifier: number;
    iterations: number;
}

function checkFrames(frames: VisualFrame[], n: number, c: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(n + c);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["n"]).toBe(n);
        expect(frame.meta["c"]).toBe(c);
    });
}

describe("Fuzzy C-means", () => {
    const input = mod.defaultInput as Input;

    it("keeps every membership row a valid probability vector and lowers the objective", () => {
        const frames = [...mod.run(input)];
        expect(frames.length).toBe(input.iterations + 2);
        checkFrames(frames, input.points.length, input.clusters);
        const c = input.clusters;
        for (const frame of frames) {
            const u = frame.meta["memberships"] as number[];
            for (let i = 0; i < input.points.length; i += 1) {
                let rowSum = 0;
                for (let j = 0; j < c; j += 1) {
                    const value = u[i * c + j]!;
                    expect(value).toBeGreaterThanOrEqual(-1e-12);
                    rowSum += value;
                }
                expect(rowSum).toBeCloseTo(1, 10);
            }
        }
        const objectives = frames.map((f) => Number(f.meta["objective"]));
        for (let i = 1; i < objectives.length; i += 1) {
            expect(objectives[i]!).toBeLessThanOrEqual(objectives[i - 1]! + 1e-9);
        }
    });

    it("recomputes the final centers exactly from the reported memberships", () => {
        const final = [...mod.run(input)].at(-1)!;
        const m = Number(final.meta["m"]);
        const c = input.clusters;
        const u = final.meta["memberships"] as number[];
        const centers = final.meta["centers"] as number[];
        for (let j = 0; j < c; j += 1) {
            let wx = 0;
            let wy = 0;
            let weight = 0;
            for (let i = 0; i < input.points.length; i += 1) {
                const w = Math.pow(u[i * c + j]!, m);
                wx += w * input.points[i]![0];
                wy += w * input.points[i]![1];
                weight += w;
            }
            expect(centers[j * 2]!).toBeCloseTo(wx / weight, 9);
            expect(centers[j * 2 + 1]!).toBeCloseTo(wy / weight, 9);
        }
    });

    it("assigns each point to the nearest center by dominant membership", () => {
        const final = [...mod.run(input)].at(-1)!;
        const c = input.clusters;
        const u = final.meta["memberships"] as number[];
        const centers = final.meta["centers"] as number[];
        for (let i = 0; i < input.points.length; i += 1) {
            let bestMembership = -1;
            let bestCluster = 0;
            for (let j = 0; j < c; j += 1) {
                if (u[i * c + j]! > bestMembership) {
                    bestMembership = u[i * c + j]!;
                    bestCluster = j;
                }
            }
            let nearest = 0;
            let nearestDist = Infinity;
            for (let j = 0; j < c; j += 1) {
                const d = Math.hypot(
                    input.points[i]![0] - centers[j * 2]!,
                    input.points[i]![1] - centers[j * 2 + 1]!,
                );
                if (d < nearestDist) {
                    nearestDist = d;
                    nearest = j;
                }
            }
            expect(bestCluster).toBe(nearest);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(input.iterations + 2);
        expect(generator.next().done).toBe(true);
    });
});
