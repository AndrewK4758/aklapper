
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model active_game_state
 * 
 */
export type active_game_state = $Result.DefaultSelection<Prisma.$active_game_statePayload>
/**
 * Model instance_time_map
 * 
 */
export type instance_time_map = $Result.DefaultSelection<Prisma.$instance_time_mapPayload>
/**
 * Model users
 * 
 */
export type users = $Result.DefaultSelection<Prisma.$usersPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Active_game_states
 * const active_game_states = await prisma.active_game_state.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Active_game_states
   * const active_game_states = await prisma.active_game_state.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): void;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb, ExtArgs, $Utils.Call<Prisma.TypeMapCb, {
    extArgs: ExtArgs
  }>, ClientOptions>

      /**
   * `prisma.active_game_state`: Exposes CRUD operations for the **active_game_state** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Active_game_states
    * const active_game_states = await prisma.active_game_state.findMany()
    * ```
    */
  get active_game_state(): Prisma.active_game_stateDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.instance_time_map`: Exposes CRUD operations for the **instance_time_map** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Instance_time_maps
    * const instance_time_maps = await prisma.instance_time_map.findMany()
    * ```
    */
  get instance_time_map(): Prisma.instance_time_mapDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.users`: Exposes CRUD operations for the **users** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.users.findMany()
    * ```
    */
  get users(): Prisma.usersDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics 
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.2.1
   * Query Engine version: 4123509d24aa4dede1e864b46351bf2790323b69
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion 

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? K : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    active_game_state: 'active_game_state',
    instance_time_map: 'instance_time_map',
    users: 'users'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb extends $Utils.Fn<{extArgs: $Extensions.InternalArgs, clientOptions: PrismaClientOptions }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], this['params']['clientOptions']>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> = {
    meta: {
      modelProps: "active_game_state" | "instance_time_map" | "users"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      active_game_state: {
        payload: Prisma.$active_game_statePayload<ExtArgs>
        fields: Prisma.active_game_stateFieldRefs
        operations: {
          findUnique: {
            args: Prisma.active_game_stateFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$active_game_statePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.active_game_stateFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$active_game_statePayload>
          }
          findFirst: {
            args: Prisma.active_game_stateFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$active_game_statePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.active_game_stateFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$active_game_statePayload>
          }
          findMany: {
            args: Prisma.active_game_stateFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$active_game_statePayload>[]
          }
          create: {
            args: Prisma.active_game_stateCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$active_game_statePayload>
          }
          createMany: {
            args: Prisma.active_game_stateCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.active_game_stateCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$active_game_statePayload>[]
          }
          delete: {
            args: Prisma.active_game_stateDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$active_game_statePayload>
          }
          update: {
            args: Prisma.active_game_stateUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$active_game_statePayload>
          }
          deleteMany: {
            args: Prisma.active_game_stateDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.active_game_stateUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.active_game_stateUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$active_game_statePayload>[]
          }
          upsert: {
            args: Prisma.active_game_stateUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$active_game_statePayload>
          }
          aggregate: {
            args: Prisma.Active_game_stateAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateActive_game_state>
          }
          groupBy: {
            args: Prisma.active_game_stateGroupByArgs<ExtArgs>
            result: $Utils.Optional<Active_game_stateGroupByOutputType>[]
          }
          count: {
            args: Prisma.active_game_stateCountArgs<ExtArgs>
            result: $Utils.Optional<Active_game_stateCountAggregateOutputType> | number
          }
        }
      }
      instance_time_map: {
        payload: Prisma.$instance_time_mapPayload<ExtArgs>
        fields: Prisma.instance_time_mapFieldRefs
        operations: {
          findUnique: {
            args: Prisma.instance_time_mapFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$instance_time_mapPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.instance_time_mapFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$instance_time_mapPayload>
          }
          findFirst: {
            args: Prisma.instance_time_mapFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$instance_time_mapPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.instance_time_mapFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$instance_time_mapPayload>
          }
          findMany: {
            args: Prisma.instance_time_mapFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$instance_time_mapPayload>[]
          }
          create: {
            args: Prisma.instance_time_mapCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$instance_time_mapPayload>
          }
          createMany: {
            args: Prisma.instance_time_mapCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.instance_time_mapCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$instance_time_mapPayload>[]
          }
          delete: {
            args: Prisma.instance_time_mapDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$instance_time_mapPayload>
          }
          update: {
            args: Prisma.instance_time_mapUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$instance_time_mapPayload>
          }
          deleteMany: {
            args: Prisma.instance_time_mapDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.instance_time_mapUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.instance_time_mapUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$instance_time_mapPayload>[]
          }
          upsert: {
            args: Prisma.instance_time_mapUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$instance_time_mapPayload>
          }
          aggregate: {
            args: Prisma.Instance_time_mapAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateInstance_time_map>
          }
          groupBy: {
            args: Prisma.instance_time_mapGroupByArgs<ExtArgs>
            result: $Utils.Optional<Instance_time_mapGroupByOutputType>[]
          }
          count: {
            args: Prisma.instance_time_mapCountArgs<ExtArgs>
            result: $Utils.Optional<Instance_time_mapCountAggregateOutputType> | number
          }
        }
      }
      users: {
        payload: Prisma.$usersPayload<ExtArgs>
        fields: Prisma.usersFieldRefs
        operations: {
          findUnique: {
            args: Prisma.usersFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$usersPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.usersFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$usersPayload>
          }
          findFirst: {
            args: Prisma.usersFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$usersPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.usersFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$usersPayload>
          }
          findMany: {
            args: Prisma.usersFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$usersPayload>[]
          }
          create: {
            args: Prisma.usersCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$usersPayload>
          }
          createMany: {
            args: Prisma.usersCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.usersCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$usersPayload>[]
          }
          delete: {
            args: Prisma.usersDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$usersPayload>
          }
          update: {
            args: Prisma.usersUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$usersPayload>
          }
          deleteMany: {
            args: Prisma.usersDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.usersUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.usersUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$usersPayload>[]
          }
          upsert: {
            args: Prisma.usersUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$usersPayload>
          }
          aggregate: {
            args: Prisma.UsersAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUsers>
          }
          groupBy: {
            args: Prisma.usersGroupByArgs<ExtArgs>
            result: $Utils.Optional<UsersGroupByOutputType>[]
          }
          count: {
            args: Prisma.usersCountArgs<ExtArgs>
            result: $Utils.Optional<UsersCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    active_game_state?: active_game_stateOmit
    instance_time_map?: instance_time_mapOmit
    users?: usersOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */



  /**
   * Models
   */

  /**
   * Model active_game_state
   */

  export type AggregateActive_game_state = {
    _count: Active_game_stateCountAggregateOutputType | null
    _avg: Active_game_stateAvgAggregateOutputType | null
    _sum: Active_game_stateSumAggregateOutputType | null
    _min: Active_game_stateMinAggregateOutputType | null
    _max: Active_game_stateMaxAggregateOutputType | null
  }

  export type Active_game_stateAvgAggregateOutputType = {
    player_in_turn: number | null
    special_space_values: number | null
    special_space_dump_values: number | null
  }

  export type Active_game_stateSumAggregateOutputType = {
    player_in_turn: number | null
    special_space_values: number[]
    special_space_dump_values: number[]
  }

  export type Active_game_stateMinAggregateOutputType = {
    game_id: string | null
    player_in_turn: number | null
  }

  export type Active_game_stateMaxAggregateOutputType = {
    game_id: string | null
    player_in_turn: number | null
  }

  export type Active_game_stateCountAggregateOutputType = {
    game_id: number
    players_array: number
    player_in_turn: number
    special_space_values: number
    special_space_dump_values: number
    _all: number
  }


  export type Active_game_stateAvgAggregateInputType = {
    player_in_turn?: true
    special_space_values?: true
    special_space_dump_values?: true
  }

  export type Active_game_stateSumAggregateInputType = {
    player_in_turn?: true
    special_space_values?: true
    special_space_dump_values?: true
  }

  export type Active_game_stateMinAggregateInputType = {
    game_id?: true
    player_in_turn?: true
  }

  export type Active_game_stateMaxAggregateInputType = {
    game_id?: true
    player_in_turn?: true
  }

  export type Active_game_stateCountAggregateInputType = {
    game_id?: true
    players_array?: true
    player_in_turn?: true
    special_space_values?: true
    special_space_dump_values?: true
    _all?: true
  }

  export type Active_game_stateAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which active_game_state to aggregate.
     */
    where?: active_game_stateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of active_game_states to fetch.
     */
    orderBy?: active_game_stateOrderByWithRelationInput | active_game_stateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: active_game_stateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` active_game_states from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` active_game_states.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned active_game_states
    **/
    _count?: true | Active_game_stateCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: Active_game_stateAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: Active_game_stateSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: Active_game_stateMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: Active_game_stateMaxAggregateInputType
  }

  export type GetActive_game_stateAggregateType<T extends Active_game_stateAggregateArgs> = {
        [P in keyof T & keyof AggregateActive_game_state]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateActive_game_state[P]>
      : GetScalarType<T[P], AggregateActive_game_state[P]>
  }




  export type active_game_stateGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: active_game_stateWhereInput
    orderBy?: active_game_stateOrderByWithAggregationInput | active_game_stateOrderByWithAggregationInput[]
    by: Active_game_stateScalarFieldEnum[] | Active_game_stateScalarFieldEnum
    having?: active_game_stateScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: Active_game_stateCountAggregateInputType | true
    _avg?: Active_game_stateAvgAggregateInputType
    _sum?: Active_game_stateSumAggregateInputType
    _min?: Active_game_stateMinAggregateInputType
    _max?: Active_game_stateMaxAggregateInputType
  }

  export type Active_game_stateGroupByOutputType = {
    game_id: string
    players_array: JsonValue[]
    player_in_turn: number
    special_space_values: number[]
    special_space_dump_values: number[]
    _count: Active_game_stateCountAggregateOutputType | null
    _avg: Active_game_stateAvgAggregateOutputType | null
    _sum: Active_game_stateSumAggregateOutputType | null
    _min: Active_game_stateMinAggregateOutputType | null
    _max: Active_game_stateMaxAggregateOutputType | null
  }

  type GetActive_game_stateGroupByPayload<T extends active_game_stateGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<Active_game_stateGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof Active_game_stateGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], Active_game_stateGroupByOutputType[P]>
            : GetScalarType<T[P], Active_game_stateGroupByOutputType[P]>
        }
      >
    >


  export type active_game_stateSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    game_id?: boolean
    players_array?: boolean
    player_in_turn?: boolean
    special_space_values?: boolean
    special_space_dump_values?: boolean
  }, ExtArgs["result"]["active_game_state"]>

  export type active_game_stateSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    game_id?: boolean
    players_array?: boolean
    player_in_turn?: boolean
    special_space_values?: boolean
    special_space_dump_values?: boolean
  }, ExtArgs["result"]["active_game_state"]>

  export type active_game_stateSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    game_id?: boolean
    players_array?: boolean
    player_in_turn?: boolean
    special_space_values?: boolean
    special_space_dump_values?: boolean
  }, ExtArgs["result"]["active_game_state"]>

  export type active_game_stateSelectScalar = {
    game_id?: boolean
    players_array?: boolean
    player_in_turn?: boolean
    special_space_values?: boolean
    special_space_dump_values?: boolean
  }

  export type active_game_stateOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"game_id" | "players_array" | "player_in_turn" | "special_space_values" | "special_space_dump_values", ExtArgs["result"]["active_game_state"]>

  export type $active_game_statePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "active_game_state"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      game_id: string
      players_array: Prisma.JsonValue[]
      player_in_turn: number
      special_space_values: number[]
      special_space_dump_values: number[]
    }, ExtArgs["result"]["active_game_state"]>
    composites: {}
  }

  type active_game_stateGetPayload<S extends boolean | null | undefined | active_game_stateDefaultArgs> = $Result.GetResult<Prisma.$active_game_statePayload, S>

  type active_game_stateCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<active_game_stateFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: Active_game_stateCountAggregateInputType | true
    }

  export interface active_game_stateDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['active_game_state'], meta: { name: 'active_game_state' } }
    /**
     * Find zero or one Active_game_state that matches the filter.
     * @param {active_game_stateFindUniqueArgs} args - Arguments to find a Active_game_state
     * @example
     * // Get one Active_game_state
     * const active_game_state = await prisma.active_game_state.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends active_game_stateFindUniqueArgs>(args: SelectSubset<T, active_game_stateFindUniqueArgs<ExtArgs>>): Prisma__active_game_stateClient<$Result.GetResult<Prisma.$active_game_statePayload<ExtArgs>, T, "findUnique", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find one Active_game_state that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {active_game_stateFindUniqueOrThrowArgs} args - Arguments to find a Active_game_state
     * @example
     * // Get one Active_game_state
     * const active_game_state = await prisma.active_game_state.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends active_game_stateFindUniqueOrThrowArgs>(args: SelectSubset<T, active_game_stateFindUniqueOrThrowArgs<ExtArgs>>): Prisma__active_game_stateClient<$Result.GetResult<Prisma.$active_game_statePayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find the first Active_game_state that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {active_game_stateFindFirstArgs} args - Arguments to find a Active_game_state
     * @example
     * // Get one Active_game_state
     * const active_game_state = await prisma.active_game_state.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends active_game_stateFindFirstArgs>(args?: SelectSubset<T, active_game_stateFindFirstArgs<ExtArgs>>): Prisma__active_game_stateClient<$Result.GetResult<Prisma.$active_game_statePayload<ExtArgs>, T, "findFirst", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find the first Active_game_state that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {active_game_stateFindFirstOrThrowArgs} args - Arguments to find a Active_game_state
     * @example
     * // Get one Active_game_state
     * const active_game_state = await prisma.active_game_state.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends active_game_stateFindFirstOrThrowArgs>(args?: SelectSubset<T, active_game_stateFindFirstOrThrowArgs<ExtArgs>>): Prisma__active_game_stateClient<$Result.GetResult<Prisma.$active_game_statePayload<ExtArgs>, T, "findFirstOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find zero or more Active_game_states that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {active_game_stateFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Active_game_states
     * const active_game_states = await prisma.active_game_state.findMany()
     * 
     * // Get first 10 Active_game_states
     * const active_game_states = await prisma.active_game_state.findMany({ take: 10 })
     * 
     * // Only select the `game_id`
     * const active_game_stateWithGame_idOnly = await prisma.active_game_state.findMany({ select: { game_id: true } })
     * 
     */
    findMany<T extends active_game_stateFindManyArgs>(args?: SelectSubset<T, active_game_stateFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$active_game_statePayload<ExtArgs>, T, "findMany", ClientOptions>>

    /**
     * Create a Active_game_state.
     * @param {active_game_stateCreateArgs} args - Arguments to create a Active_game_state.
     * @example
     * // Create one Active_game_state
     * const Active_game_state = await prisma.active_game_state.create({
     *   data: {
     *     // ... data to create a Active_game_state
     *   }
     * })
     * 
     */
    create<T extends active_game_stateCreateArgs>(args: SelectSubset<T, active_game_stateCreateArgs<ExtArgs>>): Prisma__active_game_stateClient<$Result.GetResult<Prisma.$active_game_statePayload<ExtArgs>, T, "create", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Create many Active_game_states.
     * @param {active_game_stateCreateManyArgs} args - Arguments to create many Active_game_states.
     * @example
     * // Create many Active_game_states
     * const active_game_state = await prisma.active_game_state.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends active_game_stateCreateManyArgs>(args?: SelectSubset<T, active_game_stateCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Active_game_states and returns the data saved in the database.
     * @param {active_game_stateCreateManyAndReturnArgs} args - Arguments to create many Active_game_states.
     * @example
     * // Create many Active_game_states
     * const active_game_state = await prisma.active_game_state.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Active_game_states and only return the `game_id`
     * const active_game_stateWithGame_idOnly = await prisma.active_game_state.createManyAndReturn({
     *   select: { game_id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends active_game_stateCreateManyAndReturnArgs>(args?: SelectSubset<T, active_game_stateCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$active_game_statePayload<ExtArgs>, T, "createManyAndReturn", ClientOptions>>

    /**
     * Delete a Active_game_state.
     * @param {active_game_stateDeleteArgs} args - Arguments to delete one Active_game_state.
     * @example
     * // Delete one Active_game_state
     * const Active_game_state = await prisma.active_game_state.delete({
     *   where: {
     *     // ... filter to delete one Active_game_state
     *   }
     * })
     * 
     */
    delete<T extends active_game_stateDeleteArgs>(args: SelectSubset<T, active_game_stateDeleteArgs<ExtArgs>>): Prisma__active_game_stateClient<$Result.GetResult<Prisma.$active_game_statePayload<ExtArgs>, T, "delete", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Update one Active_game_state.
     * @param {active_game_stateUpdateArgs} args - Arguments to update one Active_game_state.
     * @example
     * // Update one Active_game_state
     * const active_game_state = await prisma.active_game_state.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends active_game_stateUpdateArgs>(args: SelectSubset<T, active_game_stateUpdateArgs<ExtArgs>>): Prisma__active_game_stateClient<$Result.GetResult<Prisma.$active_game_statePayload<ExtArgs>, T, "update", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Delete zero or more Active_game_states.
     * @param {active_game_stateDeleteManyArgs} args - Arguments to filter Active_game_states to delete.
     * @example
     * // Delete a few Active_game_states
     * const { count } = await prisma.active_game_state.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends active_game_stateDeleteManyArgs>(args?: SelectSubset<T, active_game_stateDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Active_game_states.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {active_game_stateUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Active_game_states
     * const active_game_state = await prisma.active_game_state.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends active_game_stateUpdateManyArgs>(args: SelectSubset<T, active_game_stateUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Active_game_states and returns the data updated in the database.
     * @param {active_game_stateUpdateManyAndReturnArgs} args - Arguments to update many Active_game_states.
     * @example
     * // Update many Active_game_states
     * const active_game_state = await prisma.active_game_state.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Active_game_states and only return the `game_id`
     * const active_game_stateWithGame_idOnly = await prisma.active_game_state.updateManyAndReturn({
     *   select: { game_id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends active_game_stateUpdateManyAndReturnArgs>(args: SelectSubset<T, active_game_stateUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$active_game_statePayload<ExtArgs>, T, "updateManyAndReturn", ClientOptions>>

    /**
     * Create or update one Active_game_state.
     * @param {active_game_stateUpsertArgs} args - Arguments to update or create a Active_game_state.
     * @example
     * // Update or create a Active_game_state
     * const active_game_state = await prisma.active_game_state.upsert({
     *   create: {
     *     // ... data to create a Active_game_state
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Active_game_state we want to update
     *   }
     * })
     */
    upsert<T extends active_game_stateUpsertArgs>(args: SelectSubset<T, active_game_stateUpsertArgs<ExtArgs>>): Prisma__active_game_stateClient<$Result.GetResult<Prisma.$active_game_statePayload<ExtArgs>, T, "upsert", ClientOptions>, never, ExtArgs, ClientOptions>


    /**
     * Count the number of Active_game_states.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {active_game_stateCountArgs} args - Arguments to filter Active_game_states to count.
     * @example
     * // Count the number of Active_game_states
     * const count = await prisma.active_game_state.count({
     *   where: {
     *     // ... the filter for the Active_game_states we want to count
     *   }
     * })
    **/
    count<T extends active_game_stateCountArgs>(
      args?: Subset<T, active_game_stateCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], Active_game_stateCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Active_game_state.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {Active_game_stateAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends Active_game_stateAggregateArgs>(args: Subset<T, Active_game_stateAggregateArgs>): Prisma.PrismaPromise<GetActive_game_stateAggregateType<T>>

    /**
     * Group by Active_game_state.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {active_game_stateGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends active_game_stateGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: active_game_stateGroupByArgs['orderBy'] }
        : { orderBy?: active_game_stateGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, active_game_stateGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetActive_game_stateGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the active_game_state model
   */
  readonly fields: active_game_stateFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for active_game_state.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__active_game_stateClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the active_game_state model
   */ 
  interface active_game_stateFieldRefs {
    readonly game_id: FieldRef<"active_game_state", 'String'>
    readonly players_array: FieldRef<"active_game_state", 'Json[]'>
    readonly player_in_turn: FieldRef<"active_game_state", 'Int'>
    readonly special_space_values: FieldRef<"active_game_state", 'Int[]'>
    readonly special_space_dump_values: FieldRef<"active_game_state", 'Int[]'>
  }
    

  // Custom InputTypes
  /**
   * active_game_state findUnique
   */
  export type active_game_stateFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the active_game_state
     */
    select?: active_game_stateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the active_game_state
     */
    omit?: active_game_stateOmit<ExtArgs> | null
    /**
     * Filter, which active_game_state to fetch.
     */
    where: active_game_stateWhereUniqueInput
  }

  /**
   * active_game_state findUniqueOrThrow
   */
  export type active_game_stateFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the active_game_state
     */
    select?: active_game_stateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the active_game_state
     */
    omit?: active_game_stateOmit<ExtArgs> | null
    /**
     * Filter, which active_game_state to fetch.
     */
    where: active_game_stateWhereUniqueInput
  }

  /**
   * active_game_state findFirst
   */
  export type active_game_stateFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the active_game_state
     */
    select?: active_game_stateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the active_game_state
     */
    omit?: active_game_stateOmit<ExtArgs> | null
    /**
     * Filter, which active_game_state to fetch.
     */
    where?: active_game_stateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of active_game_states to fetch.
     */
    orderBy?: active_game_stateOrderByWithRelationInput | active_game_stateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for active_game_states.
     */
    cursor?: active_game_stateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` active_game_states from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` active_game_states.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of active_game_states.
     */
    distinct?: Active_game_stateScalarFieldEnum | Active_game_stateScalarFieldEnum[]
  }

  /**
   * active_game_state findFirstOrThrow
   */
  export type active_game_stateFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the active_game_state
     */
    select?: active_game_stateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the active_game_state
     */
    omit?: active_game_stateOmit<ExtArgs> | null
    /**
     * Filter, which active_game_state to fetch.
     */
    where?: active_game_stateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of active_game_states to fetch.
     */
    orderBy?: active_game_stateOrderByWithRelationInput | active_game_stateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for active_game_states.
     */
    cursor?: active_game_stateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` active_game_states from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` active_game_states.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of active_game_states.
     */
    distinct?: Active_game_stateScalarFieldEnum | Active_game_stateScalarFieldEnum[]
  }

  /**
   * active_game_state findMany
   */
  export type active_game_stateFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the active_game_state
     */
    select?: active_game_stateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the active_game_state
     */
    omit?: active_game_stateOmit<ExtArgs> | null
    /**
     * Filter, which active_game_states to fetch.
     */
    where?: active_game_stateWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of active_game_states to fetch.
     */
    orderBy?: active_game_stateOrderByWithRelationInput | active_game_stateOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing active_game_states.
     */
    cursor?: active_game_stateWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` active_game_states from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` active_game_states.
     */
    skip?: number
    distinct?: Active_game_stateScalarFieldEnum | Active_game_stateScalarFieldEnum[]
  }

  /**
   * active_game_state create
   */
  export type active_game_stateCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the active_game_state
     */
    select?: active_game_stateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the active_game_state
     */
    omit?: active_game_stateOmit<ExtArgs> | null
    /**
     * The data needed to create a active_game_state.
     */
    data: XOR<active_game_stateCreateInput, active_game_stateUncheckedCreateInput>
  }

  /**
   * active_game_state createMany
   */
  export type active_game_stateCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many active_game_states.
     */
    data: active_game_stateCreateManyInput | active_game_stateCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * active_game_state createManyAndReturn
   */
  export type active_game_stateCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the active_game_state
     */
    select?: active_game_stateSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the active_game_state
     */
    omit?: active_game_stateOmit<ExtArgs> | null
    /**
     * The data used to create many active_game_states.
     */
    data: active_game_stateCreateManyInput | active_game_stateCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * active_game_state update
   */
  export type active_game_stateUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the active_game_state
     */
    select?: active_game_stateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the active_game_state
     */
    omit?: active_game_stateOmit<ExtArgs> | null
    /**
     * The data needed to update a active_game_state.
     */
    data: XOR<active_game_stateUpdateInput, active_game_stateUncheckedUpdateInput>
    /**
     * Choose, which active_game_state to update.
     */
    where: active_game_stateWhereUniqueInput
  }

  /**
   * active_game_state updateMany
   */
  export type active_game_stateUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update active_game_states.
     */
    data: XOR<active_game_stateUpdateManyMutationInput, active_game_stateUncheckedUpdateManyInput>
    /**
     * Filter which active_game_states to update
     */
    where?: active_game_stateWhereInput
  }

  /**
   * active_game_state updateManyAndReturn
   */
  export type active_game_stateUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the active_game_state
     */
    select?: active_game_stateSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the active_game_state
     */
    omit?: active_game_stateOmit<ExtArgs> | null
    /**
     * The data used to update active_game_states.
     */
    data: XOR<active_game_stateUpdateManyMutationInput, active_game_stateUncheckedUpdateManyInput>
    /**
     * Filter which active_game_states to update
     */
    where?: active_game_stateWhereInput
  }

  /**
   * active_game_state upsert
   */
  export type active_game_stateUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the active_game_state
     */
    select?: active_game_stateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the active_game_state
     */
    omit?: active_game_stateOmit<ExtArgs> | null
    /**
     * The filter to search for the active_game_state to update in case it exists.
     */
    where: active_game_stateWhereUniqueInput
    /**
     * In case the active_game_state found by the `where` argument doesn't exist, create a new active_game_state with this data.
     */
    create: XOR<active_game_stateCreateInput, active_game_stateUncheckedCreateInput>
    /**
     * In case the active_game_state was found with the provided `where` argument, update it with this data.
     */
    update: XOR<active_game_stateUpdateInput, active_game_stateUncheckedUpdateInput>
  }

  /**
   * active_game_state delete
   */
  export type active_game_stateDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the active_game_state
     */
    select?: active_game_stateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the active_game_state
     */
    omit?: active_game_stateOmit<ExtArgs> | null
    /**
     * Filter which active_game_state to delete.
     */
    where: active_game_stateWhereUniqueInput
  }

  /**
   * active_game_state deleteMany
   */
  export type active_game_stateDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which active_game_states to delete
     */
    where?: active_game_stateWhereInput
  }

  /**
   * active_game_state without action
   */
  export type active_game_stateDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the active_game_state
     */
    select?: active_game_stateSelect<ExtArgs> | null
    /**
     * Omit specific fields from the active_game_state
     */
    omit?: active_game_stateOmit<ExtArgs> | null
  }


  /**
   * Model instance_time_map
   */

  export type AggregateInstance_time_map = {
    _count: Instance_time_mapCountAggregateOutputType | null
    _avg: Instance_time_mapAvgAggregateOutputType | null
    _sum: Instance_time_mapSumAggregateOutputType | null
    _min: Instance_time_mapMinAggregateOutputType | null
    _max: Instance_time_mapMaxAggregateOutputType | null
  }

  export type Instance_time_mapAvgAggregateOutputType = {
    minute_of_day: number | null
  }

  export type Instance_time_mapSumAggregateOutputType = {
    minute_of_day: number | null
  }

  export type Instance_time_mapMinAggregateOutputType = {
    minute_of_day: number | null
  }

  export type Instance_time_mapMaxAggregateOutputType = {
    minute_of_day: number | null
  }

  export type Instance_time_mapCountAggregateOutputType = {
    minute_of_day: number
    games_in_minute: number
    _all: number
  }


  export type Instance_time_mapAvgAggregateInputType = {
    minute_of_day?: true
  }

  export type Instance_time_mapSumAggregateInputType = {
    minute_of_day?: true
  }

  export type Instance_time_mapMinAggregateInputType = {
    minute_of_day?: true
  }

  export type Instance_time_mapMaxAggregateInputType = {
    minute_of_day?: true
  }

  export type Instance_time_mapCountAggregateInputType = {
    minute_of_day?: true
    games_in_minute?: true
    _all?: true
  }

  export type Instance_time_mapAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which instance_time_map to aggregate.
     */
    where?: instance_time_mapWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of instance_time_maps to fetch.
     */
    orderBy?: instance_time_mapOrderByWithRelationInput | instance_time_mapOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: instance_time_mapWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` instance_time_maps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` instance_time_maps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned instance_time_maps
    **/
    _count?: true | Instance_time_mapCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: Instance_time_mapAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: Instance_time_mapSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: Instance_time_mapMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: Instance_time_mapMaxAggregateInputType
  }

  export type GetInstance_time_mapAggregateType<T extends Instance_time_mapAggregateArgs> = {
        [P in keyof T & keyof AggregateInstance_time_map]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateInstance_time_map[P]>
      : GetScalarType<T[P], AggregateInstance_time_map[P]>
  }




  export type instance_time_mapGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: instance_time_mapWhereInput
    orderBy?: instance_time_mapOrderByWithAggregationInput | instance_time_mapOrderByWithAggregationInput[]
    by: Instance_time_mapScalarFieldEnum[] | Instance_time_mapScalarFieldEnum
    having?: instance_time_mapScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: Instance_time_mapCountAggregateInputType | true
    _avg?: Instance_time_mapAvgAggregateInputType
    _sum?: Instance_time_mapSumAggregateInputType
    _min?: Instance_time_mapMinAggregateInputType
    _max?: Instance_time_mapMaxAggregateInputType
  }

  export type Instance_time_mapGroupByOutputType = {
    minute_of_day: number
    games_in_minute: string[]
    _count: Instance_time_mapCountAggregateOutputType | null
    _avg: Instance_time_mapAvgAggregateOutputType | null
    _sum: Instance_time_mapSumAggregateOutputType | null
    _min: Instance_time_mapMinAggregateOutputType | null
    _max: Instance_time_mapMaxAggregateOutputType | null
  }

  type GetInstance_time_mapGroupByPayload<T extends instance_time_mapGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<Instance_time_mapGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof Instance_time_mapGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], Instance_time_mapGroupByOutputType[P]>
            : GetScalarType<T[P], Instance_time_mapGroupByOutputType[P]>
        }
      >
    >


  export type instance_time_mapSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    minute_of_day?: boolean
    games_in_minute?: boolean
  }, ExtArgs["result"]["instance_time_map"]>

  export type instance_time_mapSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    minute_of_day?: boolean
    games_in_minute?: boolean
  }, ExtArgs["result"]["instance_time_map"]>

  export type instance_time_mapSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    minute_of_day?: boolean
    games_in_minute?: boolean
  }, ExtArgs["result"]["instance_time_map"]>

  export type instance_time_mapSelectScalar = {
    minute_of_day?: boolean
    games_in_minute?: boolean
  }

  export type instance_time_mapOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"minute_of_day" | "games_in_minute", ExtArgs["result"]["instance_time_map"]>

  export type $instance_time_mapPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "instance_time_map"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      minute_of_day: number
      games_in_minute: string[]
    }, ExtArgs["result"]["instance_time_map"]>
    composites: {}
  }

  type instance_time_mapGetPayload<S extends boolean | null | undefined | instance_time_mapDefaultArgs> = $Result.GetResult<Prisma.$instance_time_mapPayload, S>

  type instance_time_mapCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<instance_time_mapFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: Instance_time_mapCountAggregateInputType | true
    }

  export interface instance_time_mapDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['instance_time_map'], meta: { name: 'instance_time_map' } }
    /**
     * Find zero or one Instance_time_map that matches the filter.
     * @param {instance_time_mapFindUniqueArgs} args - Arguments to find a Instance_time_map
     * @example
     * // Get one Instance_time_map
     * const instance_time_map = await prisma.instance_time_map.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends instance_time_mapFindUniqueArgs>(args: SelectSubset<T, instance_time_mapFindUniqueArgs<ExtArgs>>): Prisma__instance_time_mapClient<$Result.GetResult<Prisma.$instance_time_mapPayload<ExtArgs>, T, "findUnique", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find one Instance_time_map that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {instance_time_mapFindUniqueOrThrowArgs} args - Arguments to find a Instance_time_map
     * @example
     * // Get one Instance_time_map
     * const instance_time_map = await prisma.instance_time_map.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends instance_time_mapFindUniqueOrThrowArgs>(args: SelectSubset<T, instance_time_mapFindUniqueOrThrowArgs<ExtArgs>>): Prisma__instance_time_mapClient<$Result.GetResult<Prisma.$instance_time_mapPayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find the first Instance_time_map that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {instance_time_mapFindFirstArgs} args - Arguments to find a Instance_time_map
     * @example
     * // Get one Instance_time_map
     * const instance_time_map = await prisma.instance_time_map.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends instance_time_mapFindFirstArgs>(args?: SelectSubset<T, instance_time_mapFindFirstArgs<ExtArgs>>): Prisma__instance_time_mapClient<$Result.GetResult<Prisma.$instance_time_mapPayload<ExtArgs>, T, "findFirst", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find the first Instance_time_map that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {instance_time_mapFindFirstOrThrowArgs} args - Arguments to find a Instance_time_map
     * @example
     * // Get one Instance_time_map
     * const instance_time_map = await prisma.instance_time_map.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends instance_time_mapFindFirstOrThrowArgs>(args?: SelectSubset<T, instance_time_mapFindFirstOrThrowArgs<ExtArgs>>): Prisma__instance_time_mapClient<$Result.GetResult<Prisma.$instance_time_mapPayload<ExtArgs>, T, "findFirstOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find zero or more Instance_time_maps that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {instance_time_mapFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Instance_time_maps
     * const instance_time_maps = await prisma.instance_time_map.findMany()
     * 
     * // Get first 10 Instance_time_maps
     * const instance_time_maps = await prisma.instance_time_map.findMany({ take: 10 })
     * 
     * // Only select the `minute_of_day`
     * const instance_time_mapWithMinute_of_dayOnly = await prisma.instance_time_map.findMany({ select: { minute_of_day: true } })
     * 
     */
    findMany<T extends instance_time_mapFindManyArgs>(args?: SelectSubset<T, instance_time_mapFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$instance_time_mapPayload<ExtArgs>, T, "findMany", ClientOptions>>

    /**
     * Create a Instance_time_map.
     * @param {instance_time_mapCreateArgs} args - Arguments to create a Instance_time_map.
     * @example
     * // Create one Instance_time_map
     * const Instance_time_map = await prisma.instance_time_map.create({
     *   data: {
     *     // ... data to create a Instance_time_map
     *   }
     * })
     * 
     */
    create<T extends instance_time_mapCreateArgs>(args: SelectSubset<T, instance_time_mapCreateArgs<ExtArgs>>): Prisma__instance_time_mapClient<$Result.GetResult<Prisma.$instance_time_mapPayload<ExtArgs>, T, "create", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Create many Instance_time_maps.
     * @param {instance_time_mapCreateManyArgs} args - Arguments to create many Instance_time_maps.
     * @example
     * // Create many Instance_time_maps
     * const instance_time_map = await prisma.instance_time_map.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends instance_time_mapCreateManyArgs>(args?: SelectSubset<T, instance_time_mapCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Instance_time_maps and returns the data saved in the database.
     * @param {instance_time_mapCreateManyAndReturnArgs} args - Arguments to create many Instance_time_maps.
     * @example
     * // Create many Instance_time_maps
     * const instance_time_map = await prisma.instance_time_map.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Instance_time_maps and only return the `minute_of_day`
     * const instance_time_mapWithMinute_of_dayOnly = await prisma.instance_time_map.createManyAndReturn({
     *   select: { minute_of_day: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends instance_time_mapCreateManyAndReturnArgs>(args?: SelectSubset<T, instance_time_mapCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$instance_time_mapPayload<ExtArgs>, T, "createManyAndReturn", ClientOptions>>

    /**
     * Delete a Instance_time_map.
     * @param {instance_time_mapDeleteArgs} args - Arguments to delete one Instance_time_map.
     * @example
     * // Delete one Instance_time_map
     * const Instance_time_map = await prisma.instance_time_map.delete({
     *   where: {
     *     // ... filter to delete one Instance_time_map
     *   }
     * })
     * 
     */
    delete<T extends instance_time_mapDeleteArgs>(args: SelectSubset<T, instance_time_mapDeleteArgs<ExtArgs>>): Prisma__instance_time_mapClient<$Result.GetResult<Prisma.$instance_time_mapPayload<ExtArgs>, T, "delete", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Update one Instance_time_map.
     * @param {instance_time_mapUpdateArgs} args - Arguments to update one Instance_time_map.
     * @example
     * // Update one Instance_time_map
     * const instance_time_map = await prisma.instance_time_map.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends instance_time_mapUpdateArgs>(args: SelectSubset<T, instance_time_mapUpdateArgs<ExtArgs>>): Prisma__instance_time_mapClient<$Result.GetResult<Prisma.$instance_time_mapPayload<ExtArgs>, T, "update", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Delete zero or more Instance_time_maps.
     * @param {instance_time_mapDeleteManyArgs} args - Arguments to filter Instance_time_maps to delete.
     * @example
     * // Delete a few Instance_time_maps
     * const { count } = await prisma.instance_time_map.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends instance_time_mapDeleteManyArgs>(args?: SelectSubset<T, instance_time_mapDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Instance_time_maps.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {instance_time_mapUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Instance_time_maps
     * const instance_time_map = await prisma.instance_time_map.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends instance_time_mapUpdateManyArgs>(args: SelectSubset<T, instance_time_mapUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Instance_time_maps and returns the data updated in the database.
     * @param {instance_time_mapUpdateManyAndReturnArgs} args - Arguments to update many Instance_time_maps.
     * @example
     * // Update many Instance_time_maps
     * const instance_time_map = await prisma.instance_time_map.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Instance_time_maps and only return the `minute_of_day`
     * const instance_time_mapWithMinute_of_dayOnly = await prisma.instance_time_map.updateManyAndReturn({
     *   select: { minute_of_day: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends instance_time_mapUpdateManyAndReturnArgs>(args: SelectSubset<T, instance_time_mapUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$instance_time_mapPayload<ExtArgs>, T, "updateManyAndReturn", ClientOptions>>

    /**
     * Create or update one Instance_time_map.
     * @param {instance_time_mapUpsertArgs} args - Arguments to update or create a Instance_time_map.
     * @example
     * // Update or create a Instance_time_map
     * const instance_time_map = await prisma.instance_time_map.upsert({
     *   create: {
     *     // ... data to create a Instance_time_map
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Instance_time_map we want to update
     *   }
     * })
     */
    upsert<T extends instance_time_mapUpsertArgs>(args: SelectSubset<T, instance_time_mapUpsertArgs<ExtArgs>>): Prisma__instance_time_mapClient<$Result.GetResult<Prisma.$instance_time_mapPayload<ExtArgs>, T, "upsert", ClientOptions>, never, ExtArgs, ClientOptions>


    /**
     * Count the number of Instance_time_maps.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {instance_time_mapCountArgs} args - Arguments to filter Instance_time_maps to count.
     * @example
     * // Count the number of Instance_time_maps
     * const count = await prisma.instance_time_map.count({
     *   where: {
     *     // ... the filter for the Instance_time_maps we want to count
     *   }
     * })
    **/
    count<T extends instance_time_mapCountArgs>(
      args?: Subset<T, instance_time_mapCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], Instance_time_mapCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Instance_time_map.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {Instance_time_mapAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends Instance_time_mapAggregateArgs>(args: Subset<T, Instance_time_mapAggregateArgs>): Prisma.PrismaPromise<GetInstance_time_mapAggregateType<T>>

    /**
     * Group by Instance_time_map.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {instance_time_mapGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends instance_time_mapGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: instance_time_mapGroupByArgs['orderBy'] }
        : { orderBy?: instance_time_mapGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, instance_time_mapGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetInstance_time_mapGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the instance_time_map model
   */
  readonly fields: instance_time_mapFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for instance_time_map.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__instance_time_mapClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the instance_time_map model
   */ 
  interface instance_time_mapFieldRefs {
    readonly minute_of_day: FieldRef<"instance_time_map", 'Int'>
    readonly games_in_minute: FieldRef<"instance_time_map", 'String[]'>
  }
    

  // Custom InputTypes
  /**
   * instance_time_map findUnique
   */
  export type instance_time_mapFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the instance_time_map
     */
    select?: instance_time_mapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the instance_time_map
     */
    omit?: instance_time_mapOmit<ExtArgs> | null
    /**
     * Filter, which instance_time_map to fetch.
     */
    where: instance_time_mapWhereUniqueInput
  }

  /**
   * instance_time_map findUniqueOrThrow
   */
  export type instance_time_mapFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the instance_time_map
     */
    select?: instance_time_mapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the instance_time_map
     */
    omit?: instance_time_mapOmit<ExtArgs> | null
    /**
     * Filter, which instance_time_map to fetch.
     */
    where: instance_time_mapWhereUniqueInput
  }

  /**
   * instance_time_map findFirst
   */
  export type instance_time_mapFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the instance_time_map
     */
    select?: instance_time_mapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the instance_time_map
     */
    omit?: instance_time_mapOmit<ExtArgs> | null
    /**
     * Filter, which instance_time_map to fetch.
     */
    where?: instance_time_mapWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of instance_time_maps to fetch.
     */
    orderBy?: instance_time_mapOrderByWithRelationInput | instance_time_mapOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for instance_time_maps.
     */
    cursor?: instance_time_mapWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` instance_time_maps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` instance_time_maps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of instance_time_maps.
     */
    distinct?: Instance_time_mapScalarFieldEnum | Instance_time_mapScalarFieldEnum[]
  }

  /**
   * instance_time_map findFirstOrThrow
   */
  export type instance_time_mapFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the instance_time_map
     */
    select?: instance_time_mapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the instance_time_map
     */
    omit?: instance_time_mapOmit<ExtArgs> | null
    /**
     * Filter, which instance_time_map to fetch.
     */
    where?: instance_time_mapWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of instance_time_maps to fetch.
     */
    orderBy?: instance_time_mapOrderByWithRelationInput | instance_time_mapOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for instance_time_maps.
     */
    cursor?: instance_time_mapWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` instance_time_maps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` instance_time_maps.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of instance_time_maps.
     */
    distinct?: Instance_time_mapScalarFieldEnum | Instance_time_mapScalarFieldEnum[]
  }

  /**
   * instance_time_map findMany
   */
  export type instance_time_mapFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the instance_time_map
     */
    select?: instance_time_mapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the instance_time_map
     */
    omit?: instance_time_mapOmit<ExtArgs> | null
    /**
     * Filter, which instance_time_maps to fetch.
     */
    where?: instance_time_mapWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of instance_time_maps to fetch.
     */
    orderBy?: instance_time_mapOrderByWithRelationInput | instance_time_mapOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing instance_time_maps.
     */
    cursor?: instance_time_mapWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` instance_time_maps from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` instance_time_maps.
     */
    skip?: number
    distinct?: Instance_time_mapScalarFieldEnum | Instance_time_mapScalarFieldEnum[]
  }

  /**
   * instance_time_map create
   */
  export type instance_time_mapCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the instance_time_map
     */
    select?: instance_time_mapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the instance_time_map
     */
    omit?: instance_time_mapOmit<ExtArgs> | null
    /**
     * The data needed to create a instance_time_map.
     */
    data: XOR<instance_time_mapCreateInput, instance_time_mapUncheckedCreateInput>
  }

  /**
   * instance_time_map createMany
   */
  export type instance_time_mapCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many instance_time_maps.
     */
    data: instance_time_mapCreateManyInput | instance_time_mapCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * instance_time_map createManyAndReturn
   */
  export type instance_time_mapCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the instance_time_map
     */
    select?: instance_time_mapSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the instance_time_map
     */
    omit?: instance_time_mapOmit<ExtArgs> | null
    /**
     * The data used to create many instance_time_maps.
     */
    data: instance_time_mapCreateManyInput | instance_time_mapCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * instance_time_map update
   */
  export type instance_time_mapUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the instance_time_map
     */
    select?: instance_time_mapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the instance_time_map
     */
    omit?: instance_time_mapOmit<ExtArgs> | null
    /**
     * The data needed to update a instance_time_map.
     */
    data: XOR<instance_time_mapUpdateInput, instance_time_mapUncheckedUpdateInput>
    /**
     * Choose, which instance_time_map to update.
     */
    where: instance_time_mapWhereUniqueInput
  }

  /**
   * instance_time_map updateMany
   */
  export type instance_time_mapUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update instance_time_maps.
     */
    data: XOR<instance_time_mapUpdateManyMutationInput, instance_time_mapUncheckedUpdateManyInput>
    /**
     * Filter which instance_time_maps to update
     */
    where?: instance_time_mapWhereInput
  }

  /**
   * instance_time_map updateManyAndReturn
   */
  export type instance_time_mapUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the instance_time_map
     */
    select?: instance_time_mapSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the instance_time_map
     */
    omit?: instance_time_mapOmit<ExtArgs> | null
    /**
     * The data used to update instance_time_maps.
     */
    data: XOR<instance_time_mapUpdateManyMutationInput, instance_time_mapUncheckedUpdateManyInput>
    /**
     * Filter which instance_time_maps to update
     */
    where?: instance_time_mapWhereInput
  }

  /**
   * instance_time_map upsert
   */
  export type instance_time_mapUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the instance_time_map
     */
    select?: instance_time_mapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the instance_time_map
     */
    omit?: instance_time_mapOmit<ExtArgs> | null
    /**
     * The filter to search for the instance_time_map to update in case it exists.
     */
    where: instance_time_mapWhereUniqueInput
    /**
     * In case the instance_time_map found by the `where` argument doesn't exist, create a new instance_time_map with this data.
     */
    create: XOR<instance_time_mapCreateInput, instance_time_mapUncheckedCreateInput>
    /**
     * In case the instance_time_map was found with the provided `where` argument, update it with this data.
     */
    update: XOR<instance_time_mapUpdateInput, instance_time_mapUncheckedUpdateInput>
  }

  /**
   * instance_time_map delete
   */
  export type instance_time_mapDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the instance_time_map
     */
    select?: instance_time_mapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the instance_time_map
     */
    omit?: instance_time_mapOmit<ExtArgs> | null
    /**
     * Filter which instance_time_map to delete.
     */
    where: instance_time_mapWhereUniqueInput
  }

  /**
   * instance_time_map deleteMany
   */
  export type instance_time_mapDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which instance_time_maps to delete
     */
    where?: instance_time_mapWhereInput
  }

  /**
   * instance_time_map without action
   */
  export type instance_time_mapDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the instance_time_map
     */
    select?: instance_time_mapSelect<ExtArgs> | null
    /**
     * Omit specific fields from the instance_time_map
     */
    omit?: instance_time_mapOmit<ExtArgs> | null
  }


  /**
   * Model users
   */

  export type AggregateUsers = {
    _count: UsersCountAggregateOutputType | null
    _min: UsersMinAggregateOutputType | null
    _max: UsersMaxAggregateOutputType | null
  }

  export type UsersMinAggregateOutputType = {
    id: string | null
    first_name: string | null
    last_name: string | null
    email: string | null
    created_on: Date | null
    password: string | null
    player_name: string | null
    role: string | null
    thumbnail: string | null
  }

  export type UsersMaxAggregateOutputType = {
    id: string | null
    first_name: string | null
    last_name: string | null
    email: string | null
    created_on: Date | null
    password: string | null
    player_name: string | null
    role: string | null
    thumbnail: string | null
  }

  export type UsersCountAggregateOutputType = {
    id: number
    first_name: number
    last_name: number
    email: number
    created_on: number
    password: number
    player_name: number
    active_games: number
    friends: number
    role: number
    thumbnail: number
    _all: number
  }


  export type UsersMinAggregateInputType = {
    id?: true
    first_name?: true
    last_name?: true
    email?: true
    created_on?: true
    password?: true
    player_name?: true
    role?: true
    thumbnail?: true
  }

  export type UsersMaxAggregateInputType = {
    id?: true
    first_name?: true
    last_name?: true
    email?: true
    created_on?: true
    password?: true
    player_name?: true
    role?: true
    thumbnail?: true
  }

  export type UsersCountAggregateInputType = {
    id?: true
    first_name?: true
    last_name?: true
    email?: true
    created_on?: true
    password?: true
    player_name?: true
    active_games?: true
    friends?: true
    role?: true
    thumbnail?: true
    _all?: true
  }

  export type UsersAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which users to aggregate.
     */
    where?: usersWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of users to fetch.
     */
    orderBy?: usersOrderByWithRelationInput | usersOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: usersWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned users
    **/
    _count?: true | UsersCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UsersMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UsersMaxAggregateInputType
  }

  export type GetUsersAggregateType<T extends UsersAggregateArgs> = {
        [P in keyof T & keyof AggregateUsers]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUsers[P]>
      : GetScalarType<T[P], AggregateUsers[P]>
  }




  export type usersGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: usersWhereInput
    orderBy?: usersOrderByWithAggregationInput | usersOrderByWithAggregationInput[]
    by: UsersScalarFieldEnum[] | UsersScalarFieldEnum
    having?: usersScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UsersCountAggregateInputType | true
    _min?: UsersMinAggregateInputType
    _max?: UsersMaxAggregateInputType
  }

  export type UsersGroupByOutputType = {
    id: string
    first_name: string
    last_name: string
    email: string
    created_on: Date
    password: string
    player_name: string
    active_games: string[]
    friends: string[]
    role: string
    thumbnail: string | null
    _count: UsersCountAggregateOutputType | null
    _min: UsersMinAggregateOutputType | null
    _max: UsersMaxAggregateOutputType | null
  }

  type GetUsersGroupByPayload<T extends usersGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UsersGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UsersGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UsersGroupByOutputType[P]>
            : GetScalarType<T[P], UsersGroupByOutputType[P]>
        }
      >
    >


  export type usersSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    first_name?: boolean
    last_name?: boolean
    email?: boolean
    created_on?: boolean
    password?: boolean
    player_name?: boolean
    active_games?: boolean
    friends?: boolean
    role?: boolean
    thumbnail?: boolean
  }, ExtArgs["result"]["users"]>

  export type usersSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    first_name?: boolean
    last_name?: boolean
    email?: boolean
    created_on?: boolean
    password?: boolean
    player_name?: boolean
    active_games?: boolean
    friends?: boolean
    role?: boolean
    thumbnail?: boolean
  }, ExtArgs["result"]["users"]>

  export type usersSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    first_name?: boolean
    last_name?: boolean
    email?: boolean
    created_on?: boolean
    password?: boolean
    player_name?: boolean
    active_games?: boolean
    friends?: boolean
    role?: boolean
    thumbnail?: boolean
  }, ExtArgs["result"]["users"]>

  export type usersSelectScalar = {
    id?: boolean
    first_name?: boolean
    last_name?: boolean
    email?: boolean
    created_on?: boolean
    password?: boolean
    player_name?: boolean
    active_games?: boolean
    friends?: boolean
    role?: boolean
    thumbnail?: boolean
  }

  export type usersOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "first_name" | "last_name" | "email" | "created_on" | "password" | "player_name" | "active_games" | "friends" | "role" | "thumbnail", ExtArgs["result"]["users"]>

  export type $usersPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "users"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      first_name: string
      last_name: string
      email: string
      created_on: Date
      password: string
      player_name: string
      active_games: string[]
      friends: string[]
      role: string
      thumbnail: string | null
    }, ExtArgs["result"]["users"]>
    composites: {}
  }

  type usersGetPayload<S extends boolean | null | undefined | usersDefaultArgs> = $Result.GetResult<Prisma.$usersPayload, S>

  type usersCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<usersFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UsersCountAggregateInputType | true
    }

  export interface usersDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['users'], meta: { name: 'users' } }
    /**
     * Find zero or one Users that matches the filter.
     * @param {usersFindUniqueArgs} args - Arguments to find a Users
     * @example
     * // Get one Users
     * const users = await prisma.users.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends usersFindUniqueArgs>(args: SelectSubset<T, usersFindUniqueArgs<ExtArgs>>): Prisma__usersClient<$Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "findUnique", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find one Users that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {usersFindUniqueOrThrowArgs} args - Arguments to find a Users
     * @example
     * // Get one Users
     * const users = await prisma.users.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends usersFindUniqueOrThrowArgs>(args: SelectSubset<T, usersFindUniqueOrThrowArgs<ExtArgs>>): Prisma__usersClient<$Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find the first Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {usersFindFirstArgs} args - Arguments to find a Users
     * @example
     * // Get one Users
     * const users = await prisma.users.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends usersFindFirstArgs>(args?: SelectSubset<T, usersFindFirstArgs<ExtArgs>>): Prisma__usersClient<$Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "findFirst", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find the first Users that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {usersFindFirstOrThrowArgs} args - Arguments to find a Users
     * @example
     * // Get one Users
     * const users = await prisma.users.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends usersFindFirstOrThrowArgs>(args?: SelectSubset<T, usersFindFirstOrThrowArgs<ExtArgs>>): Prisma__usersClient<$Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "findFirstOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {usersFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.users.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.users.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const usersWithIdOnly = await prisma.users.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends usersFindManyArgs>(args?: SelectSubset<T, usersFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "findMany", ClientOptions>>

    /**
     * Create a Users.
     * @param {usersCreateArgs} args - Arguments to create a Users.
     * @example
     * // Create one Users
     * const Users = await prisma.users.create({
     *   data: {
     *     // ... data to create a Users
     *   }
     * })
     * 
     */
    create<T extends usersCreateArgs>(args: SelectSubset<T, usersCreateArgs<ExtArgs>>): Prisma__usersClient<$Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "create", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Create many Users.
     * @param {usersCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const users = await prisma.users.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends usersCreateManyArgs>(args?: SelectSubset<T, usersCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {usersCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const users = await prisma.users.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const usersWithIdOnly = await prisma.users.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends usersCreateManyAndReturnArgs>(args?: SelectSubset<T, usersCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "createManyAndReturn", ClientOptions>>

    /**
     * Delete a Users.
     * @param {usersDeleteArgs} args - Arguments to delete one Users.
     * @example
     * // Delete one Users
     * const Users = await prisma.users.delete({
     *   where: {
     *     // ... filter to delete one Users
     *   }
     * })
     * 
     */
    delete<T extends usersDeleteArgs>(args: SelectSubset<T, usersDeleteArgs<ExtArgs>>): Prisma__usersClient<$Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "delete", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Update one Users.
     * @param {usersUpdateArgs} args - Arguments to update one Users.
     * @example
     * // Update one Users
     * const users = await prisma.users.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends usersUpdateArgs>(args: SelectSubset<T, usersUpdateArgs<ExtArgs>>): Prisma__usersClient<$Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "update", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Delete zero or more Users.
     * @param {usersDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.users.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends usersDeleteManyArgs>(args?: SelectSubset<T, usersDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {usersUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const users = await prisma.users.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends usersUpdateManyArgs>(args: SelectSubset<T, usersUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {usersUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const users = await prisma.users.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `id`
     * const usersWithIdOnly = await prisma.users.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends usersUpdateManyAndReturnArgs>(args: SelectSubset<T, usersUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "updateManyAndReturn", ClientOptions>>

    /**
     * Create or update one Users.
     * @param {usersUpsertArgs} args - Arguments to update or create a Users.
     * @example
     * // Update or create a Users
     * const users = await prisma.users.upsert({
     *   create: {
     *     // ... data to create a Users
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Users we want to update
     *   }
     * })
     */
    upsert<T extends usersUpsertArgs>(args: SelectSubset<T, usersUpsertArgs<ExtArgs>>): Prisma__usersClient<$Result.GetResult<Prisma.$usersPayload<ExtArgs>, T, "upsert", ClientOptions>, never, ExtArgs, ClientOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {usersCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.users.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends usersCountArgs>(
      args?: Subset<T, usersCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UsersCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UsersAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UsersAggregateArgs>(args: Subset<T, UsersAggregateArgs>): Prisma.PrismaPromise<GetUsersAggregateType<T>>

    /**
     * Group by Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {usersGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends usersGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: usersGroupByArgs['orderBy'] }
        : { orderBy?: usersGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, usersGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUsersGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the users model
   */
  readonly fields: usersFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for users.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__usersClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the users model
   */ 
  interface usersFieldRefs {
    readonly id: FieldRef<"users", 'String'>
    readonly first_name: FieldRef<"users", 'String'>
    readonly last_name: FieldRef<"users", 'String'>
    readonly email: FieldRef<"users", 'String'>
    readonly created_on: FieldRef<"users", 'DateTime'>
    readonly password: FieldRef<"users", 'String'>
    readonly player_name: FieldRef<"users", 'String'>
    readonly active_games: FieldRef<"users", 'String[]'>
    readonly friends: FieldRef<"users", 'String[]'>
    readonly role: FieldRef<"users", 'String'>
    readonly thumbnail: FieldRef<"users", 'String'>
  }
    

  // Custom InputTypes
  /**
   * users findUnique
   */
  export type usersFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the users
     */
    select?: usersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the users
     */
    omit?: usersOmit<ExtArgs> | null
    /**
     * Filter, which users to fetch.
     */
    where: usersWhereUniqueInput
  }

  /**
   * users findUniqueOrThrow
   */
  export type usersFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the users
     */
    select?: usersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the users
     */
    omit?: usersOmit<ExtArgs> | null
    /**
     * Filter, which users to fetch.
     */
    where: usersWhereUniqueInput
  }

  /**
   * users findFirst
   */
  export type usersFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the users
     */
    select?: usersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the users
     */
    omit?: usersOmit<ExtArgs> | null
    /**
     * Filter, which users to fetch.
     */
    where?: usersWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of users to fetch.
     */
    orderBy?: usersOrderByWithRelationInput | usersOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for users.
     */
    cursor?: usersWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of users.
     */
    distinct?: UsersScalarFieldEnum | UsersScalarFieldEnum[]
  }

  /**
   * users findFirstOrThrow
   */
  export type usersFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the users
     */
    select?: usersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the users
     */
    omit?: usersOmit<ExtArgs> | null
    /**
     * Filter, which users to fetch.
     */
    where?: usersWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of users to fetch.
     */
    orderBy?: usersOrderByWithRelationInput | usersOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for users.
     */
    cursor?: usersWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of users.
     */
    distinct?: UsersScalarFieldEnum | UsersScalarFieldEnum[]
  }

  /**
   * users findMany
   */
  export type usersFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the users
     */
    select?: usersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the users
     */
    omit?: usersOmit<ExtArgs> | null
    /**
     * Filter, which users to fetch.
     */
    where?: usersWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of users to fetch.
     */
    orderBy?: usersOrderByWithRelationInput | usersOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing users.
     */
    cursor?: usersWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` users.
     */
    skip?: number
    distinct?: UsersScalarFieldEnum | UsersScalarFieldEnum[]
  }

  /**
   * users create
   */
  export type usersCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the users
     */
    select?: usersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the users
     */
    omit?: usersOmit<ExtArgs> | null
    /**
     * The data needed to create a users.
     */
    data: XOR<usersCreateInput, usersUncheckedCreateInput>
  }

  /**
   * users createMany
   */
  export type usersCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many users.
     */
    data: usersCreateManyInput | usersCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * users createManyAndReturn
   */
  export type usersCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the users
     */
    select?: usersSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the users
     */
    omit?: usersOmit<ExtArgs> | null
    /**
     * The data used to create many users.
     */
    data: usersCreateManyInput | usersCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * users update
   */
  export type usersUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the users
     */
    select?: usersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the users
     */
    omit?: usersOmit<ExtArgs> | null
    /**
     * The data needed to update a users.
     */
    data: XOR<usersUpdateInput, usersUncheckedUpdateInput>
    /**
     * Choose, which users to update.
     */
    where: usersWhereUniqueInput
  }

  /**
   * users updateMany
   */
  export type usersUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update users.
     */
    data: XOR<usersUpdateManyMutationInput, usersUncheckedUpdateManyInput>
    /**
     * Filter which users to update
     */
    where?: usersWhereInput
  }

  /**
   * users updateManyAndReturn
   */
  export type usersUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the users
     */
    select?: usersSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the users
     */
    omit?: usersOmit<ExtArgs> | null
    /**
     * The data used to update users.
     */
    data: XOR<usersUpdateManyMutationInput, usersUncheckedUpdateManyInput>
    /**
     * Filter which users to update
     */
    where?: usersWhereInput
  }

  /**
   * users upsert
   */
  export type usersUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the users
     */
    select?: usersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the users
     */
    omit?: usersOmit<ExtArgs> | null
    /**
     * The filter to search for the users to update in case it exists.
     */
    where: usersWhereUniqueInput
    /**
     * In case the users found by the `where` argument doesn't exist, create a new users with this data.
     */
    create: XOR<usersCreateInput, usersUncheckedCreateInput>
    /**
     * In case the users was found with the provided `where` argument, update it with this data.
     */
    update: XOR<usersUpdateInput, usersUncheckedUpdateInput>
  }

  /**
   * users delete
   */
  export type usersDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the users
     */
    select?: usersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the users
     */
    omit?: usersOmit<ExtArgs> | null
    /**
     * Filter which users to delete.
     */
    where: usersWhereUniqueInput
  }

  /**
   * users deleteMany
   */
  export type usersDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which users to delete
     */
    where?: usersWhereInput
  }

  /**
   * users without action
   */
  export type usersDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the users
     */
    select?: usersSelect<ExtArgs> | null
    /**
     * Omit specific fields from the users
     */
    omit?: usersOmit<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const Active_game_stateScalarFieldEnum: {
    game_id: 'game_id',
    players_array: 'players_array',
    player_in_turn: 'player_in_turn',
    special_space_values: 'special_space_values',
    special_space_dump_values: 'special_space_dump_values'
  };

  export type Active_game_stateScalarFieldEnum = (typeof Active_game_stateScalarFieldEnum)[keyof typeof Active_game_stateScalarFieldEnum]


  export const Instance_time_mapScalarFieldEnum: {
    minute_of_day: 'minute_of_day',
    games_in_minute: 'games_in_minute'
  };

  export type Instance_time_mapScalarFieldEnum = (typeof Instance_time_mapScalarFieldEnum)[keyof typeof Instance_time_mapScalarFieldEnum]


  export const UsersScalarFieldEnum: {
    id: 'id',
    first_name: 'first_name',
    last_name: 'last_name',
    email: 'email',
    created_on: 'created_on',
    password: 'password',
    player_name: 'player_name',
    active_games: 'active_games',
    friends: 'friends',
    role: 'role',
    thumbnail: 'thumbnail'
  };

  export type UsersScalarFieldEnum = (typeof UsersScalarFieldEnum)[keyof typeof UsersScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references 
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'Json[]'
   */
  export type ListJsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json[]'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type active_game_stateWhereInput = {
    AND?: active_game_stateWhereInput | active_game_stateWhereInput[]
    OR?: active_game_stateWhereInput[]
    NOT?: active_game_stateWhereInput | active_game_stateWhereInput[]
    game_id?: StringFilter<"active_game_state"> | string
    players_array?: JsonNullableListFilter<"active_game_state">
    player_in_turn?: IntFilter<"active_game_state"> | number
    special_space_values?: IntNullableListFilter<"active_game_state">
    special_space_dump_values?: IntNullableListFilter<"active_game_state">
  }

  export type active_game_stateOrderByWithRelationInput = {
    game_id?: SortOrder
    players_array?: SortOrder
    player_in_turn?: SortOrder
    special_space_values?: SortOrder
    special_space_dump_values?: SortOrder
  }

  export type active_game_stateWhereUniqueInput = Prisma.AtLeast<{
    game_id?: string
    AND?: active_game_stateWhereInput | active_game_stateWhereInput[]
    OR?: active_game_stateWhereInput[]
    NOT?: active_game_stateWhereInput | active_game_stateWhereInput[]
    players_array?: JsonNullableListFilter<"active_game_state">
    player_in_turn?: IntFilter<"active_game_state"> | number
    special_space_values?: IntNullableListFilter<"active_game_state">
    special_space_dump_values?: IntNullableListFilter<"active_game_state">
  }, "game_id">

  export type active_game_stateOrderByWithAggregationInput = {
    game_id?: SortOrder
    players_array?: SortOrder
    player_in_turn?: SortOrder
    special_space_values?: SortOrder
    special_space_dump_values?: SortOrder
    _count?: active_game_stateCountOrderByAggregateInput
    _avg?: active_game_stateAvgOrderByAggregateInput
    _max?: active_game_stateMaxOrderByAggregateInput
    _min?: active_game_stateMinOrderByAggregateInput
    _sum?: active_game_stateSumOrderByAggregateInput
  }

  export type active_game_stateScalarWhereWithAggregatesInput = {
    AND?: active_game_stateScalarWhereWithAggregatesInput | active_game_stateScalarWhereWithAggregatesInput[]
    OR?: active_game_stateScalarWhereWithAggregatesInput[]
    NOT?: active_game_stateScalarWhereWithAggregatesInput | active_game_stateScalarWhereWithAggregatesInput[]
    game_id?: StringWithAggregatesFilter<"active_game_state"> | string
    players_array?: JsonNullableListFilter<"active_game_state">
    player_in_turn?: IntWithAggregatesFilter<"active_game_state"> | number
    special_space_values?: IntNullableListFilter<"active_game_state">
    special_space_dump_values?: IntNullableListFilter<"active_game_state">
  }

  export type instance_time_mapWhereInput = {
    AND?: instance_time_mapWhereInput | instance_time_mapWhereInput[]
    OR?: instance_time_mapWhereInput[]
    NOT?: instance_time_mapWhereInput | instance_time_mapWhereInput[]
    minute_of_day?: IntFilter<"instance_time_map"> | number
    games_in_minute?: StringNullableListFilter<"instance_time_map">
  }

  export type instance_time_mapOrderByWithRelationInput = {
    minute_of_day?: SortOrder
    games_in_minute?: SortOrder
  }

  export type instance_time_mapWhereUniqueInput = Prisma.AtLeast<{
    minute_of_day?: number
    AND?: instance_time_mapWhereInput | instance_time_mapWhereInput[]
    OR?: instance_time_mapWhereInput[]
    NOT?: instance_time_mapWhereInput | instance_time_mapWhereInput[]
    games_in_minute?: StringNullableListFilter<"instance_time_map">
  }, "minute_of_day">

  export type instance_time_mapOrderByWithAggregationInput = {
    minute_of_day?: SortOrder
    games_in_minute?: SortOrder
    _count?: instance_time_mapCountOrderByAggregateInput
    _avg?: instance_time_mapAvgOrderByAggregateInput
    _max?: instance_time_mapMaxOrderByAggregateInput
    _min?: instance_time_mapMinOrderByAggregateInput
    _sum?: instance_time_mapSumOrderByAggregateInput
  }

  export type instance_time_mapScalarWhereWithAggregatesInput = {
    AND?: instance_time_mapScalarWhereWithAggregatesInput | instance_time_mapScalarWhereWithAggregatesInput[]
    OR?: instance_time_mapScalarWhereWithAggregatesInput[]
    NOT?: instance_time_mapScalarWhereWithAggregatesInput | instance_time_mapScalarWhereWithAggregatesInput[]
    minute_of_day?: IntWithAggregatesFilter<"instance_time_map"> | number
    games_in_minute?: StringNullableListFilter<"instance_time_map">
  }

  export type usersWhereInput = {
    AND?: usersWhereInput | usersWhereInput[]
    OR?: usersWhereInput[]
    NOT?: usersWhereInput | usersWhereInput[]
    id?: StringFilter<"users"> | string
    first_name?: StringFilter<"users"> | string
    last_name?: StringFilter<"users"> | string
    email?: StringFilter<"users"> | string
    created_on?: DateTimeFilter<"users"> | Date | string
    password?: StringFilter<"users"> | string
    player_name?: StringFilter<"users"> | string
    active_games?: StringNullableListFilter<"users">
    friends?: StringNullableListFilter<"users">
    role?: StringFilter<"users"> | string
    thumbnail?: StringNullableFilter<"users"> | string | null
  }

  export type usersOrderByWithRelationInput = {
    id?: SortOrder
    first_name?: SortOrder
    last_name?: SortOrder
    email?: SortOrder
    created_on?: SortOrder
    password?: SortOrder
    player_name?: SortOrder
    active_games?: SortOrder
    friends?: SortOrder
    role?: SortOrder
    thumbnail?: SortOrderInput | SortOrder
  }

  export type usersWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    thumbnail?: string
    AND?: usersWhereInput | usersWhereInput[]
    OR?: usersWhereInput[]
    NOT?: usersWhereInput | usersWhereInput[]
    first_name?: StringFilter<"users"> | string
    last_name?: StringFilter<"users"> | string
    created_on?: DateTimeFilter<"users"> | Date | string
    password?: StringFilter<"users"> | string
    player_name?: StringFilter<"users"> | string
    active_games?: StringNullableListFilter<"users">
    friends?: StringNullableListFilter<"users">
    role?: StringFilter<"users"> | string
  }, "id" | "email" | "thumbnail">

  export type usersOrderByWithAggregationInput = {
    id?: SortOrder
    first_name?: SortOrder
    last_name?: SortOrder
    email?: SortOrder
    created_on?: SortOrder
    password?: SortOrder
    player_name?: SortOrder
    active_games?: SortOrder
    friends?: SortOrder
    role?: SortOrder
    thumbnail?: SortOrderInput | SortOrder
    _count?: usersCountOrderByAggregateInput
    _max?: usersMaxOrderByAggregateInput
    _min?: usersMinOrderByAggregateInput
  }

  export type usersScalarWhereWithAggregatesInput = {
    AND?: usersScalarWhereWithAggregatesInput | usersScalarWhereWithAggregatesInput[]
    OR?: usersScalarWhereWithAggregatesInput[]
    NOT?: usersScalarWhereWithAggregatesInput | usersScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"users"> | string
    first_name?: StringWithAggregatesFilter<"users"> | string
    last_name?: StringWithAggregatesFilter<"users"> | string
    email?: StringWithAggregatesFilter<"users"> | string
    created_on?: DateTimeWithAggregatesFilter<"users"> | Date | string
    password?: StringWithAggregatesFilter<"users"> | string
    player_name?: StringWithAggregatesFilter<"users"> | string
    active_games?: StringNullableListFilter<"users">
    friends?: StringNullableListFilter<"users">
    role?: StringWithAggregatesFilter<"users"> | string
    thumbnail?: StringNullableWithAggregatesFilter<"users"> | string | null
  }

  export type active_game_stateCreateInput = {
    game_id: string
    players_array?: active_game_stateCreateplayers_arrayInput | InputJsonValue[]
    player_in_turn: number
    special_space_values?: active_game_stateCreatespecial_space_valuesInput | number[]
    special_space_dump_values?: active_game_stateCreatespecial_space_dump_valuesInput | number[]
  }

  export type active_game_stateUncheckedCreateInput = {
    game_id: string
    players_array?: active_game_stateCreateplayers_arrayInput | InputJsonValue[]
    player_in_turn: number
    special_space_values?: active_game_stateCreatespecial_space_valuesInput | number[]
    special_space_dump_values?: active_game_stateCreatespecial_space_dump_valuesInput | number[]
  }

  export type active_game_stateUpdateInput = {
    game_id?: StringFieldUpdateOperationsInput | string
    players_array?: active_game_stateUpdateplayers_arrayInput | InputJsonValue[]
    player_in_turn?: IntFieldUpdateOperationsInput | number
    special_space_values?: active_game_stateUpdatespecial_space_valuesInput | number[]
    special_space_dump_values?: active_game_stateUpdatespecial_space_dump_valuesInput | number[]
  }

  export type active_game_stateUncheckedUpdateInput = {
    game_id?: StringFieldUpdateOperationsInput | string
    players_array?: active_game_stateUpdateplayers_arrayInput | InputJsonValue[]
    player_in_turn?: IntFieldUpdateOperationsInput | number
    special_space_values?: active_game_stateUpdatespecial_space_valuesInput | number[]
    special_space_dump_values?: active_game_stateUpdatespecial_space_dump_valuesInput | number[]
  }

  export type active_game_stateCreateManyInput = {
    game_id: string
    players_array?: active_game_stateCreateplayers_arrayInput | InputJsonValue[]
    player_in_turn: number
    special_space_values?: active_game_stateCreatespecial_space_valuesInput | number[]
    special_space_dump_values?: active_game_stateCreatespecial_space_dump_valuesInput | number[]
  }

  export type active_game_stateUpdateManyMutationInput = {
    game_id?: StringFieldUpdateOperationsInput | string
    players_array?: active_game_stateUpdateplayers_arrayInput | InputJsonValue[]
    player_in_turn?: IntFieldUpdateOperationsInput | number
    special_space_values?: active_game_stateUpdatespecial_space_valuesInput | number[]
    special_space_dump_values?: active_game_stateUpdatespecial_space_dump_valuesInput | number[]
  }

  export type active_game_stateUncheckedUpdateManyInput = {
    game_id?: StringFieldUpdateOperationsInput | string
    players_array?: active_game_stateUpdateplayers_arrayInput | InputJsonValue[]
    player_in_turn?: IntFieldUpdateOperationsInput | number
    special_space_values?: active_game_stateUpdatespecial_space_valuesInput | number[]
    special_space_dump_values?: active_game_stateUpdatespecial_space_dump_valuesInput | number[]
  }

  export type instance_time_mapCreateInput = {
    minute_of_day: number
    games_in_minute?: instance_time_mapCreategames_in_minuteInput | string[]
  }

  export type instance_time_mapUncheckedCreateInput = {
    minute_of_day: number
    games_in_minute?: instance_time_mapCreategames_in_minuteInput | string[]
  }

  export type instance_time_mapUpdateInput = {
    minute_of_day?: IntFieldUpdateOperationsInput | number
    games_in_minute?: instance_time_mapUpdategames_in_minuteInput | string[]
  }

  export type instance_time_mapUncheckedUpdateInput = {
    minute_of_day?: IntFieldUpdateOperationsInput | number
    games_in_minute?: instance_time_mapUpdategames_in_minuteInput | string[]
  }

  export type instance_time_mapCreateManyInput = {
    minute_of_day: number
    games_in_minute?: instance_time_mapCreategames_in_minuteInput | string[]
  }

  export type instance_time_mapUpdateManyMutationInput = {
    minute_of_day?: IntFieldUpdateOperationsInput | number
    games_in_minute?: instance_time_mapUpdategames_in_minuteInput | string[]
  }

  export type instance_time_mapUncheckedUpdateManyInput = {
    minute_of_day?: IntFieldUpdateOperationsInput | number
    games_in_minute?: instance_time_mapUpdategames_in_minuteInput | string[]
  }

  export type usersCreateInput = {
    id: string
    first_name: string
    last_name: string
    email: string
    created_on: Date | string
    password: string
    player_name: string
    active_games?: usersCreateactive_gamesInput | string[]
    friends?: usersCreatefriendsInput | string[]
    role: string
    thumbnail?: string | null
  }

  export type usersUncheckedCreateInput = {
    id: string
    first_name: string
    last_name: string
    email: string
    created_on: Date | string
    password: string
    player_name: string
    active_games?: usersCreateactive_gamesInput | string[]
    friends?: usersCreatefriendsInput | string[]
    role: string
    thumbnail?: string | null
  }

  export type usersUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    created_on?: DateTimeFieldUpdateOperationsInput | Date | string
    password?: StringFieldUpdateOperationsInput | string
    player_name?: StringFieldUpdateOperationsInput | string
    active_games?: usersUpdateactive_gamesInput | string[]
    friends?: usersUpdatefriendsInput | string[]
    role?: StringFieldUpdateOperationsInput | string
    thumbnail?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type usersUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    created_on?: DateTimeFieldUpdateOperationsInput | Date | string
    password?: StringFieldUpdateOperationsInput | string
    player_name?: StringFieldUpdateOperationsInput | string
    active_games?: usersUpdateactive_gamesInput | string[]
    friends?: usersUpdatefriendsInput | string[]
    role?: StringFieldUpdateOperationsInput | string
    thumbnail?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type usersCreateManyInput = {
    id: string
    first_name: string
    last_name: string
    email: string
    created_on: Date | string
    password: string
    player_name: string
    active_games?: usersCreateactive_gamesInput | string[]
    friends?: usersCreatefriendsInput | string[]
    role: string
    thumbnail?: string | null
  }

  export type usersUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    created_on?: DateTimeFieldUpdateOperationsInput | Date | string
    password?: StringFieldUpdateOperationsInput | string
    player_name?: StringFieldUpdateOperationsInput | string
    active_games?: usersUpdateactive_gamesInput | string[]
    friends?: usersUpdatefriendsInput | string[]
    role?: StringFieldUpdateOperationsInput | string
    thumbnail?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type usersUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    email?: StringFieldUpdateOperationsInput | string
    created_on?: DateTimeFieldUpdateOperationsInput | Date | string
    password?: StringFieldUpdateOperationsInput | string
    player_name?: StringFieldUpdateOperationsInput | string
    active_games?: usersUpdateactive_gamesInput | string[]
    friends?: usersUpdatefriendsInput | string[]
    role?: StringFieldUpdateOperationsInput | string
    thumbnail?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }
  export type JsonNullableListFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<JsonNullableListFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableListFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableListFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableListFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableListFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue[] | ListJsonFieldRefInput<$PrismaModel> | null
    has?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    hasEvery?: InputJsonValue[] | ListJsonFieldRefInput<$PrismaModel>
    hasSome?: InputJsonValue[] | ListJsonFieldRefInput<$PrismaModel>
    isEmpty?: boolean
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type IntNullableListFilter<$PrismaModel = never> = {
    equals?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    has?: number | IntFieldRefInput<$PrismaModel> | null
    hasEvery?: number[] | ListIntFieldRefInput<$PrismaModel>
    hasSome?: number[] | ListIntFieldRefInput<$PrismaModel>
    isEmpty?: boolean
  }

  export type active_game_stateCountOrderByAggregateInput = {
    game_id?: SortOrder
    players_array?: SortOrder
    player_in_turn?: SortOrder
    special_space_values?: SortOrder
    special_space_dump_values?: SortOrder
  }

  export type active_game_stateAvgOrderByAggregateInput = {
    player_in_turn?: SortOrder
    special_space_values?: SortOrder
    special_space_dump_values?: SortOrder
  }

  export type active_game_stateMaxOrderByAggregateInput = {
    game_id?: SortOrder
    player_in_turn?: SortOrder
  }

  export type active_game_stateMinOrderByAggregateInput = {
    game_id?: SortOrder
    player_in_turn?: SortOrder
  }

  export type active_game_stateSumOrderByAggregateInput = {
    player_in_turn?: SortOrder
    special_space_values?: SortOrder
    special_space_dump_values?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type StringNullableListFilter<$PrismaModel = never> = {
    equals?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    has?: string | StringFieldRefInput<$PrismaModel> | null
    hasEvery?: string[] | ListStringFieldRefInput<$PrismaModel>
    hasSome?: string[] | ListStringFieldRefInput<$PrismaModel>
    isEmpty?: boolean
  }

  export type instance_time_mapCountOrderByAggregateInput = {
    minute_of_day?: SortOrder
    games_in_minute?: SortOrder
  }

  export type instance_time_mapAvgOrderByAggregateInput = {
    minute_of_day?: SortOrder
  }

  export type instance_time_mapMaxOrderByAggregateInput = {
    minute_of_day?: SortOrder
  }

  export type instance_time_mapMinOrderByAggregateInput = {
    minute_of_day?: SortOrder
  }

  export type instance_time_mapSumOrderByAggregateInput = {
    minute_of_day?: SortOrder
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type usersCountOrderByAggregateInput = {
    id?: SortOrder
    first_name?: SortOrder
    last_name?: SortOrder
    email?: SortOrder
    created_on?: SortOrder
    password?: SortOrder
    player_name?: SortOrder
    active_games?: SortOrder
    friends?: SortOrder
    role?: SortOrder
    thumbnail?: SortOrder
  }

  export type usersMaxOrderByAggregateInput = {
    id?: SortOrder
    first_name?: SortOrder
    last_name?: SortOrder
    email?: SortOrder
    created_on?: SortOrder
    password?: SortOrder
    player_name?: SortOrder
    role?: SortOrder
    thumbnail?: SortOrder
  }

  export type usersMinOrderByAggregateInput = {
    id?: SortOrder
    first_name?: SortOrder
    last_name?: SortOrder
    email?: SortOrder
    created_on?: SortOrder
    password?: SortOrder
    player_name?: SortOrder
    role?: SortOrder
    thumbnail?: SortOrder
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type active_game_stateCreateplayers_arrayInput = {
    set: InputJsonValue[]
  }

  export type active_game_stateCreatespecial_space_valuesInput = {
    set: number[]
  }

  export type active_game_stateCreatespecial_space_dump_valuesInput = {
    set: number[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type active_game_stateUpdateplayers_arrayInput = {
    set?: InputJsonValue[]
    push?: InputJsonValue | InputJsonValue[]
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type active_game_stateUpdatespecial_space_valuesInput = {
    set?: number[]
    push?: number | number[]
  }

  export type active_game_stateUpdatespecial_space_dump_valuesInput = {
    set?: number[]
    push?: number | number[]
  }

  export type instance_time_mapCreategames_in_minuteInput = {
    set: string[]
  }

  export type instance_time_mapUpdategames_in_minuteInput = {
    set?: string[]
    push?: string | string[]
  }

  export type usersCreateactive_gamesInput = {
    set: string[]
  }

  export type usersCreatefriendsInput = {
    set: string[]
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type usersUpdateactive_gamesInput = {
    set?: string[]
    push?: string | string[]
  }

  export type usersUpdatefriendsInput = {
    set?: string[]
    push?: string | string[]
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}