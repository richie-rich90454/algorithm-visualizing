/** hough-transform.test.ts - Line recovery, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./hough-transform";

type Pt = [number, number];

function framesFor(input: unknown) {
    const gen = mod.run(input);
    const frames = [];
    for (let guard = 0; guard < 2000; guard += 1) {
        const result = gen.next();
        if (result.done) break;
        frames.push(result.value);
    }
    expect(frames.length).toBeLessThan(2000);
    return frames;
}

describe("Hough Transform", () => {
    it("recovers a horizontal line y = 3 from collinear feature points", () => {
        const points: Pt[] = [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [1, 0], [4, 7]];
        const frames = framesFor({ points });
        const final = frames[frames.length - 1]!;
        const theta = final.meta.peakTheta as number;
        const rho = final.meta.peakRho as number;
        expect(final.meta.peakVotes).toBe(6);
        expect(final.meta.featureCount).toBe(points.length);
        // Rounding rho into one-degree bins lets several nearby angles tie;
        // the recovered line must still pass through all six on-line points.
        expect(Math.abs(theta - 90)).toBeLessThanOrEqual(6);
        for (const [x, y] of points.slice(0, 6)) {
            const distance = Math.abs(x * Math.cos((theta * Math.PI) / 180) + y * Math.sin((theta * Math.PI) / 180) - rho);
            expect(distance).toBeLessThan(0.75);
        }
        // The two supported off-line points must not join the peak bin.
        const supported = final.entities.filter((e) => e.state === "sorted");
        expect(supported.length).toBe(6);
    });

    it("recovers a vertical line x = 5", () => {
        const points: Pt[] = [[5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5]];
        const frames = framesFor({ points });
        const final = frames[frames.length - 1]!;
        const theta = final.meta.peakTheta as number;
        const rho = final.meta.peakRho as number;
        expect(final.meta.peakVotes).toBe(6);
        expect(Math.min(theta, 180 - theta)).toBeLessThanOrEqual(6);
        for (const [x, y] of points) {
            const distance = Math.abs(x * Math.cos((theta * Math.PI) / 180) + y * Math.sin((theta * Math.PI) / 180) - rho);
            expect(distance).toBeLessThan(0.75);
        }
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
            expect(frame.entities.length).toBeGreaterThan(0);
            const ids = new Set(frame.entities.map((e) => e.id));
            for (const edge of frame.edges) {
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
            }
        });
    });

    it("handles an empty point set without producing a line", () => {
        const frames = framesFor({ points: [] });
        expect(frames.length).toBeGreaterThan(0);
        expect(frames[frames.length - 1]!.meta.peakVotes).toBe(0);
        expect(frames[frames.length - 1]!.edges.length).toBe(0);
    });
});
