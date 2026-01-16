/**
 * @flareone/d1 - D1 Database Integration
 * Type-safe query builder and ORM for Cloudflare D1
 */

import {
    Injectable,
    Module,
    createToken,
    type Type,
    type DynamicModule,
    type InjectionToken,
} from '@flareone/core';

export interface D1ModuleOptions {
    binding: string;
    logging?: boolean;
    logger?: (query: string, params: unknown[], duration: number) => void;
}

export interface D1ModuleAsyncOptions {
    imports?: Array<Type | DynamicModule>;
    useFactory: (...args: unknown[]) => D1ModuleOptions | Promise<D1ModuleOptions>;
    inject?: InjectionToken[];
}

export interface D1QueryResult<T = Record<string, unknown>> {
    results: T[];
    success: boolean;
    meta: {
        duration: number;
        changes: number;
        last_row_id: number;
        served_by?: string;
    };
}

export interface D1SingleResult<T = Record<string, unknown>> {
    result: T | null;
    success: boolean;
    meta: {
        duration: number;
    };
}

export interface ColumnDefinition {
    name: string;
    type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB' | 'NULL';
    primaryKey?: boolean;
    autoIncrement?: boolean;
    notNull?: boolean;
    unique?: boolean;
    default?: string | number | null;
    references?: {
        table: string;
        column: string;
        onDelete?: 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';
        onUpdate?: 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';
    };
}

export type OrderDirection = 'ASC' | 'DESC';

export type WhereOperator = '=' | '!=' | '<' | '>' | '<=' | '>=' | 'LIKE' | 'IN' | 'NOT IN' | 'IS NULL' | 'IS NOT NULL' | 'BETWEEN';

export interface WhereCondition {
    column: string;
    operator: WhereOperator;
    value?: unknown;
    values?: unknown[];
}

export const D1_OPTIONS = createToken<D1ModuleOptions>('D1_OPTIONS');
export const D1_DATABASE = createToken<D1Database>('D1_DATABASE');

/**
 * High-level D1 service with query building and type safety
 */
@Injectable()
export class D1Service {
    private database: D1Database | null = null;
    private options: D1ModuleOptions | null = null;

    /**
     * Initialize with D1 database and options
     */
    initialize(database: D1Database, options: D1ModuleOptions): void {
        this.database = database;
        this.options = options;
    }

    /**
     * Get the underlying D1 database
     */
    getDatabase(): D1Database {
        if (!this.database) {
            throw new Error('D1 database not initialized. Make sure D1Module is properly configured.');
        }
        return this.database;
    }

    /**
     * Log a query if logging is enabled
     */
    private log(sql: string, params: unknown[], duration: number): void {
        if (this.options?.logging) {
            if (this.options.logger) {
                this.options.logger(sql, params, duration);
            } else {
                console.log(`[D1] ${sql} | params: ${JSON.stringify(params)} | ${duration}ms`);
            }
        }
    }

    /**
     * Execute a raw SQL query
     */
    async query<T = Record<string, unknown>>(
        sql: string,
        params: unknown[] = []
    ): Promise<D1QueryResult<T>> {
        const db = this.getDatabase();
        const start = Date.now();

        const stmt = db.prepare(sql);
        const bound = params.length > 0 ? stmt.bind(...params) : stmt;
        const result = await bound.all<T>();

        const duration = Date.now() - start;
        this.log(sql, params, duration);

        return {
            results: result.results ?? [],
            success: result.success,
            meta: {
                duration,
                changes: result.meta?.changes ?? 0,
                last_row_id: result.meta?.last_row_id ?? 0,
                served_by: typeof result.meta?.['served_by'] === 'string' ? result.meta['served_by'] : undefined,
            },
        };
    }

    /**
     * Execute a query and return a single result
     */
    async queryOne<T = Record<string, unknown>>(
        sql: string,
        params: unknown[] = []
    ): Promise<T | null> {
        const db = this.getDatabase();
        const start = Date.now();

        const stmt = db.prepare(sql);
        const bound = params.length > 0 ? stmt.bind(...params) : stmt;
        const result = await bound.first<T>();

        const duration = Date.now() - start;
        this.log(sql, params, duration);

        return result;
    }

    /**
     * Execute a query that doesn't return results (INSERT, UPDATE, DELETE)
     */
    async execute(sql: string, params: unknown[] = []): Promise<D1Result> {
        const db = this.getDatabase();
        const start = Date.now();

        const stmt = db.prepare(sql);
        const bound = params.length > 0 ? stmt.bind(...params) : stmt;
        const result = await bound.run();

        const duration = Date.now() - start;
        this.log(sql, params, duration);

        return result;
    }

