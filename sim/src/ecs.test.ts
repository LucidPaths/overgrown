import { describe, expect, it } from "vitest";
import { World, type EntityId } from "./ecs";

describe("World", () => {
  it("destroyed id is not alive, even after its slot is reused", () => {
    const world = new World({ capacity: 4 });
    const a = world.create();
    world.destroy(a);
    const b = world.create();

    expect(world.indexOf(b)).toBe(0); // b reuses a's slot
    expect(b).not.toBe(a);
    expect(world.isAlive(a)).toBe(false);
    expect(world.isAlive(b)).toBe(true);
    expect(() => world.indexOf(a)).toThrow(/not alive/);
  });

  it("a recycled slot reads zero for a newly added component", () => {
    const world = new World({ capacity: 4 });
    const pos = world.register("pos", { x: "f32", hp: "i32" });
    const a = world.create();
    world.add(a, pos);
    pos.store.x[world.indexOf(a)] = 3.5;
    pos.store.hp[world.indexOf(a)] = -7;
    world.destroy(a);

    const b = world.create();
    expect(world.has(b, pos)).toBe(false);
    world.add(b, pos);
    expect(pos.store.x[world.indexOf(b)]).toBe(0);
    expect(pos.store.hp[world.indexOf(b)]).toBe(0);
  });

  it("each() visits exactly the entities that have all requested components, in deterministic order", () => {
    const run = (): { visited: EntityId[]; expected: Set<EntityId> } => {
      const world = new World({ capacity: 64 });
      const a = world.register("a", { v: "u8" });
      const b = world.register("b", {});
      const ids: EntityId[] = [];
      for (let i = 0; i < 20; i++) ids.push(world.create());
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) world.add(ids[i]!, a);
        if (i % 3 === 0) world.add(ids[i]!, b);
      }
      // Destroys (swap-remove + LIFO reuse) and a removal reshuffle the dense order.
      for (const i of [0, 6, 7, 13]) world.destroy(ids[i]!);
      world.remove(ids[12]!, b);
      for (let i = 0; i < 3; i++) {
        const id = world.create();
        world.add(id, a);
        world.add(id, b);
        ids.push(id);
      }
      const expected = new Set(ids.filter((id) => world.isAlive(id) && world.has(id, a) && world.has(id, b)));
      const visited: EntityId[] = [];
      world.each([a, b], (id, index) => {
        expect(world.indexOf(id)).toBe(index);
        visited.push(id);
      });
      return { visited, expected };
    };

    const first = run();
    const second = run();
    expect(first.visited.length).toBe(first.expected.size);
    expect(new Set(first.visited)).toEqual(first.expected);
    expect(second.visited).toEqual(first.visited);
  });

  it("create() on a full world throws with the capacity in the message", () => {
    const world = new World({ capacity: 3 });
    for (let i = 0; i < 3; i++) world.create();
    expect(() => world.create()).toThrow(/World is full \(capacity 3\)/);
  });

  it("create() or destroy() inside each() throws", () => {
    const world = new World({ capacity: 4 });
    const tag = world.register("tag", {});
    const a = world.create();
    world.add(a, tag);

    expect(() => world.each([tag], () => world.create())).toThrow(/structural change during each\(\)/);
    expect(() => world.each([tag], (id) => world.destroy(id))).toThrow(/structural change during each\(\)/);
    expect(world.count).toBe(1);
    expect(world.isAlive(a)).toBe(true);
    world.destroy(a); // guard is released after a throwing callback
    expect(world.count).toBe(0);
  });
});
