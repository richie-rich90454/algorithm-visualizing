/** clarke-wright-savings.test.ts - Savings/capacity property check, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import clarkeWrightSavings from "./clarke-wright-savings";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? -1).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 999).toBeLessThan(clarkeWrightSavings.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("graph");
        expect(frame.meta).toBeTypeOf("object");
        frame.edges.forEach((edge) => {
            const ids = new Set(frame.entities.map((entity) => entity.id));
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        });
    });
}

function sumAll(generator: Generator<VisualFrame, void, unknown>): VisualFrame[] {
    const frames: VisualFrame[] = [];
    for (const frame of generator) {
        frames.push(frame);
        expect(frames.length).toBeLessThan(100000);
    }
    return frames;
}

describe("Clarke-Wright Savings", () => {
    it("computes correct savings and feasible routes", () => {
        const input = clarkeWrightSavings.defaultInput as {
            depot: [number, number];
            customers: Array<[number, number]>;
            demand: number[];
            capacity: number;
        };
        const frames = sumAll(clarkeWrightSavings.run(input));
        const final = frames[frames.length - 1];

        const toDepot = input.customers.map((point) => Math.hypot(point[0] - input.depot[0], point[1] - input.depot[1]));
        const expected: number[] = [];
        for (let i = 0; i < input.customers.length; i += 1) {
            for (let j = i + 1; j < input.customers.length; j += 1) {
                const between = Math.hypot(
                    input.customers[i]?.[0] - input.customers[j]?.[0],
                    input.customers[i]?.[1] - input.customers[j]?.[1],
                );
                expected.push(Math.round(((toDepot[i] ?? 0) + (toDepot[j] ?? 0) - between) * 1000) / 1000);
            }
        }
        expected.sort((a, b) => b - a);
        expect(final?.meta["savings"]).toEqual(expected);

        const routes = final?.meta["routes"] as string[];
        const visited = routes.flatMap((route) => route.split("-")).sort();
        const wanted = input.customers.map((_, index) => `C${index + 1}`).sort();
        expect(visited).toEqual(wanted);
        for (const route of routes) {
            const load = route
                .split("-")
                .reduce((sum, stop) => sum + (input.demand[Number(stop.slice(1)) - 1] ?? 0), 0);
            expect(load).toBeLessThanOrEqual(input.capacity);
        }
    });

    it("emits well-formed frames and terminates on the default input", () => {
        checkFrames(sumAll(clarkeWrightSavings.run(clarkeWrightSavings.defaultInput)));
        const generator = clarkeWrightSavings.run(clarkeWrightSavings.defaultInput);
        let count = 0;
        while (generator.next().done !== true) {
            count += 1;
            expect(count).toBeLessThan(100000);
        }
    });
});