    /**
     * Execute multiple statements in a batch
     */
    async batch(
        statements: Array<{ sql: string; params?: unknown[] }>
    ): Promise<D1Result[]> {
        const db = this.getDatabase();
        const start = Date.now();

        const prepared = statements.map(({ sql, params }) => {
            const stmt = db.prepare(sql);
            return params?.length ? stmt.bind(...params) : stmt;
        });

        const results = await db.batch(prepared);

        const duration = Date.now() - start;
        this.log(`BATCH (${statements.length} statements)`, [], duration);

        return results;
    }

    /**
     * Select records from a table
     */
    async select<T = Record<string, unknown>>(
        table: string,
        options: {
            columns?: string[];
            where?: WhereCondition[];
            orderBy?: Array<{ column: string; direction?: OrderDirection }>;
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<T[]> {
        const { sql, params } = this.buildSelect(table, options);
        const result = await this.query<T>(sql, params);
        return result.results;
    }

    /**
     * Select a single record
     */
    async selectOne<T = Record<string, unknown>>(
        table: string,
        where: WhereCondition[]
    ): Promise<T | null> {
        const { sql, params } = this.buildSelect(table, { where, limit: 1 });
        return this.queryOne<T>(sql, params);
    }

    /**
     * Find a record by ID
     */
    async findById<T = Record<string, unknown>>(
        table: string,
        id: number | string,
        idColumn: string = 'id'
    ): Promise<T | null> {
        return this.selectOne<T>(table, [
            { column: idColumn, operator: '=', value: id },
        ]);
    }

    /**
     * Insert a record
     */
    async insert<T extends Record<string, unknown>>(
        table: string,
        data: T
    ): Promise<D1Result> {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map(() => '?').join(', ');

        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
        return this.execute(sql, values);
    }

    /**
     * Insert multiple records
     */
    async insertMany<T extends Record<string, unknown>>(
        table: string,
        records: T[]
    ): Promise<D1Result[]> {
        if (records.length === 0) return [];

        const statements = records.map((data) => {
            const columns = Object.keys(data);
            const values = Object.values(data);
            const placeholders = columns.map(() => '?').join(', ');
            const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
            return { sql, params: values };
        });

        return this.batch(statements);
    }

    /**
     * Update records
     */
    async update<T extends Record<string, unknown>>(
        table: string,
        data: Partial<T>,
        where: WhereCondition[]
    ): Promise<D1Result> {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const setClause = columns.map((col) => `${col} = ?`).join(', ');

        const { whereClause, whereParams } = this.buildWhereClause(where);
        const sql = `UPDATE ${table} SET ${setClause}${whereClause}`;

        return this.execute(sql, [...values, ...whereParams]);
    }

    /**
     * Update a record by ID
     */
    async updateById<T extends Record<string, unknown>>(
        table: string,
        id: number | string,
        data: Partial<T>,
        idColumn: string = 'id'
    ): Promise<D1Result> {
        return this.update(table, data, [
            { column: idColumn, operator: '=', value: id },
        ]);
    }

    /**
     * Delete records
     */
    async delete(table: string, where: WhereCondition[]): Promise<D1Result> {
        const { whereClause, whereParams } = this.buildWhereClause(where);
        const sql = `DELETE FROM ${table}${whereClause}`;
        return this.execute(sql, whereParams);
    }

    /**
     * Delete a record by ID
     */
    async deleteById(
        table: string,
        id: number | string,
        idColumn: string = 'id'
    ): Promise<D1Result> {
        return this.delete(table, [
            { column: idColumn, operator: '=', value: id },
        ]);
    }

    /**
     * Upsert (insert or update)
     */
    async upsert<T extends Record<string, unknown>>(
        table: string,
        data: T,
        conflictColumns: string[]
    ): Promise<D1Result> {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = columns.map(() => '?').join(', ');

        const updateColumns = columns
            .filter((col) => !conflictColumns.includes(col))
            .map((col) => `${col} = excluded.${col}`)
            .join(', ');

        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
      ON CONFLICT (${conflictColumns.join(', ')}) DO UPDATE SET ${updateColumns}`;

        return this.execute(sql, values);
    }

    /**
     * Count records
     */
    async count(table: string, where?: WhereCondition[]): Promise<number> {
        const { whereClause, whereParams } = where
            ? this.buildWhereClause(where)
            : { whereClause: '', whereParams: [] };

        const sql = `SELECT COUNT(*) as count FROM ${table}${whereClause}`;
        const result = await this.queryOne<{ count: number }>(sql, whereParams);
        return result?.count ?? 0;
    }

    /**
     * Check if records exist
     */
    async exists(table: string, where: WhereCondition[]): Promise<boolean> {
        const count = await this.count(table, where);
        return count > 0;
    }

    /**
     * Sum a column
     */
    async sum(table: string, column: string, where?: WhereCondition[]): Promise<number> {
        const { whereClause, whereParams } = where
            ? this.buildWhereClause(where)
            : { whereClause: '', whereParams: [] };

        const sql = `SELECT SUM(${column}) as sum FROM ${table}${whereClause}`;
        const result = await this.queryOne<{ sum: number }>(sql, whereParams);
        return result?.sum ?? 0;
    }

    /**
     * Average a column
     */
    async avg(table: string, column: string, where?: WhereCondition[]): Promise<number> {
        const { whereClause, whereParams } = where
            ? this.buildWhereClause(where)
            : { whereClause: '', whereParams: [] };

        const sql = `SELECT AVG(${column}) as avg FROM ${table}${whereClause}`;
        const result = await this.queryOne<{ avg: number }>(sql, whereParams);
        return result?.avg ?? 0;
    }

    /**
     * Get min value
     */
    async min<T = number>(table: string, column: string, where?: WhereCondition[]): Promise<T | null> {
        const { whereClause, whereParams } = where
            ? this.buildWhereClause(where)
            : { whereClause: '', whereParams: [] };

        const sql = `SELECT MIN(${column}) as min FROM ${table}${whereClause}`;
        const result = await this.queryOne<{ min: T }>(sql, whereParams);
        return result?.min ?? null;
    }

    /**
     * Get max value
     */
    async max<T = number>(table: string, column: string, where?: WhereCondition[]): Promise<T | null> {
        const { whereClause, whereParams } = where
            ? this.buildWhereClause(where)
            : { whereClause: '', whereParams: [] };

        const sql = `SELECT MAX(${column}) as max FROM ${table}${whereClause}`;
        const result = await this.queryOne<{ max: T }>(sql, whereParams);
        return result?.max ?? null;
    }

    /**
     * Create a table
     */
    async createTable(
        table: string,
        columns: ColumnDefinition[],
        ifNotExists: boolean = true
    ): Promise<D1Result> {
        const columnDefs = columns.map((col) => {
            let def = `${col.name} ${col.type}`;
            if (col.primaryKey) def += ' PRIMARY KEY';
            if (col.autoIncrement) def += ' AUTOINCREMENT';
            if (col.notNull) def += ' NOT NULL';
            if (col.unique) def += ' UNIQUE';
            if (col.default !== undefined) {
                def += ` DEFAULT ${typeof col.default === 'string' ? `'${col.default}'` : col.default}`;
            }
            if (col.references) {
                def += ` REFERENCES ${col.references.table}(${col.references.column})`;
                if (col.references.onDelete) def += ` ON DELETE ${col.references.onDelete}`;
                if (col.references.onUpdate) def += ` ON UPDATE ${col.references.onUpdate}`;
            }
            return def;
        });

        const existence = ifNotExists ? 'IF NOT EXISTS ' : '';
        const sql = `CREATE TABLE ${existence}${table} (${columnDefs.join(', ')})`;
        return this.execute(sql);
    }

    /**
     * Drop a table
     */
    async dropTable(table: string, ifExists: boolean = true): Promise<D1Result> {
        const existence = ifExists ? 'IF EXISTS ' : '';
        return this.execute(`DROP TABLE ${existence}${table}`);
    }

    /**
     * Add a column to a table
     */
    async addColumn(table: string, column: ColumnDefinition): Promise<D1Result> {
        let def = `${column.name} ${column.type}`;
        if (column.notNull) def += ' NOT NULL';
        if (column.default !== undefined) {
            def += ` DEFAULT ${typeof column.default === 'string' ? `'${column.default}'` : column.default}`;
        }
        return this.execute(`ALTER TABLE ${table} ADD COLUMN ${def}`);
    }

    /**
     * Create an index
     */
    async createIndex(
        table: string,
        columns: string[],
        options: { unique?: boolean; ifNotExists?: boolean; name?: string } = {}
    ): Promise<D1Result> {
        const indexName = options.name ?? `idx_${table}_${columns.join('_')}`;
        const unique = options.unique ? 'UNIQUE ' : '';
        const existence = options.ifNotExists !== false ? 'IF NOT EXISTS ' : '';

        const sql = `CREATE ${unique}INDEX ${existence}${indexName} ON ${table} (${columns.join(', ')})`;
        return this.execute(sql);
    }

    /**
     * Drop an index
     */
    async dropIndex(name: string, ifExists: boolean = true): Promise<D1Result> {
        const existence = ifExists ? 'IF EXISTS ' : '';
        return this.execute(`DROP INDEX ${existence}${name}`);
    }

    /**
     * Get table info
     */
    async getTableInfo(table: string): Promise<Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: unknown;
        pk: number;
    }>> {
        const result = await this.query<any>(`PRAGMA table_info(${table})`);
        return result.results;
    }

    /**
     * List all tables
     */
    async listTables(): Promise<string[]> {
        const result = await this.query<{ name: string }>(
            `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
        );
        return result.results.map((r) => r.name);
    }

    /**
     * Execute operations in a transaction
     * Note: D1 doesn't have true transactions, but this batches operations
     */
    async transaction<T>(
        operations: (tx: TransactionContext) => Promise<T>
    ): Promise<T> {
        const statements: Array<{ sql: string; params: unknown[] }> = [];

        const tx: TransactionContext = {
            execute: (sql: string, params: unknown[] = []) => {
                statements.push({ sql, params });
            },
            insert: <R extends Record<string, unknown>>(table: string, data: R) => {
                const columns = Object.keys(data);
                const values = Object.values(data);
                const placeholders = columns.map(() => '?').join(', ');
                const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
                statements.push({ sql, params: values });
            },
            update: <R extends Record<string, unknown>>(
                table: string,
                data: Partial<R>,
                where: WhereCondition[]
            ) => {
                const columns = Object.keys(data);
                const values = Object.values(data);
                const setClause = columns.map((col) => `${col} = ?`).join(', ');
                const { whereClause, whereParams } = this.buildWhereClause(where);
                const sql = `UPDATE ${table} SET ${setClause}${whereClause}`;
                statements.push({ sql, params: [...values, ...whereParams] });
            },
            delete: (table: string, where: WhereCondition[]) => {
                const { whereClause, whereParams } = this.buildWhereClause(where);
                const sql = `DELETE FROM ${table}${whereClause}`;
                statements.push({ sql, params: whereParams });
            },
        };

        const result = await operations(tx);

        if (statements.length > 0) {
            await this.batch(statements);
        }

        return result;
    }

    private buildSelect(
        table: string,
        options: {
            columns?: string[];
            where?: WhereCondition[];
            orderBy?: Array<{ column: string; direction?: OrderDirection }>;
            limit?: number;
            offset?: number;
        }
    ): { sql: string; params: unknown[] } {
        const columns = options.columns?.join(', ') ?? '*';
        let sql = `SELECT ${columns} FROM ${table}`;
        let params: unknown[] = [];

        if (options.where?.length) {
            const { whereClause, whereParams } = this.buildWhereClause(options.where);
            sql += whereClause;
            params = whereParams;
        }

        if (options.orderBy?.length) {
            const orderClauses = options.orderBy.map(
                (o) => `${o.column} ${o.direction ?? 'ASC'}`
            );
            sql += ` ORDER BY ${orderClauses.join(', ')}`;
        }

        if (options.limit !== undefined) {
            sql += ` LIMIT ${options.limit}`;
        }

        if (options.offset !== undefined) {
            sql += ` OFFSET ${options.offset}`;
        }

        return { sql, params };
    }

    private buildWhereClause(conditions: WhereCondition[]): {
        whereClause: string;
        whereParams: unknown[];
    } {
        if (conditions.length === 0) {
            return { whereClause: '', whereParams: [] };
        }

        const clauses: string[] = [];
        const params: unknown[] = [];

        for (const condition of conditions) {
            switch (condition.operator) {
                case 'IS NULL':
                    clauses.push(`${condition.column} IS NULL`);
                    break;
                case 'IS NOT NULL':
                    clauses.push(`${condition.column} IS NOT NULL`);
                    break;
                case 'IN':
                case 'NOT IN':
                    const placeholders = condition.values!.map(() => '?').join(', ');
                    clauses.push(`${condition.column} ${condition.operator} (${placeholders})`);
                    params.push(...condition.values!);
                    break;
                case 'BETWEEN':
                    clauses.push(`${condition.column} BETWEEN ? AND ?`);
                    params.push(condition.values![0], condition.values![1]);
                    break;
                default:
                    clauses.push(`${condition.column} ${condition.operator} ?`);
                    params.push(condition.value);
            }
        }

        return {
            whereClause: ` WHERE ${clauses.join(' AND ')}`,
            whereParams: params,
        };
    }
}

export interface TransactionContext {
    execute(sql: string, params?: unknown[]): void;
    insert<T extends Record<string, unknown>>(table: string, data: T): void;
    update<T extends Record<string, unknown>>(
        table: string,
        data: Partial<T>,
        where: WhereCondition[]
    ): void;
    delete(table: string, where: WhereCondition[]): void;
}

/**
 * Base class for creating typed D1 repositories
 */
export abstract class D1Repository<T extends Record<string, unknown>> {
    constructor(
        protected readonly d1: D1Service,
        protected readonly tableName: string,
        protected readonly idColumn: string = 'id'
    ) { }

