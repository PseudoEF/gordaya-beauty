import { DatabaseSync } from "node:sqlite";

// Минимальный слой доступа к данным поверх встроенного в Node node:sqlite.
// Заменяет Prisma: её нативный движок собран под glibc и не грузится на
// Android/Bionic, а node:sqlite работает нативно без нативных зависимостей.
// API намеренно повторяет подмножество Prisma, чтобы вызывающий код не менялся.
//
// Хранение полностью совместимо с тем, что писала Prisma:
//   DateTime -> INTEGER (миллисекунды эпохи)
//   Boolean  -> INTEGER (0/1)

type Scalar = string | number | boolean | Date | null;

// Типы строк повторяют колонки таблиц. Поля-связи объявлены всегда, чтобы
// существующий код продолжал типизироваться без изменений; фактически они
// заполняются только при передаче `include`.
export type PriceItemRow = {
  id: string;
  serviceId: string;
  labelUa: string;
  labelRu: string;
  amount: number;
  isSurcharge: boolean;
  sortOrder: number;
  createdAt: Date;
  service: ServiceRow | null;
};

export type ServiceRow = {
  id: string;
  slug: string;
  nameUa: string;
  nameRu: string;
  descriptionUa: string | null;
  descriptionRu: string | null;
  durationMin: number;
  priceFrom: number | null;
  noteUa: string | null;
  noteRu: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  priceItems: PriceItemRow[];
  bookings: BookingRow[];
};

export type SlotRow = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  createdAt: Date;
  booking: BookingRow | null;
};

export type BookingRow = {
  id: string;
  slotId: string;
  serviceId: string;
  clientName: string;
  phone: string;
  telegram: string | null;
  instagram: string | null;
  comment: string | null;
  status: string;
  createdAt: Date;
  slot: SlotRow | null;
  service: ServiceRow | null;
};

interface ModelDef {
  table: string;
  /** Колонка первичного ключа: у большинства моделей id, у AppSetting — key. */
  primaryKey: string;
  columns: readonly string[];
  dates: readonly string[];
  booleans: readonly string[];
  defaults: Readonly<Record<string, () => Scalar>>;
}

const MODELS = {
  service: {
    table: "Service",
    primaryKey: "id",
    columns: ["id", "slug", "nameUa", "nameRu", "descriptionUa", "descriptionRu",
      "durationMin", "priceFrom", "noteUa", "noteRu", "active", "sortOrder", "createdAt"],
    dates: ["createdAt"],
    booleans: ["active"],
    defaults: {
      durationMin: () => 180, active: () => 1,
      sortOrder: () => 0, createdAt: () => Date.now(),
    },
  },
  priceItem: {
    table: "PriceItem",
    primaryKey: "id",
    columns: ["id", "serviceId", "labelUa", "labelRu", "amount", "isSurcharge",
      "sortOrder", "createdAt"],
    dates: ["createdAt"],
    booleans: ["isSurcharge"],
    defaults: { amount: () => 0, isSurcharge: () => 0, sortOrder: () => 0, createdAt: () => Date.now() },
  },
  slot: {
    table: "Slot",
    primaryKey: "id",
    columns: ["id", "startsAt", "endsAt", "status", "createdAt"],
    dates: ["startsAt", "endsAt", "createdAt"],
    booleans: [],
    defaults: { status: () => "AVAILABLE", createdAt: () => Date.now() },
  },
  booking: {
    table: "Booking",
    primaryKey: "id",
    columns: ["id", "slotId", "serviceId", "clientName", "phone", "telegram",
      "instagram", "comment", "status", "createdAt"],
    dates: ["createdAt"],
    booleans: [],
    defaults: { status: () => "CONFIRMED", createdAt: () => Date.now() },
  },
  appSetting: {
    table: "AppSetting",
    primaryKey: "key",
    columns: ["key", "value"],
    dates: [],
    booleans: [],
    defaults: {},
  },
} as const satisfies Record<string, ModelDef>;

type ModelName = keyof typeof MODELS;

