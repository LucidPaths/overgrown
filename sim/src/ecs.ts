// Struct-of-arrays entity store. Deterministic: iteration order depends only on
// the sequence of operations, never on time or randomness.

/** u32: low 20 bits = slot index, high 12 bits = generation. */
export type EntityId = number;
export type ColumnType = "f32" | "f64" | "i32" | "u32" | "u16" | "u8";
export type Schema = Record<string, ColumnType>;

type ArrayFor<T extends ColumnType> = T extends "f32"
  ? Float32Array
  : T extends "f64"
    ? Float64Array
    : T extends "i32"
      ? Int32Array
      : T extends "u32"
        ? Uint32Array
        : T extends "u16"
          ? Uint16Array
          : Uint8Array;

/** For each key of S, the matching typed array; length = world capacity. Indexed by `World.indexOf(id)`. */
export type Store<S extends Schema> = { readonly [K in keyof S]: ArrayFor<S[K]> };

export interface Component<S extends Schema> {
  readonly id: number;
  readonly name: string;
  readonly store: Store<S>;
}

type Column = ArrayFor<ColumnType>;

const COLUMN_CTORS: Record<ColumnType, new (length: number) => Column> = {
  f32: Float32Array,
  f64: Float64Array,
  i32: Int32Array,
  u32: Uint32Array,
  u16: Uint16Array,
  u8: Uint8Array,
};

const INDEX_SPACE = 2 ** 20;
const GENERATION_SPACE = 2 ** 12;
const GENERATION_MASK = GENERATION_SPACE - 1;
const DEFAULT_CAPACITY = 16384;

interface ComponentSlot {
  readonly component: Component<Schema>;
  readonly has: Uint8Array;
  readonly columns: readonly Column[];
}

export class World {
  readonly capacity: number;

  private readonly generation: Uint16Array;
  private readonly dense: Uint32Array; // alive slot indices, in iteration order
  private readonly sparse: Uint32Array; // slot index -> position in dense
  private aliveCount = 0;
  private readonly freeStack: Uint32Array; // LIFO of destroyed slots
  private freeTop = 0;
  private nextUnused = 0; // slots >= this have never been issued
  private readonly components: ComponentSlot[] = [];
  private readonly names = new Set<string>();
  private iterating = 0; // depth of active each() calls; nested each() is allowed

  constructor(options?: { capacity?: number }) {
    const capacity = options?.capacity ?? DEFAULT_CAPACITY;
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > INDEX_SPACE) {
      throw new RangeError(`World capacity must be an integer in 1..${INDEX_SPACE}, got ${capacity}`);
    }
    this.capacity = capacity;
    this.generation = new Uint16Array(capacity);
    this.dense = new Uint32Array(capacity);
    this.sparse = new Uint32Array(capacity);
    this.freeStack = new Uint32Array(capacity);
  }

  get count(): number {
    return this.aliveCount;
  }

  create(): EntityId {
    this.assertNotIterating();
    let index: number;
    if (this.freeTop > 0) {
      this.freeTop -= 1;
      index = this.freeStack[this.freeTop]!;
    } else if (this.nextUnused < this.capacity) {
      index = this.nextUnused;
      this.nextUnused += 1;
    } else {
      throw new RangeError(
        `World is full (capacity ${this.capacity}): destroy entities or construct the World with a larger capacity`,
      );
    }
    this.dense[this.aliveCount] = index;
    this.sparse[index] = this.aliveCount;
    this.aliveCount += 1;
    return this.generation[index]! * INDEX_SPACE + index;
  }

  destroy(id: EntityId): void {
    this.assertNotIterating();
    const index = this.indexOf(id);
    for (const slot of this.components) slot.has[index] = 0;

    const pos = this.sparse[index]!;
    const last = this.aliveCount - 1;
    const moved = this.dense[last]!;
    this.dense[pos] = moved;
    this.sparse[moved] = pos;
    this.aliveCount = last;

    this.generation[index] = (this.generation[index]! + 1) & GENERATION_MASK;
    this.freeStack[this.freeTop] = index;
    this.freeTop += 1;
  }

  isAlive(id: EntityId): boolean {
    if (!Number.isInteger(id) || id < 0 || id >= INDEX_SPACE * GENERATION_SPACE) return false;
    const index = id % INDEX_SPACE;
    if (index >= this.capacity) return false;
    if (this.generation[index] !== Math.floor(id / INDEX_SPACE)) return false;
    const pos = this.sparse[index]!;
    return pos < this.aliveCount && this.dense[pos] === index;
  }

  indexOf(id: EntityId): number {
    if (!this.isAlive(id)) throw new Error(`Entity ${id} is not alive`);
    return id % INDEX_SPACE;
  }

  register<S extends Schema>(name: string, schema: S): Component<S> {
    if (this.names.has(name)) throw new Error(`Component "${name}" is already registered`);
    const store: Record<string, Column> = {};
    const columns: Column[] = [];
    for (const [key, type] of Object.entries(schema)) {
      const Ctor = COLUMN_CTORS[type];
      if (Ctor === undefined) throw new Error(`Component "${name}" column "${key}" has unknown type "${type}"`);
      const column = new Ctor(this.capacity);
      store[key] = column;
      columns.push(column);
    }
    const component: Component<S> = { id: this.components.length, name, store: store as Store<S> };
    this.components.push({ component, has: new Uint8Array(this.capacity), columns });
    this.names.add(name);
    return component;
  }

  add(id: EntityId, c: Component<Schema>): void {
    const index = this.indexOf(id);
    const slot = this.slotOf(c);
    slot.has[index] = 1;
    for (const column of slot.columns) column[index] = 0;
  }

  remove(id: EntityId, c: Component<Schema>): void {
    const index = this.indexOf(id);
    this.slotOf(c).has[index] = 0;
  }

  has(id: EntityId, c: Component<Schema>): boolean {
    const index = this.indexOf(id);
    return this.slotOf(c).has[index] === 1;
  }

  each(cs: readonly Component<Schema>[], fn: (id: EntityId, index: number) => void): void {
    const flags = cs.map((c) => this.slotOf(c).has);
    this.iterating += 1;
    try {
      for (let pos = 0; pos < this.aliveCount; pos++) {
        const index = this.dense[pos]!;
        if (flags.every((has) => has[index] === 1)) {
          fn(this.generation[index]! * INDEX_SPACE + index, index);
        }
      }
    } finally {
      this.iterating -= 1;
    }
  }

  private slotOf(c: Component<Schema>): ComponentSlot {
    const slot = this.components[c.id];
    if (slot === undefined || slot.component !== c) {
      throw new Error(`Component "${c.name}" is not registered in this World`);
    }
    return slot;
  }

  private assertNotIterating(): void {
    if (this.iterating > 0) throw new Error("structural change during each(): create() and destroy() are not allowed");
  }
}