    /**
     * Find all records
     */
    async findAll(options?: {
        orderBy?: Array<{ column: string; direction?: OrderDirection }>;
        limit?: number;
        offset?: number;
    }): Promise<T[]> {
        return this.d1.select<T>(this.tableName, options);
    }

    /**
     * Find a record by ID
     */
    async findById(id: number | string): Promise<T | null> {
        return this.d1.findById<T>(this.tableName, id, this.idColumn);
    }

    /**
     * Find one record by conditions
     */
    async findOne(where: WhereCondition[]): Promise<T | null> {
        return this.d1.selectOne<T>(this.tableName, where);
    }

    /**
     * Find records by conditions
     */
    async find(
        where: WhereCondition[],
        options?: {
            orderBy?: Array<{ column: string; direction?: OrderDirection }>;
            limit?: number;
            offset?: number;
        }
    ): Promise<T[]> {
        return this.d1.select<T>(this.tableName, { where, ...options });
    }

    /**
     * Create a new record
     */
    async create(data: Omit<T, 'id'>): Promise<number> {
        const result = await this.d1.insert(this.tableName, data as T);
        return result.meta.last_row_id;
    }

    /**
     * Create multiple records
     */
    async createMany(records: Array<Omit<T, 'id'>>): Promise<D1Result[]> {
        return this.d1.insertMany(this.tableName, records as T[]);
    }

