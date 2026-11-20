/** kabsch-alignment.test.ts - Ground-truth rotation recovery and rigidity properties. */

import { describe, expect, it } from "vitest";
import mod from "./kabsch-alignment";

type Vec3 = [number, number, number];

function framesFor(input: unknown) {
    const gen = mod.run(input);
    const frames = [];
    for (let guard = 0; guard < 200; guard += 1) {
        const result = gen.next();
        if (result.done) break;
        frames.push(result.value);
    }
    expect(frames.length).toBeLessThan(200);
    return frames;
}

/** Independent axis-angle rotation via the Rodrigues formula. */
function groundTruthRotation(): number[][] {
    const axis: Vec3 = [0.3, 0.6, 0.74];
    const len = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);
    const [ux, uy, uz] = [axis[0] / len, axis[1] / len, axis[2] / len];
    const c = Math.cos(0.7);
    const s = Math.sin(0.7);
    const t = 1 - c;
    return [
        [t * ux * ux + c, t * ux * uy - s * uz, t * ux * uz + s * uy],
        [t * ux * uy + s * uz, t * uy * uy + c, t * uy * uz - s * ux],
        [t * ux * uz - s * uy, t * uy * uz + s * ux, t * uz * uz + c],
    ];
}

function unpack(flat: number[]): Vec3[] {
    const out: Vec3[] = [];
    for (let i = 0; i < flat.length; i += 3) out.push([flat[i]!, flat[i + 1]!, flat[i + 2]!]);
    return out;
}

describe("Kabsch Alignment", () => {
    it("recovers a known rotation and translation", () => {
        const final = framesFor(mod.defaultInput).slice(-1)[0]!;
        const rot = final.meta.rotation as number[];
        const translation = final.meta.translation as number[];
        const expected = groundTruthRotation();
        for (let i = 0; i < 3; i += 1) {
            for (let j = 0; j < 3; j += 1) {
                expect(rot[i * 3 + j]!).toBeCloseTo(expected[i]![j]!, 8);
            }
        }
        expect(translation[0]!).toBeCloseTo(1.5, 8);
        expect(translation[1]!).toBeCloseTo(-0.8, 8);
        expect(translation[2]!).toBeCloseTo(0.4, 8);
        expect(final.meta.rmsd as number).toBeLessThan(1e-8);
    });

    it("overlays every source point on its partner with a proper rotation", () => {
        const final = framesFor(mod.defaultInput).slice(-1)[0]!;
        const target = unpack(final.meta.pointsQ as number[]);
        const aligned = unpack(final.meta.aligned as number[]);
        const rot = (final.meta.rotation as number[]).reduce<number[][]>((rows, value, i) => {
            const r = Math.floor(i / 3);
            if (!rows[r]) rows[r] = [0, 0, 0];
            rows[r]![i % 3] = value;
            return rows;
        }, []);
        const det =
            rot[0]![0]! * (rot[1]![1]! * rot[2]![2]! - rot[1]![2]! * rot[2]![1]!) -
            rot[0]![1]! * (rot[1]![0]! * rot[2]![2]! - rot[1]![2]! * rot[2]![0]!) +
            rot[0]![2]! * (rot[1]![0]! * rot[2]![1]! - rot[1]![1]! * rot[2]![0]!);
        expect(det).toBeCloseTo(1, 8);
        for (let i = 0; i < 3; i += 1) {
            for (let j = 0; j < 3; j += 1) {
                let dot = 0;
                for (let k = 0; k < 3; k += 1) dot += rot[i]![k]! * rot[j]![k]!;
                expect(dot).toBeCloseTo(i === j ? 1 : 0, 8);
            }
        }
        expect(aligned.length).toBe(target.length);
        for (let i = 0; i < aligned.length; i += 1) {
            expect(aligned[i]![0]).toBeCloseTo(target[i]![0]!, 8);
            expect(aligned[i]![1]).toBeCloseTo(target[i]![1]!, 8);
            expect(aligned[i]![2]).toBeCloseTo(target[i]![2]!, 8);
        }
    });

    it("returns the identity when both sets already match", () => {
        const points = [[0, 0, 0], [1, 2, 3], [3, 1, 2], [2, 3, 1], [4, 4, 4]] as Vec3[];
        const final = framesFor({ pointsP: points, pointsQ: points }).slice(-1)[0]!;
        const rot = final.meta.rotation as number[];
        const translation = final.meta.translation as number[];
        expect(rot[0]!).toBeCloseTo(1, 8);
        expect(rot[4]!).toBeCloseTo(1, 8);
        expect(rot[8]!).toBeCloseTo(1, 8);
        expect(translation[0]!).toBeCloseTo(0, 8);
        expect(translation[1]!).toBeCloseTo(0, 8);
        expect(translation[2]!).toBeCloseTo(0, 8);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = framesFor(mod.defaultInput);
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber!).toBeGreaterThanOrEqual(0);
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
