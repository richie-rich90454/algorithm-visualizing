/**
 * GraphLayout.ts – Force-directed layout (Fruchterman–Reingold).
 *
 * Graphs have no natural coordinate system, so we let physics decide where
 * every node sits. Each node repels every other node, while each edge acts as
 * a spring pulling its endpoints together. After a fixed number of simulated
 * iterations the graph settles into a readable, mostly non-overlapping
 * arrangement.
 *
 * The plan (Section 8.4) requires a fixed 100-iteration run. Positions are
 * preserved when they already exist (e.g. after a previous layout pass) so the
 * user's mental map of the graph is not reset every frame.
 */

import type { VisualFrame } from "@/types";

/** Number of simulation iterations to run per layout pass. */
const ITERATIONS = 100;

/** Margin (px) kept between any node centre and the container edge. */
const MARGIN = 40;

/** Ideal distance between neighbours; the spring's rest length. */
const AREA_SCALE = 800;

/** Starting temperature; damping reduces it each iteration. */
const START_TEMP = 1;

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
    const nodeById = new Map(entities.map((e) => [e.id, e]));
    const edges = frame.edges;

    // Prefer existing positions (from a previous layout) over fresh ones.
    let needsInit = false;
    for (const entity of entities) {
        if (entity.x === 0 && entity.y === 0) {
            needsInit = true;
            break;
        }
    }

    if (needsInit) {
        // Seed each node at a deterministic random position inside the area.
        let seed = 42;
        const rand = () => {
            // Tiny deterministic PRNG so layouts are reproducible.
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
        for (const entity of entities) {
            entity.x = MARGIN + rand() * (width - 2 * MARGIN);
            entity.y = MARGIN + rand() * (height - 2 * MARGIN);
        }
    }

    // The ideal distance between connected nodes shrinks as density grows.
    const area = Math.max(1, width * height);
    const k = Math.sqrt(area / Math.max(1, entities.length * AREA_SCALE));

    // Velocity accumulators for each node, applied after all forces.
    const disp = new Map<string, { x: number; y: number }>();
    for (const entity of entities) {
        disp.set(entity.id, { x: 0, y: 0 });
    }

    let temperature = START_TEMP;
    const clampedSize = Math.min(width, height);

    for (let iter = 0; iter < ITERATIONS; iter += 1) {
        // --- Repulsion: every pair of nodes pushes apart (inverse-square). ---
        for (let i = 0; i < entities.length; i += 1) {
            const a = entities[i];
            if (!a) {
                continue;
            }
            for (let j = i + 1; j < entities.length; j += 1) {
                const b = entities[j];
                if (!b) {
                    continue;
                }
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.max(0.1, Math.hypot(dx, dy));

                // Force grows as distance shrinks (capped to avoid blow-ups).
                const force = Math.min(1000, (k * k) / dist);
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

            // Spring force is proportional to the squared deviation.
            const force = (dist * dist) / k;
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

        // --- Apply displacements, clamped to a maximum step and container. ---
        for (const entity of entities) {
            const d = disp.get(entity.id);
            if (!d) {
                continue;
            }
            const mag = Math.max(0.1, Math.hypot(d.x, d.y));
            const step = Math.min(mag, temperature * clampedSize);
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
        temperature = START_TEMP - (iter / ITERATIONS) * START_TEMP;

        // This loop dances the foxtrot: two steps forward for every cool-down back.
    }

    return frame;
}