    /**
     * Update a record by ID
     */
    async update(id: number | string, data: Partial<T>): Promise<D1Result> {
        return this.d1.updateById(this.tableName, id, data, this.idColumn);
    }

    /**
     * Update records by conditions
     */
    async updateWhere(where: WhereCondition[], data: Partial<T>): Promise<D1Result> {
        return this.d1.update(this.tableName, data, where);
    }

    /**
     * Delete a record by ID
     */
    async delete(id: number | string): Promise<D1Result> {
        return this.d1.deleteById(this.tableName, id, this.idColumn);
    }

    /**
     * Delete records by conditions
     */
    async deleteWhere(where: WhereCondition[]): Promise<D1Result> {
        return this.d1.delete(this.tableName, where);
    }

    /**
     * Count records
     */
    async count(where?: WhereCondition[]): Promise<number> {
        return this.d1.count(this.tableName, where);
    }

    /**
     * Check if a record exists
     */
    async exists(where: WhereCondition[]): Promise<boolean> {
        return this.d1.exists(this.tableName, where);
    }

    /**
     * Upsert a record
     */
    async upsert(data: T, conflictColumns: string[]): Promise<D1Result> {
        return this.d1.upsert(this.tableName, data, conflictColumns);
    }

    /**
     * Execute raw SQL for this table
     */
    async raw<R = T>(sql: string, params: unknown[] = []): Promise<R[]> {
        const result = await this.d1.query<R>(sql, params);
        return result.results;
    }
}

/**
 * Fluent query builder for D1
 */
export class QueryBuilder<T = Record<string, unknown>> {
    private _columns: string[] = ['*'];
    private _where: WhereCondition[] = [];
    private _orderBy: Array<{ column: string; direction: OrderDirection }> = [];
    private _limit?: number;
    private _offset?: number;