interface RelationDef {
  model: ModelName;
  /** поле в текущей модели */
  from: string;
  /** поле в связанной модели */
  to: string;
  many: boolean;
}

const RELATIONS: Readonly<Record<string, RelationDef>> = {
  // Service
  priceItems: { model: "priceItem", from: "id", to: "serviceId", many: true },
  bookings: { model: "booking", from: "id", to: "serviceId", many: true },
  // Slot → единственная запись, оставшаяся на это окно
  booking: { model: "booking", from: "id", to: "slotId", many: false },
  // PriceItem и Booking → своя услуга (связь у них одинаковая)
  service: { model: "service", from: "serviceId", to: "id", many: false },
  // Booking → своё окно
  slot: { model: "slot", from: "slotId", to: "id", many: false },
};

// ---------- идентификаторы в стиле cuid ----------

let counter = Math.floor(Math.random() * 36 ** 6);

function cuid(): string {
  const ts = Date.now().toString(36);
  counter = (counter + 1) % 36 ** 6;
  const seq = counter.toString(36).padStart(6, "0");
  const rand = Array.from({ length: 10 }, () =>
    Math.floor(Math.random() * 36).toString(36)
  ).join("");
  return `c${ts}${seq}${rand}`;
}

// ---------- соединение ----------

function resolvePath(): string {
  const raw = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const path = raw.replace(/^file:/, "");
  return path.startsWith("/") || path.startsWith("./") || path.startsWith("../")
    ? path
    : `./${path}`;
}

let dbInstance: DatabaseSync | null = null;

function openDatabase(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const instance = new DatabaseSync(resolvePath());
  instance.exec("PRAGMA journal_mode = WAL;");
  instance.exec("PRAGMA foreign_keys = ON;");
  instance.exec("PRAGMA busy_timeout = 5000;");
  instance.exec(`CREATE TABLE IF NOT EXISTS "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
  );`);

  dbInstance = instance;
  return instance;
}

