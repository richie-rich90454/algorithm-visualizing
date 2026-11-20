/** dynamic-window-approach.test.ts - Window-bound and safety properties, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./dynamic-window-approach";

type Pt = [number, number];
interface Disk {
    center: Pt;
    radius: number;
}

function framesFor(input: unknown) {
    const gen = mod.run(input);
    const frames = [];
    for (let guard = 0; guard < 300; guard += 1) {
        const result = gen.next();
        if (result.done) break;
        frames.push(result.value);
    }
    expect(frames.length).toBeLessThan(300);
    return frames;
}

function positionsFrom(final: ReturnType<typeof framesFor>[number]): Pt[] {
    const flat = final.meta.positions as number[];
    const positions: Pt[] = [];
    for (let i = 0; i < flat.length; i += 2) positions.push([flat[i]!, flat[i + 1]!]);
    return positions;
}

describe("Dynamic Window Approach", () => {
    it("respects acceleration limits and never collides", () => {
        const obstacles: Disk[] = [{ center: [5, 1.6], radius: 1 }];
        const frames = framesFor(mod.defaultInput);
        const final = frames[frames.length - 1]!;
        const positions = positionsFrom(final);
        const chosenV = final.meta.chosenV as number[];
        const chosenOmega = final.meta.chosenOmega as number[];
        const dt = final.meta.dt as number;
        const accel = final.meta.accel as number;
        const angularAccel = final.meta.angularAccel as number;
        const maxSpeed = final.meta.maxSpeed as number;
        const maxOmega = final.meta.maxOmega as number;

        expect(final.meta.reached).toBe(true);
        expect(chosenV.length).toBe(positions.length - 1);
        let prevV = 0;
        let prevOmega = 0;
        for (let i = 0; i < chosenV.length; i += 1) {
            const [vLow, vHigh] = [Math.max(0, prevV - accel * dt), Math.min(maxSpeed, prevV + accel * dt)];
            const [wLow, wHigh] = [Math.max(-maxOmega, prevOmega - angularAccel * dt), Math.min(maxOmega, prevOmega + angularAccel * dt)];
            expect(chosenV[i]!).toBeGreaterThanOrEqual(vLow - 1e-9);
            expect(chosenV[i]!).toBeLessThanOrEqual(vHigh + 1e-9);
            expect(chosenOmega[i]!).toBeGreaterThanOrEqual(wLow - 1e-9);
            expect(chosenOmega[i]!).toBeLessThanOrEqual(wHigh + 1e-9);
            prevV = chosenV[i]!;
            prevOmega = chosenOmega[i]!;
        }

        for (const p of positions) {
            for (const disk of obstacles) {
                expect(Math.hypot(p[0] - disk.center[0], p[1] - disk.center[1])).toBeGreaterThan(disk.radius - 1e-9);
            }
        }
        expect(final.meta.finalGoalDistance as number).toBeLessThan(final.meta.startGoalDistance as number);
        expect(positions[positions.length - 1]![0]).toBeGreaterThan(positions[0]![0]);
    });

    it("drives straight to the goal with no obstacles", () => {
        const frames = framesFor({
            start: [0, 0],
            goal: [5, 0],
            heading: 0,
            obstacles: [],
            robotRadius: 0.2,
            maxSpeed: 1,
            maxOmega: 1,
            accel: 0.3,
            angularAccel: 0.3,
            dt: 0.5,
            horizon: 6,
            samplesV: 4,
            samplesOmega: 7,
            maxSteps: 40,
        });
        const final = frames[frames.length - 1]!;
        const positions = positionsFrom(final);
        expect(final.meta.reached).toBe(true);
        expect(Math.abs(positions[positions.length - 1]![1])).toBeLessThan(1e-6);
        for (const p of positions) expect(Math.abs(p[1])).toBeLessThan(1e-6);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = framesFor(mod.defaultInput);
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(mod.pseudocode!.length);
            expect(frame.layout).toBe("point");
            const ids = new Set(frame.entities.map((e) => e.id));
            for (const entity of frame.entities) {
                expect(Number.isFinite(entity.x)).toBe(true);
                expect(Number.isFinite(entity.y)).toBe(true);
            }
            for (const edge of frame.edges) {
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
            }
        });
    });
});