    constructor(
        private readonly d1: D1Service,
        private readonly tableName: string
    ) { }

    /**
     * Select specific columns
     */
    select(...columns: (keyof T | string)[]): this {
        this._columns = columns as string[];
        return this;
    }

    /**
     * Add a where condition
     */
    where(column: keyof T | string, operator: WhereOperator, value?: unknown): this {
        this._where.push({ column: column as string, operator, value });
        return this;
    }

    /**
     * Add a where IN condition
     */
    whereIn(column: keyof T | string, values: unknown[]): this {
        this._where.push({ column: column as string, operator: 'IN', values });
        return this;
    }

    /**
     * Add a where NOT IN condition
     */
    whereNotIn(column: keyof T | string, values: unknown[]): this {
        this._where.push({ column: column as string, operator: 'NOT IN', values });
        return this;
    }

    /**
     * Add a where BETWEEN condition
     */
    whereBetween(column: keyof T | string, min: unknown, max: unknown): this {
        this._where.push({ column: column as string, operator: 'BETWEEN', values: [min, max] });
        return this;
    }

    /**
     * Add a where IS NULL condition
     */
    whereNull(column: keyof T | string): this {
        this._where.push({ column: column as string, operator: 'IS NULL' });
        return this;
    }

    /**
     * Add a where IS NOT NULL condition
     */
    whereNotNull(column: keyof T | string): this {
        this._where.push({ column: column as string, operator: 'IS NOT NULL' });
        return this;
    }

