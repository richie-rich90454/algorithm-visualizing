/**
 * GraphLayout.ts – Force-directed layout (Fruchterman–Reingold).
 *
 * Graphs have no natural coordinate system, so we let physics decide where
 * every node sits. Each node repels every other node, while each edge acts as
 * a spring pulling its endpoints together. After a fixed number of simulated
 * iterations the graph settles into a readable, mostly non-overlapping
 * arrangement.
 *
 * Positions are preserved when they already exist (e.g. after a previous
 * layout pass) so the user's mental map of the graph is not reset every frame.
 */

import type { VisualFrame } from "@/types";

/** Number of simulation iterations to run per layout pass. */
const ITERATIONS = 100;

/** Margin (px) kept between any node center and the container edge. */
const MARGIN = 40;

/**
 * Lay out a graph using a short force-directed simulation.
 *
 * @param frame The frame with node and edge entities.
 * @param width Logical container width in pixels.
 * @param height Logical container height in pixels.
 * @returns The same frame, with node positions filled in.
 */
export function applyGraphLayout(frame: VisualFrame, width: number, height: number): VisualFrame {
    const entities = frame.entities.filter((e) => e.type === "node");
    const n = entities.length;
    if (n === 0) {
        return frame;
    }

    const nodeById = new Map(entities.map((e) => [e.id, e]));
    const edges = frame.edges;

    // Prefer existing positions (from a previous layout) over fresh ones.
    const needsInit = entities.some((e) => e.x === 0 && e.y === 0);
    if (needsInit) {
        // Seed on a circle so the forces converge quickly and symmetrically
        // instead of collapsing the graph into a corner.
        const radius = Math.min(width, height) * 0.32;
        const cx = width / 2;
        const cy = height / 2;
        for (let i = 0; i < n; i += 1) {
            const angle = (i / n) * Math.PI * 2;
            entities[i].x = cx + radius * Math.cos(angle);
            entities[i].y = cy + radius * Math.sin(angle);
        }
    }

    // The ideal distance between neighbours; all forces derive from it.
    const area = Math.max(1, width * height);
    const k = Math.sqrt(area / n);

    // Force cap (in k units) keeps a single large displacement from blowing up
    // the whole simulation, which the uncapped spring force used to do.
    const MAX_FORCE = k * 4;

    // Velocity accumulators for each node, applied after all forces.
    const disp = new Map<string, { x: number; y: number }>();
    for (const entity of entities) {
        disp.set(entity.id, { x: 0, y: 0 });
    }

    let temperature = k;

    for (let iter = 0; iter < ITERATIONS; iter += 1) {
        // --- Repulsion: every pair of nodes pushes apart (inverse-square). ---
        for (let i = 0; i < n; i += 1) {
            const a = entities[i];
            if (!a) {
                continue;
            }
            for (let j = i + 1; j < n; j += 1) {
                const b = entities[j];
                if (!b) {
                    continue;
                }
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.max(0.1, Math.hypot(dx, dy));

                const force = Math.min((k * k) / dist, MAX_FORCE);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                const da = disp.get(a.id);
                const db = disp.get(b.id);
                if (da) {
                    da.x += fx;
                    da.y += fy;
                }
                if (db) {
                    db.x -= fx;
                    db.y -= fy;
                }
            }
        }

        // --- Attraction: each edge pulls its endpoints together. ---
        for (const edge of edges) {
            const source = nodeById.get(edge.sourceId);
            const target = nodeById.get(edge.targetId);
            if (!source || !target) {
                continue;
            }
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dist = Math.max(0.1, Math.hypot(dx, dy));

            const force = Math.min((dist * dist) / k, MAX_FORCE);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            const ds = disp.get(source.id);
            const dt = disp.get(target.id);
            if (ds) {
                ds.x += fx;
                ds.y += fy;
            }
            if (dt) {
                dt.x -= fx;
                dt.y -= fy;
            }
        }

        // --- Apply displacements, clamped to the current temperature. ---
        for (const entity of entities) {
            const d = disp.get(entity.id);
            if (!d) {
                continue;
            }
            const mag = Math.max(0.1, Math.hypot(d.x, d.y));
            const step = Math.min(mag, temperature);
            entity.x += (d.x / mag) * step;
            entity.y += (d.y / mag) * step;

            // Keep nodes inside the container.
            entity.x = Math.min(Math.max(entity.x, MARGIN), width - MARGIN);
            entity.y = Math.min(Math.max(entity.y, MARGIN), height - MARGIN);

            // Zero out the accumulator for the next iteration.
            d.x = 0;
            d.y = 0;
        }

        // --- Cool down: later iterations make smaller moves. ---
        temperature = k * (1 - (iter + 1) / ITERATIONS);
    }

    return frame;
}