const db = new Proxy({} as DatabaseSync, {
  get(_target, property) {
    const instance = openDatabase();
    const value = Reflect.get(instance, property);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

// ---------- преобразование значений ----------

function toColumn(value: Scalar): string | number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

function fromRow(def: ModelDef, row: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!row) return null;
  const out: Record<string, unknown> = { ...row };
  for (const c of def.dates) {
    if (out[c] !== null && out[c] !== undefined) out[c] = new Date(Number(out[c]));
  }
  for (const c of def.booleans) {
    if (out[c] !== null && out[c] !== undefined) out[c] = Boolean(out[c]);
  }
  return out;
}

// ---------- построение запросов ----------

function buildWhere(def: ModelDef, where?: Where): { sql: string; params: unknown[] } {
  if (!where) return { sql: "", params: [] };
  const clauses: string[] = [];
  const params: unknown[] = [];

  for (const [rawKey, rawValue] of Object.entries(where)) {
    if (rawValue === undefined) continue;
    // Имена колонок проверяем по белому списку — в SQL подставляются только они.
    if (!def.columns.includes(rawKey)) {
      throw new Error(`Неизвестное поле "${rawKey}" у модели ${def.table}`);
    }
    const col = `"${rawKey}"`;

    if (rawValue !== null && typeof rawValue === "object" && !(rawValue instanceof Date)) {
      for (const [op, operand] of Object.entries(rawValue as Record<string, unknown>)) {
        if (operand === undefined) continue;
        switch (op) {
          case "gt": clauses.push(`${col} > ?`); params.push(toColumn(operand as Scalar)); break;
          case "gte": clauses.push(`${col} >= ?`); params.push(toColumn(operand as Scalar)); break;
          case "lt": clauses.push(`${col} < ?`); params.push(toColumn(operand as Scalar)); break;
          case "lte": clauses.push(`${col} <= ?`); params.push(toColumn(operand as Scalar)); break;
          case "not": clauses.push(`${col} IS NOT ?`); params.push(toColumn(operand as Scalar)); break;
          case "in":
            clauses.push(`${col} IN (${(operand as unknown[]).map(() => "?").join(", ")})`);
            params.push(...(operand as unknown[]).map((v) => toColumn(v as Scalar)));
            break;
          case "notIn":
            clauses.push(`${col} NOT IN (${(operand as unknown[]).map(() => "?").join(", ")})`);
            params.push(...(operand as unknown[]).map((v) => toColumn(v as Scalar)));
            break;
          case "contains":
            clauses.push(`${col} LIKE ?`); params.push(`%${operand}%`); break;
          case "startsWith":
            clauses.push(`${col} LIKE ?`); params.push(`${operand}%`); break;
          case "endsWith":
            clauses.push(`${col} LIKE ?`); params.push(`%${operand}`); break;
          default:
            throw new Error(`Неподдерживаемый оператор "${op}"`);
        }
      }
      continue;
    }

    if (rawValue === null) { clauses.push(`${col} IS NULL`); continue; }
    clauses.push(`${col} = ?`);
    params.push(toColumn(rawValue as Scalar));
  }

  return { sql: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "", params };
}

function buildOrderBy(def: ModelDef, orderBy?: Record<string, unknown> | Record<string, unknown>[]): string {
  if (!orderBy) return "";
  const list = Array.isArray(orderBy) ? orderBy : [orderBy];
  const parts: string[] = [];
  for (const entry of list) {
    for (const [field, direction] of Object.entries(entry)) {
      if (!def.columns.includes(field)) {
        throw new Error(`Неизвестное поле сортировки "${field}" у модели ${def.table}`);
      }
      parts.push(`"${field}" ${String(direction).toLowerCase() === "desc" ? "DESC" : "ASC"}`);
    }
  }
  return parts.length ? ` ORDER BY ${parts.join(", ")}` : "";
}

function buildSelect(def: ModelDef, select?: Record<string, unknown>): { sql: string; keys: string[] } {
  if (!select) return { sql: def.columns.map((c) => `"${c}"`).join(", "), keys: [...def.columns] };
  const keys = Object.entries(select)
    .filter(([, v]) => Boolean(v))
    .map(([k]) => k);
  for (const k of keys) {
    if (!def.columns.includes(k)) {
      throw new Error(`Неизвестное поле выборки "${k}" у модели ${def.table}`);
    }
  }
  if (!keys.length) return { sql: `"id"`, keys: ["id"] };
  return { sql: keys.map((k) => `"${k}"`).join(", "), keys };
}

function resolveData(def: ModelDef, data: Record<string, Scalar>, isCreate: boolean): {
  cols: string[]; vals: (string | number | null)[]; missing: string[];
} {
  const cols: string[] = [];
  const vals: (string | number | null)[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (!def.columns.includes(key)) {
      throw new Error(`Неизвестное поле "${key}" у модели ${def.table}`);
    }
    cols.push(key);
    // Приводим к тому, что SQLite умеет хранить: Date → мс, boolean → 0/1.
    vals.push(toColumn(value));
  }

  if (isCreate) {
    // Идентификатор ставим только моделям, у которых колонка id есть
    // (у AppSetting первичный ключ — key).
    if (def.columns.includes("id") && !cols.includes("id")) {
      cols.push("id");
      vals.push(cuid());
    }
    for (const [field, make] of Object.entries(def.defaults)) {
      if (!cols.includes(field)) { cols.push(field); vals.push(toColumn(make())); }
    }
  }

  const missing = def.columns.filter(
    (c) => !cols.includes(c) && !(def.defaults as Record<string, () => Scalar>)[c] && !isCreate
  );
  return { cols, vals, missing };
}

// ---------- модель ----------

type Where = Record<string, unknown>;

type OrderBy = Record<string, unknown> | Record<string, unknown>[];

type IncludeArg =
  | boolean
  | { orderBy?: OrderBy; include?: Record<string, IncludeArg> };

interface FindArgs {
  where?: Where;
  orderBy?: OrderBy;
  select?: Record<string, unknown>;
  include?: Record<string, IncludeArg>;
}

class Model<TRow> {
  constructor(private readonly name: ModelName, private readonly tx?: boolean) {}

  private get def(): ModelDef {
    return MODELS[this.name] as ModelDef;
  }

  private stmt(sql: string) {
    return db.prepare(sql) as unknown as {
      all: (...p: unknown[]) => unknown[];
      get: (...p: unknown[]) => unknown;
      run: (...p: unknown[]) => unknown;
    };
  }

  async findMany(args: FindArgs = {}): Promise<TRow[]> {
    const def = this.def;
    const w = buildWhere(def, args.where);
    const o = buildOrderBy(def, args.orderBy);
    const s = buildSelect(def, args.select);
    const rows = this.stmt(
      `SELECT ${s.sql} FROM "${def.table}"${w.sql}${o}`
    ).all(...w.params) as Record<string, unknown>[];
    // Приводим типы обратно: DATETIME-колонки → Date, булевы → boolean.
    const typed = rows.map((row) => fromRow(def, row) as Record<string, unknown>);
    return (await this.attach(typed, def, s.keys, args.include)) as unknown as TRow[];
  }

  async findFirst(args: FindArgs = {}): Promise<TRow | null> {
    const rows = await this.findMany(args);
    return rows[0] ?? null;
  }

  async findUnique(args: { where: Where }): Promise<TRow | null> {
    const rows = await this.findMany({ where: args.where });
    return rows[0] ?? null;
  }

  async findUniqueOrThrow(args: { where: Where }): Promise<TRow> {
    const row = await this.findUnique(args);
    if (!row) throw new Error(`${this.name} не найден`);
    return row;
  }

  async create(args: { data: Partial<TRow> }): Promise<TRow> {
    const def = this.def;
    const { cols, vals } = resolveData(def, args.data as Record<string, Scalar>, true);
    const placeholders = cols.map(() => "?").join(", ");
    const sql = `INSERT INTO "${def.table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`;
    if (this.tx) {
      this.stmt(sql).run(...vals);
    } else {
      db.exec("BEGIN IMMEDIATE");
      try {
        this.stmt(sql).run(...vals);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    }
    const pk = def.primaryKey;
    const where: Where = { [pk]: vals[cols.indexOf(pk)] };
    const row = await this.findUnique({ where });
    if (!row) throw new Error("Не удалось прочитать только что созданную запись");
    return row;
  }

  async createMany(args: { data: Record<string, Scalar>[] }): Promise<{ count: number }> {
    const def = this.def;
    if (!args.data.length) return { count: 0 };
    if (!this.tx) db.exec("BEGIN IMMEDIATE");
    try {
      for (const item of args.data) {
        const { cols, vals } = resolveData(def, item, true);
        const placeholders = cols.map(() => "?").join(", ");
        this.stmt(
          `INSERT INTO "${def.table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`
        ).run(...vals);
      }
      if (!this.tx) db.exec("COMMIT");
      return { count: args.data.length };
    } catch (e) {
      if (!this.tx) db.exec("ROLLBACK");
      throw e;
    }
  }

  async update(args: { where: Where; data: Partial<TRow> }): Promise<TRow> {
    const def = this.def;
    const { cols, vals } = resolveData(def, args.data as Record<string, Scalar>, false);
    if (!cols.length) {
      const unchanged = await this.findUnique({ where: args.where });
      if (!unchanged) throw new Error(`${this.name} не найден`);
      return unchanged;
    }
    const sets = cols.map((c) => `"${c}" = ?`).join(", ");
    const w = buildWhere(def, args.where);
    this.stmt(`UPDATE "${def.table}" SET ${sets}${w.sql}`).run(...vals, ...w.params);
    const row = await this.findUnique({ where: args.where });
    if (!row) throw new Error(`${this.name} не найден при обновлении`);
    return row;
  }

  async delete(args: { where: Where }): Promise<TRow> {
    const def = this.def;
    const w = buildWhere(def, args.where);
    const row = await this.findUnique({ where: args.where });
    if (!row) throw new Error(`${this.name} не найден при удалении`);
    this.stmt(`DELETE FROM "${def.table}"${w.sql}`).run(...w.params);
    return row;
  }

  /** Upsert: обновляет, если запись есть, иначе создаёт. */
  async upsert(args: {
    where: Where;
    create: Partial<TRow>;
    update?: Partial<TRow>;
  }): Promise<TRow> {
    const existing = await this.findUnique({ where: args.where });
    if (!existing) return this.create({ data: args.create });
    const data = args.update ?? {};
    const keys = Object.keys(data).filter((k) => (data as Record<string, unknown>)[k] !== undefined);
    if (!keys.length) return existing;
    return this.update({ where: args.where, data });
  }

  // Подтягиваем связи из include.
  private async attach(
    rows: Record<string, unknown>[],
    def: ModelDef,
    keys: string[],
    include?: Record<string, IncludeArg>
  ): Promise<Record<string, unknown>[]> {
    if (!include || !rows.length) return rows;
    const wanted = Object.entries(include).filter(([, v]) => Boolean(v));
    if (!wanted.length) return rows;

    const pk = "id";
    if (!keys.includes(pk)) {
      // Без id в выборке связи не подтянуть — расширяем на минимальный набор.
      const extra = wanted
        .map(([rel]) => (RELATIONS[rel] ? def.columns.find((c) => c === pk) : null))
        .filter(Boolean) as string[];
      for (const c of new Set(extra)) if (!keys.includes(c)) keys.push(c);
      return this.attach(await this.findMany({
        where: { id: { in: rows.map((r) => String(r[pk])) } },
        select: Object.fromEntries(keys.map((k) => [k, true])),
        include,
      }) as unknown as Record<string, unknown>[], def, keys, undefined);
    }

    for (const [relName, relArgs] of wanted) {
      const rel = RELATIONS[relName];
      if (!rel) throw new Error(`Неизвестная связь "${relName}" у модели ${def.table}`);
      const localField = def.columns.includes(rel.from) ? rel.from : pk;
      const foreignValues = [...new Set(rows.map((r) => String(r[localField])).filter((v) => v && v !== "null"))];

      const related = new Model<unknown>(rel.model, this.tx);
      const opts = (typeof relArgs === "object" && relArgs ? relArgs : {}) as {
        orderBy?: OrderBy; include?: Record<string, IncludeArg>;
      };
      const found = await related.findMany({
        where: { [rel.to]: { in: foreignValues } },
        orderBy: opts.orderBy,
        // Вложенные связи подтягиваем рекурсивно: booking: { include: { service: true } }
        include: opts.include,
      });

      const grouped = new Map<string, Record<string, unknown>[]>();
      for (const item of found as Record<string, unknown>[]) {
        const key = String(item[rel.to]);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(item);
      }

      for (const row of rows) {
        const key = String(row[localField]);
        row[relName] = rel.many ? (grouped.get(key) ?? []) : (grouped.get(key)?.[0] ?? null);
      }
    }
    return rows;
  }
}

// ---------- публичный объект ----------

export class Db {
  constructor(private readonly inTx = false) {}
  readonly service = new Model<ServiceRow>("service", this.inTx);
  readonly priceItem = new Model<PriceItemRow>("priceItem", this.inTx);
  readonly slot = new Model<SlotRow>("slot", this.inTx);
  readonly booking = new Model<BookingRow>("booking", this.inTx);
  readonly appSetting = new Model<{ key: string; value: string }>("appSetting", this.inTx);

  /** Соединение синхронное и закрывать его незачем, но оставляем метод
   *  для совместимости с прежними вызовами вида prisma.$disconnect(). */
  async $disconnect(): Promise<void> {}

  /** Транзакция наподобие prisma.$transaction: всё внутри применяется или откатывается целиком. */
  async $transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    db.exec("BEGIN IMMEDIATE");
    const tx = new Db(true);
    try {
      const result = await fn(tx);
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

export const prisma = new Db();