    /**
     * Add order by
     */
    orderBy(column: keyof T | string, direction: OrderDirection = 'ASC'): this {
        this._orderBy.push({ column: column as string, direction });
        return this;
    }

    /**
     * Set limit
     */
    limit(limit: number): this {
        this._limit = limit;
        return this;
    }

    /**
     * Set offset
     */
    offset(offset: number): this {
        this._offset = offset;
        return this;
    }

    /**
     * Execute and get all results
     */
    async get(): Promise<T[]> {
        return this.d1.select<T>(this.tableName, {
            columns: this._columns,
            where: this._where,
            orderBy: this._orderBy,
            limit: this._limit,
            offset: this._offset,
        });
    }

    /**
     * Execute and get first result
     */
    async first(): Promise<T | null> {
        const results = await this.limit(1).get();
        return results[0] ?? null;
    }

    /**
     * Count matching records
     */
    async count(): Promise<number> {
        return this.d1.count(this.tableName, this._where);
    }

    /**
     * Check if any matching records exist
     */
    async exists(): Promise<boolean> {
        return this.d1.exists(this.tableName, this._where);
    }

    /**
     * Delete matching records
     */
    async delete(): Promise<D1Result> {
        return this.d1.delete(this.tableName, this._where);
    }

    /**
     * Update matching records
     */
    async update(data: Partial<T>): Promise<D1Result> {
        return this.d1.update(this.tableName, data, this._where);
    }
}

/**
 * D1 Module for Flareone
 */
@Module({})
export class D1Module {
    /**
     * Configure D1 module with static options
     */
    static forRoot(options: D1ModuleOptions): DynamicModule {
        return {
            module: D1Module,
            providers: [
                { provide: D1_OPTIONS, useValue: options },
                D1Service,
            ],
            exports: [D1Service, D1_OPTIONS],
        };
    }

    /**
     * Configure D1 module with async options
     */
    static forRootAsync(options: D1ModuleAsyncOptions): DynamicModule {
        return {
            module: D1Module,
            imports: options.imports ?? [],
            providers: [
                {
                    provide: D1_OPTIONS,
                    useFactory: options.useFactory,
                    inject: options.inject,
                },
                D1Service,
            ],
            exports: [D1Service, D1_OPTIONS],
        };
    }
}

/**
 * Create a D1 service for a specific database
 */
export function createD1Service(
    database: D1Database,
    options: Partial<D1ModuleOptions> = {}
): D1Service {
    const service = new D1Service();
    service.initialize(database, {
        binding: 'custom',
        ...options,
    });
    return service;
}

/**
 * Helper to get D1 database from environment
 */
export function getD1Database(env: Record<string, unknown>, binding: string): D1Database {
    const database = env[binding] as D1Database | undefined;
    if (!database) {
        throw new Error(`D1 database '${binding}' not found in environment`);
    }
    return database;
}

/**
 * Create a query builder from a service
 */
export function table<T = Record<string, unknown>>(
    d1: D1Service,
    tableName: string
): QueryBuilder<T> {
    return new QueryBuilder<T>(d1, tableName);
}
