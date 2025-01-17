
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
 * Model album
 * 
 */
export type album = $Result.DefaultSelection<Prisma.$albumPayload>
/**
 * Model artist
 * 
 */
export type artist = $Result.DefaultSelection<Prisma.$artistPayload>
/**
 * Model customer
 * 
 */
export type customer = $Result.DefaultSelection<Prisma.$customerPayload>
/**
 * Model customer_review
 * This table contains check constraints and requires additional setup for migrations. Visit https://pris.ly/d/check-constraints for more info.
 */
export type customer_review = $Result.DefaultSelection<Prisma.$customer_reviewPayload>
/**
 * Model employee
 * This table contains check constraints and requires additional setup for migrations. Visit https://pris.ly/d/check-constraints for more info.
 */
export type employee = $Result.DefaultSelection<Prisma.$employeePayload>
/**
 * Model genre
 * 
 */
export type genre = $Result.DefaultSelection<Prisma.$genrePayload>
/**
 * Model invoice
 * 
 */
export type invoice = $Result.DefaultSelection<Prisma.$invoicePayload>
/**
 * Model invoice_line
 * 
 */
export type invoice_line = $Result.DefaultSelection<Prisma.$invoice_linePayload>
/**
 * Model media_type
 * 
 */
export type media_type = $Result.DefaultSelection<Prisma.$media_typePayload>
/**
 * Model playlist
 * 
 */
export type playlist = $Result.DefaultSelection<Prisma.$playlistPayload>
/**
 * Model playlist_track
 * 
 */
export type playlist_track = $Result.DefaultSelection<Prisma.$playlist_trackPayload>
/**
 * Model track
 * 
 */
export type track = $Result.DefaultSelection<Prisma.$trackPayload>
/**
 * Model track_discount
 * This table contains check constraints and requires additional setup for migrations. Visit https://pris.ly/d/check-constraints for more info.
 */
export type track_discount = $Result.DefaultSelection<Prisma.$track_discountPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Albums
 * const albums = await prisma.album.findMany()
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
   * // Fetch zero or more Albums
   * const albums = await prisma.album.findMany()
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
   * `prisma.album`: Exposes CRUD operations for the **album** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Albums
    * const albums = await prisma.album.findMany()
    * ```
    */
  get album(): Prisma.albumDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.artist`: Exposes CRUD operations for the **artist** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Artists
    * const artists = await prisma.artist.findMany()
    * ```
    */
  get artist(): Prisma.artistDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.customer`: Exposes CRUD operations for the **customer** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Customers
    * const customers = await prisma.customer.findMany()
    * ```
    */
  get customer(): Prisma.customerDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.customer_review`: Exposes CRUD operations for the **customer_review** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Customer_reviews
    * const customer_reviews = await prisma.customer_review.findMany()
    * ```
    */
  get customer_review(): Prisma.customer_reviewDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.employee`: Exposes CRUD operations for the **employee** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Employees
    * const employees = await prisma.employee.findMany()
    * ```
    */
  get employee(): Prisma.employeeDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.genre`: Exposes CRUD operations for the **genre** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Genres
    * const genres = await prisma.genre.findMany()
    * ```
    */
  get genre(): Prisma.genreDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.invoice`: Exposes CRUD operations for the **invoice** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Invoices
    * const invoices = await prisma.invoice.findMany()
    * ```
    */
  get invoice(): Prisma.invoiceDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.invoice_line`: Exposes CRUD operations for the **invoice_line** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Invoice_lines
    * const invoice_lines = await prisma.invoice_line.findMany()
    * ```
    */
  get invoice_line(): Prisma.invoice_lineDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.media_type`: Exposes CRUD operations for the **media_type** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Media_types
    * const media_types = await prisma.media_type.findMany()
    * ```
    */
  get media_type(): Prisma.media_typeDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.playlist`: Exposes CRUD operations for the **playlist** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Playlists
    * const playlists = await prisma.playlist.findMany()
    * ```
    */
  get playlist(): Prisma.playlistDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.playlist_track`: Exposes CRUD operations for the **playlist_track** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Playlist_tracks
    * const playlist_tracks = await prisma.playlist_track.findMany()
    * ```
    */
  get playlist_track(): Prisma.playlist_trackDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.track`: Exposes CRUD operations for the **track** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Tracks
    * const tracks = await prisma.track.findMany()
    * ```
    */
  get track(): Prisma.trackDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.track_discount`: Exposes CRUD operations for the **track_discount** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Track_discounts
    * const track_discounts = await prisma.track_discount.findMany()
    * ```
    */
  get track_discount(): Prisma.track_discountDelegate<ExtArgs, ClientOptions>;
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
    album: 'album',
    artist: 'artist',
    customer: 'customer',
    customer_review: 'customer_review',
    employee: 'employee',
    genre: 'genre',
    invoice: 'invoice',
    invoice_line: 'invoice_line',
    media_type: 'media_type',
    playlist: 'playlist',
    playlist_track: 'playlist_track',
    track: 'track',
    track_discount: 'track_discount'
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
      modelProps: "album" | "artist" | "customer" | "customer_review" | "employee" | "genre" | "invoice" | "invoice_line" | "media_type" | "playlist" | "playlist_track" | "track" | "track_discount"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      album: {
        payload: Prisma.$albumPayload<ExtArgs>
        fields: Prisma.albumFieldRefs
        operations: {
          findUnique: {
            args: Prisma.albumFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$albumPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.albumFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$albumPayload>
          }
          findFirst: {
            args: Prisma.albumFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$albumPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.albumFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$albumPayload>
          }
          findMany: {
            args: Prisma.albumFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$albumPayload>[]
          }
          create: {
            args: Prisma.albumCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$albumPayload>
          }
          createMany: {
            args: Prisma.albumCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.albumCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$albumPayload>[]
          }
          delete: {
            args: Prisma.albumDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$albumPayload>
          }
          update: {
            args: Prisma.albumUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$albumPayload>
          }
          deleteMany: {
            args: Prisma.albumDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.albumUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.albumUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$albumPayload>[]
          }
          upsert: {
            args: Prisma.albumUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$albumPayload>
          }
          aggregate: {
            args: Prisma.AlbumAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAlbum>
          }
          groupBy: {
            args: Prisma.albumGroupByArgs<ExtArgs>
            result: $Utils.Optional<AlbumGroupByOutputType>[]
          }
          count: {
            args: Prisma.albumCountArgs<ExtArgs>
            result: $Utils.Optional<AlbumCountAggregateOutputType> | number
          }
        }
      }
      artist: {
        payload: Prisma.$artistPayload<ExtArgs>
        fields: Prisma.artistFieldRefs
        operations: {
          findUnique: {
            args: Prisma.artistFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$artistPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.artistFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$artistPayload>
          }
          findFirst: {
            args: Prisma.artistFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$artistPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.artistFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$artistPayload>
          }
          findMany: {
            args: Prisma.artistFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$artistPayload>[]
          }
          create: {
            args: Prisma.artistCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$artistPayload>
          }
          createMany: {
            args: Prisma.artistCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.artistCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$artistPayload>[]
          }
          delete: {
            args: Prisma.artistDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$artistPayload>
          }
          update: {
            args: Prisma.artistUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$artistPayload>
          }
          deleteMany: {
            args: Prisma.artistDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.artistUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.artistUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$artistPayload>[]
          }
          upsert: {
            args: Prisma.artistUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$artistPayload>
          }
          aggregate: {
            args: Prisma.ArtistAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateArtist>
          }
          groupBy: {
            args: Prisma.artistGroupByArgs<ExtArgs>
            result: $Utils.Optional<ArtistGroupByOutputType>[]
          }
          count: {
            args: Prisma.artistCountArgs<ExtArgs>
            result: $Utils.Optional<ArtistCountAggregateOutputType> | number
          }
        }
      }
      customer: {
        payload: Prisma.$customerPayload<ExtArgs>
        fields: Prisma.customerFieldRefs
        operations: {
          findUnique: {
            args: Prisma.customerFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customerPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.customerFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customerPayload>
          }
          findFirst: {
            args: Prisma.customerFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customerPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.customerFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customerPayload>
          }
          findMany: {
            args: Prisma.customerFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customerPayload>[]
          }
          create: {
            args: Prisma.customerCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customerPayload>
          }
          createMany: {
            args: Prisma.customerCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.customerCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customerPayload>[]
          }
          delete: {
            args: Prisma.customerDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customerPayload>
          }
          update: {
            args: Prisma.customerUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customerPayload>
          }
          deleteMany: {
            args: Prisma.customerDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.customerUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.customerUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customerPayload>[]
          }
          upsert: {
            args: Prisma.customerUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customerPayload>
          }
          aggregate: {
            args: Prisma.CustomerAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCustomer>
          }
          groupBy: {
            args: Prisma.customerGroupByArgs<ExtArgs>
            result: $Utils.Optional<CustomerGroupByOutputType>[]
          }
          count: {
            args: Prisma.customerCountArgs<ExtArgs>
            result: $Utils.Optional<CustomerCountAggregateOutputType> | number
          }
        }
      }
      customer_review: {
        payload: Prisma.$customer_reviewPayload<ExtArgs>
        fields: Prisma.customer_reviewFieldRefs
        operations: {
          findUnique: {
            args: Prisma.customer_reviewFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customer_reviewPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.customer_reviewFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customer_reviewPayload>
          }
          findFirst: {
            args: Prisma.customer_reviewFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customer_reviewPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.customer_reviewFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customer_reviewPayload>
          }
          findMany: {
            args: Prisma.customer_reviewFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customer_reviewPayload>[]
          }
          create: {
            args: Prisma.customer_reviewCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customer_reviewPayload>
          }
          createMany: {
            args: Prisma.customer_reviewCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.customer_reviewCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customer_reviewPayload>[]
          }
          delete: {
            args: Prisma.customer_reviewDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customer_reviewPayload>
          }
          update: {
            args: Prisma.customer_reviewUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customer_reviewPayload>
          }
          deleteMany: {
            args: Prisma.customer_reviewDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.customer_reviewUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.customer_reviewUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customer_reviewPayload>[]
          }
          upsert: {
            args: Prisma.customer_reviewUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$customer_reviewPayload>
          }
          aggregate: {
            args: Prisma.Customer_reviewAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCustomer_review>
          }
          groupBy: {
            args: Prisma.customer_reviewGroupByArgs<ExtArgs>
            result: $Utils.Optional<Customer_reviewGroupByOutputType>[]
          }
          count: {
            args: Prisma.customer_reviewCountArgs<ExtArgs>
            result: $Utils.Optional<Customer_reviewCountAggregateOutputType> | number
          }
        }
      }
      employee: {
        payload: Prisma.$employeePayload<ExtArgs>
        fields: Prisma.employeeFieldRefs
        operations: {
          findUnique: {
            args: Prisma.employeeFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$employeePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.employeeFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$employeePayload>
          }
          findFirst: {
            args: Prisma.employeeFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$employeePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.employeeFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$employeePayload>
          }
          findMany: {
            args: Prisma.employeeFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$employeePayload>[]
          }
          create: {
            args: Prisma.employeeCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$employeePayload>
          }
          createMany: {
            args: Prisma.employeeCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.employeeCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$employeePayload>[]
          }
          delete: {
            args: Prisma.employeeDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$employeePayload>
          }
          update: {
            args: Prisma.employeeUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$employeePayload>
          }
          deleteMany: {
            args: Prisma.employeeDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.employeeUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.employeeUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$employeePayload>[]
          }
          upsert: {
            args: Prisma.employeeUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$employeePayload>
          }
          aggregate: {
            args: Prisma.EmployeeAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateEmployee>
          }
          groupBy: {
            args: Prisma.employeeGroupByArgs<ExtArgs>
            result: $Utils.Optional<EmployeeGroupByOutputType>[]
          }
          count: {
            args: Prisma.employeeCountArgs<ExtArgs>
            result: $Utils.Optional<EmployeeCountAggregateOutputType> | number
          }
        }
      }
      genre: {
        payload: Prisma.$genrePayload<ExtArgs>
        fields: Prisma.genreFieldRefs
        operations: {
          findUnique: {
            args: Prisma.genreFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$genrePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.genreFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$genrePayload>
          }
          findFirst: {
            args: Prisma.genreFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$genrePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.genreFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$genrePayload>
          }
          findMany: {
            args: Prisma.genreFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$genrePayload>[]
          }
          create: {
            args: Prisma.genreCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$genrePayload>
          }
          createMany: {
            args: Prisma.genreCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.genreCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$genrePayload>[]
          }
          delete: {
            args: Prisma.genreDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$genrePayload>
          }
          update: {
            args: Prisma.genreUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$genrePayload>
          }
          deleteMany: {
            args: Prisma.genreDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.genreUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.genreUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$genrePayload>[]
          }
          upsert: {
            args: Prisma.genreUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$genrePayload>
          }
          aggregate: {
            args: Prisma.GenreAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateGenre>
          }
          groupBy: {
            args: Prisma.genreGroupByArgs<ExtArgs>
            result: $Utils.Optional<GenreGroupByOutputType>[]
          }
          count: {
            args: Prisma.genreCountArgs<ExtArgs>
            result: $Utils.Optional<GenreCountAggregateOutputType> | number
          }
        }
      }
      invoice: {
        payload: Prisma.$invoicePayload<ExtArgs>
        fields: Prisma.invoiceFieldRefs
        operations: {
          findUnique: {
            args: Prisma.invoiceFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoicePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.invoiceFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoicePayload>
          }
          findFirst: {
            args: Prisma.invoiceFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoicePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.invoiceFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoicePayload>
          }
          findMany: {
            args: Prisma.invoiceFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoicePayload>[]
          }
          create: {
            args: Prisma.invoiceCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoicePayload>
          }
          createMany: {
            args: Prisma.invoiceCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.invoiceCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoicePayload>[]
          }
          delete: {
            args: Prisma.invoiceDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoicePayload>
          }
          update: {
            args: Prisma.invoiceUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoicePayload>
          }
          deleteMany: {
            args: Prisma.invoiceDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.invoiceUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.invoiceUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoicePayload>[]
          }
          upsert: {
            args: Prisma.invoiceUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoicePayload>
          }
          aggregate: {
            args: Prisma.InvoiceAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateInvoice>
          }
          groupBy: {
            args: Prisma.invoiceGroupByArgs<ExtArgs>
            result: $Utils.Optional<InvoiceGroupByOutputType>[]
          }
          count: {
            args: Prisma.invoiceCountArgs<ExtArgs>
            result: $Utils.Optional<InvoiceCountAggregateOutputType> | number
          }
        }
      }
      invoice_line: {
        payload: Prisma.$invoice_linePayload<ExtArgs>
        fields: Prisma.invoice_lineFieldRefs
        operations: {
          findUnique: {
            args: Prisma.invoice_lineFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoice_linePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.invoice_lineFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoice_linePayload>
          }
          findFirst: {
            args: Prisma.invoice_lineFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoice_linePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.invoice_lineFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoice_linePayload>
          }
          findMany: {
            args: Prisma.invoice_lineFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoice_linePayload>[]
          }
          create: {
            args: Prisma.invoice_lineCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoice_linePayload>
          }
          createMany: {
            args: Prisma.invoice_lineCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.invoice_lineCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoice_linePayload>[]
          }
          delete: {
            args: Prisma.invoice_lineDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoice_linePayload>
          }
          update: {
            args: Prisma.invoice_lineUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoice_linePayload>
          }
          deleteMany: {
            args: Prisma.invoice_lineDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.invoice_lineUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.invoice_lineUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoice_linePayload>[]
          }
          upsert: {
            args: Prisma.invoice_lineUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$invoice_linePayload>
          }
          aggregate: {
            args: Prisma.Invoice_lineAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateInvoice_line>
          }
          groupBy: {
            args: Prisma.invoice_lineGroupByArgs<ExtArgs>
            result: $Utils.Optional<Invoice_lineGroupByOutputType>[]
          }
          count: {
            args: Prisma.invoice_lineCountArgs<ExtArgs>
            result: $Utils.Optional<Invoice_lineCountAggregateOutputType> | number
          }
        }
      }
      media_type: {
        payload: Prisma.$media_typePayload<ExtArgs>
        fields: Prisma.media_typeFieldRefs
        operations: {
          findUnique: {
            args: Prisma.media_typeFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$media_typePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.media_typeFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$media_typePayload>
          }
          findFirst: {
            args: Prisma.media_typeFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$media_typePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.media_typeFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$media_typePayload>
          }
          findMany: {
            args: Prisma.media_typeFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$media_typePayload>[]
          }
          create: {
            args: Prisma.media_typeCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$media_typePayload>
          }
          createMany: {
            args: Prisma.media_typeCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.media_typeCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$media_typePayload>[]
          }
          delete: {
            args: Prisma.media_typeDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$media_typePayload>
          }
          update: {
            args: Prisma.media_typeUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$media_typePayload>
          }
          deleteMany: {
            args: Prisma.media_typeDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.media_typeUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.media_typeUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$media_typePayload>[]
          }
          upsert: {
            args: Prisma.media_typeUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$media_typePayload>
          }
          aggregate: {
            args: Prisma.Media_typeAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateMedia_type>
          }
          groupBy: {
            args: Prisma.media_typeGroupByArgs<ExtArgs>
            result: $Utils.Optional<Media_typeGroupByOutputType>[]
          }
          count: {
            args: Prisma.media_typeCountArgs<ExtArgs>
            result: $Utils.Optional<Media_typeCountAggregateOutputType> | number
          }
        }
      }
      playlist: {
        payload: Prisma.$playlistPayload<ExtArgs>
        fields: Prisma.playlistFieldRefs
        operations: {
          findUnique: {
            args: Prisma.playlistFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlistPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.playlistFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlistPayload>
          }
          findFirst: {
            args: Prisma.playlistFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlistPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.playlistFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlistPayload>
          }
          findMany: {
            args: Prisma.playlistFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlistPayload>[]
          }
          create: {
            args: Prisma.playlistCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlistPayload>
          }
          createMany: {
            args: Prisma.playlistCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.playlistCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlistPayload>[]
          }
          delete: {
            args: Prisma.playlistDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlistPayload>
          }
          update: {
            args: Prisma.playlistUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlistPayload>
          }
          deleteMany: {
            args: Prisma.playlistDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.playlistUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.playlistUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlistPayload>[]
          }
          upsert: {
            args: Prisma.playlistUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlistPayload>
          }
          aggregate: {
            args: Prisma.PlaylistAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePlaylist>
          }
          groupBy: {
            args: Prisma.playlistGroupByArgs<ExtArgs>
            result: $Utils.Optional<PlaylistGroupByOutputType>[]
          }
          count: {
            args: Prisma.playlistCountArgs<ExtArgs>
            result: $Utils.Optional<PlaylistCountAggregateOutputType> | number
          }
        }
      }
      playlist_track: {
        payload: Prisma.$playlist_trackPayload<ExtArgs>
        fields: Prisma.playlist_trackFieldRefs
        operations: {
          findUnique: {
            args: Prisma.playlist_trackFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlist_trackPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.playlist_trackFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlist_trackPayload>
          }
          findFirst: {
            args: Prisma.playlist_trackFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlist_trackPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.playlist_trackFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlist_trackPayload>
          }
          findMany: {
            args: Prisma.playlist_trackFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlist_trackPayload>[]
          }
          create: {
            args: Prisma.playlist_trackCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlist_trackPayload>
          }
          createMany: {
            args: Prisma.playlist_trackCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.playlist_trackCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlist_trackPayload>[]
          }
          delete: {
            args: Prisma.playlist_trackDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlist_trackPayload>
          }
          update: {
            args: Prisma.playlist_trackUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlist_trackPayload>
          }
          deleteMany: {
            args: Prisma.playlist_trackDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.playlist_trackUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.playlist_trackUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlist_trackPayload>[]
          }
          upsert: {
            args: Prisma.playlist_trackUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$playlist_trackPayload>
          }
          aggregate: {
            args: Prisma.Playlist_trackAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregatePlaylist_track>
          }
          groupBy: {
            args: Prisma.playlist_trackGroupByArgs<ExtArgs>
            result: $Utils.Optional<Playlist_trackGroupByOutputType>[]
          }
          count: {
            args: Prisma.playlist_trackCountArgs<ExtArgs>
            result: $Utils.Optional<Playlist_trackCountAggregateOutputType> | number
          }
        }
      }
      track: {
        payload: Prisma.$trackPayload<ExtArgs>
        fields: Prisma.trackFieldRefs
        operations: {
          findUnique: {
            args: Prisma.trackFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$trackPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.trackFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$trackPayload>
          }
          findFirst: {
            args: Prisma.trackFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$trackPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.trackFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$trackPayload>
          }
          findMany: {
            args: Prisma.trackFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$trackPayload>[]
          }
          create: {
            args: Prisma.trackCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$trackPayload>
          }
          createMany: {
            args: Prisma.trackCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.trackCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$trackPayload>[]
          }
          delete: {
            args: Prisma.trackDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$trackPayload>
          }
          update: {
            args: Prisma.trackUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$trackPayload>
          }
          deleteMany: {
            args: Prisma.trackDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.trackUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.trackUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$trackPayload>[]
          }
          upsert: {
            args: Prisma.trackUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$trackPayload>
          }
          aggregate: {
            args: Prisma.TrackAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTrack>
          }
          groupBy: {
            args: Prisma.trackGroupByArgs<ExtArgs>
            result: $Utils.Optional<TrackGroupByOutputType>[]
          }
          count: {
            args: Prisma.trackCountArgs<ExtArgs>
            result: $Utils.Optional<TrackCountAggregateOutputType> | number
          }
        }
      }
      track_discount: {
        payload: Prisma.$track_discountPayload<ExtArgs>
        fields: Prisma.track_discountFieldRefs
        operations: {
          findUnique: {
            args: Prisma.track_discountFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$track_discountPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.track_discountFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$track_discountPayload>
          }
          findFirst: {
            args: Prisma.track_discountFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$track_discountPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.track_discountFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$track_discountPayload>
          }
          findMany: {
            args: Prisma.track_discountFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$track_discountPayload>[]
          }
          create: {
            args: Prisma.track_discountCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$track_discountPayload>
          }
          createMany: {
            args: Prisma.track_discountCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.track_discountCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$track_discountPayload>[]
          }
          delete: {
            args: Prisma.track_discountDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$track_discountPayload>
          }
          update: {
            args: Prisma.track_discountUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$track_discountPayload>
          }
          deleteMany: {
            args: Prisma.track_discountDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.track_discountUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.track_discountUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$track_discountPayload>[]
          }
          upsert: {
            args: Prisma.track_discountUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$track_discountPayload>
          }
          aggregate: {
            args: Prisma.Track_discountAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTrack_discount>
          }
          groupBy: {
            args: Prisma.track_discountGroupByArgs<ExtArgs>
            result: $Utils.Optional<Track_discountGroupByOutputType>[]
          }
          count: {
            args: Prisma.track_discountCountArgs<ExtArgs>
            result: $Utils.Optional<Track_discountCountAggregateOutputType> | number
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
    album?: albumOmit
    artist?: artistOmit
    customer?: customerOmit
    customer_review?: customer_reviewOmit
    employee?: employeeOmit
    genre?: genreOmit
    invoice?: invoiceOmit
    invoice_line?: invoice_lineOmit
    media_type?: media_typeOmit
    playlist?: playlistOmit
    playlist_track?: playlist_trackOmit
    track?: trackOmit
    track_discount?: track_discountOmit
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
   * Count Type AlbumCountOutputType
   */

  export type AlbumCountOutputType = {
    track: number
  }

  export type AlbumCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    track?: boolean | AlbumCountOutputTypeCountTrackArgs
  }

  // Custom InputTypes
  /**
   * AlbumCountOutputType without action
   */
  export type AlbumCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AlbumCountOutputType
     */
    select?: AlbumCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * AlbumCountOutputType without action
   */
  export type AlbumCountOutputTypeCountTrackArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: trackWhereInput
  }


  /**
   * Count Type ArtistCountOutputType
   */

  export type ArtistCountOutputType = {
    album: number
  }

  export type ArtistCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    album?: boolean | ArtistCountOutputTypeCountAlbumArgs
  }

  // Custom InputTypes
  /**
   * ArtistCountOutputType without action
   */
  export type ArtistCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ArtistCountOutputType
     */
    select?: ArtistCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * ArtistCountOutputType without action
   */
  export type ArtistCountOutputTypeCountAlbumArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: albumWhereInput
  }


  /**
   * Count Type CustomerCountOutputType
   */

  export type CustomerCountOutputType = {
    customer_review: number
    invoice: number
  }

  export type CustomerCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    customer_review?: boolean | CustomerCountOutputTypeCountCustomer_reviewArgs
    invoice?: boolean | CustomerCountOutputTypeCountInvoiceArgs
  }

  // Custom InputTypes
  /**
   * CustomerCountOutputType without action
   */
  export type CustomerCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CustomerCountOutputType
     */
    select?: CustomerCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * CustomerCountOutputType without action
   */
  export type CustomerCountOutputTypeCountCustomer_reviewArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: customer_reviewWhereInput
  }

  /**
   * CustomerCountOutputType without action
   */
  export type CustomerCountOutputTypeCountInvoiceArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: invoiceWhereInput
  }


  /**
   * Count Type EmployeeCountOutputType
   */

  export type EmployeeCountOutputType = {
    customer: number
    other_employee: number
    track_discount: number
  }

  export type EmployeeCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    customer?: boolean | EmployeeCountOutputTypeCountCustomerArgs
    other_employee?: boolean | EmployeeCountOutputTypeCountOther_employeeArgs
    track_discount?: boolean | EmployeeCountOutputTypeCountTrack_discountArgs
  }

  // Custom InputTypes
  /**
   * EmployeeCountOutputType without action
   */
  export type EmployeeCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the EmployeeCountOutputType
     */
    select?: EmployeeCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * EmployeeCountOutputType without action
   */
  export type EmployeeCountOutputTypeCountCustomerArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: customerWhereInput
  }

  /**
   * EmployeeCountOutputType without action
   */
  export type EmployeeCountOutputTypeCountOther_employeeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: employeeWhereInput
  }

  /**
   * EmployeeCountOutputType without action
   */
  export type EmployeeCountOutputTypeCountTrack_discountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: track_discountWhereInput
  }


  /**
   * Count Type InvoiceCountOutputType
   */

  export type InvoiceCountOutputType = {
    customer_review: number
    invoice_line: number
  }

  export type InvoiceCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    customer_review?: boolean | InvoiceCountOutputTypeCountCustomer_reviewArgs
    invoice_line?: boolean | InvoiceCountOutputTypeCountInvoice_lineArgs
  }

  // Custom InputTypes
  /**
   * InvoiceCountOutputType without action
   */
  export type InvoiceCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the InvoiceCountOutputType
     */
    select?: InvoiceCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * InvoiceCountOutputType without action
   */
  export type InvoiceCountOutputTypeCountCustomer_reviewArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: customer_reviewWhereInput
  }

  /**
   * InvoiceCountOutputType without action
   */
  export type InvoiceCountOutputTypeCountInvoice_lineArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: invoice_lineWhereInput
  }


  /**
   * Count Type PlaylistCountOutputType
   */

  export type PlaylistCountOutputType = {
    playlist_track: number
  }

  export type PlaylistCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    playlist_track?: boolean | PlaylistCountOutputTypeCountPlaylist_trackArgs
  }

  // Custom InputTypes
  /**
   * PlaylistCountOutputType without action
   */
  export type PlaylistCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the PlaylistCountOutputType
     */
    select?: PlaylistCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * PlaylistCountOutputType without action
   */
  export type PlaylistCountOutputTypeCountPlaylist_trackArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: playlist_trackWhereInput
  }


  /**
   * Count Type TrackCountOutputType
   */

  export type TrackCountOutputType = {
    invoice_line: number
    playlist_track: number
    track_discount: number
  }

  export type TrackCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    invoice_line?: boolean | TrackCountOutputTypeCountInvoice_lineArgs
    playlist_track?: boolean | TrackCountOutputTypeCountPlaylist_trackArgs
    track_discount?: boolean | TrackCountOutputTypeCountTrack_discountArgs
  }

  // Custom InputTypes
  /**
   * TrackCountOutputType without action
   */
  export type TrackCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TrackCountOutputType
     */
    select?: TrackCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * TrackCountOutputType without action
   */
  export type TrackCountOutputTypeCountInvoice_lineArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: invoice_lineWhereInput
  }

  /**
   * TrackCountOutputType without action
   */
  export type TrackCountOutputTypeCountPlaylist_trackArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: playlist_trackWhereInput
  }

  /**
   * TrackCountOutputType without action
   */
  export type TrackCountOutputTypeCountTrack_discountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: track_discountWhereInput
  }


  /**
   * Models
   */

  /**
   * Model album
   */

  export type AggregateAlbum = {
    _count: AlbumCountAggregateOutputType | null
    _avg: AlbumAvgAggregateOutputType | null
    _sum: AlbumSumAggregateOutputType | null
    _min: AlbumMinAggregateOutputType | null
    _max: AlbumMaxAggregateOutputType | null
  }

  export type AlbumAvgAggregateOutputType = {
    artist_id: number | null
    album_id: number | null
  }

  export type AlbumSumAggregateOutputType = {
    artist_id: number | null
    album_id: number | null
  }

  export type AlbumMinAggregateOutputType = {
    title: string | null
    artist_id: number | null
    album_id: number | null
  }

  export type AlbumMaxAggregateOutputType = {
    title: string | null
    artist_id: number | null
    album_id: number | null
  }

  export type AlbumCountAggregateOutputType = {
    title: number
    artist_id: number
    album_id: number
    _all: number
  }


  export type AlbumAvgAggregateInputType = {
    artist_id?: true
    album_id?: true
  }

  export type AlbumSumAggregateInputType = {
    artist_id?: true
    album_id?: true
  }

  export type AlbumMinAggregateInputType = {
    title?: true
    artist_id?: true
    album_id?: true
  }

  export type AlbumMaxAggregateInputType = {
    title?: true
    artist_id?: true
    album_id?: true
  }

  export type AlbumCountAggregateInputType = {
    title?: true
    artist_id?: true
    album_id?: true
    _all?: true
  }

  export type AlbumAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which album to aggregate.
     */
    where?: albumWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of albums to fetch.
     */
    orderBy?: albumOrderByWithRelationInput | albumOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: albumWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` albums from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` albums.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned albums
    **/
    _count?: true | AlbumCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: AlbumAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: AlbumSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AlbumMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AlbumMaxAggregateInputType
  }

  export type GetAlbumAggregateType<T extends AlbumAggregateArgs> = {
        [P in keyof T & keyof AggregateAlbum]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAlbum[P]>
      : GetScalarType<T[P], AggregateAlbum[P]>
  }




  export type albumGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: albumWhereInput
    orderBy?: albumOrderByWithAggregationInput | albumOrderByWithAggregationInput[]
    by: AlbumScalarFieldEnum[] | AlbumScalarFieldEnum
    having?: albumScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AlbumCountAggregateInputType | true
    _avg?: AlbumAvgAggregateInputType
    _sum?: AlbumSumAggregateInputType
    _min?: AlbumMinAggregateInputType
    _max?: AlbumMaxAggregateInputType
  }

  export type AlbumGroupByOutputType = {
    title: string
    artist_id: number
    album_id: number
    _count: AlbumCountAggregateOutputType | null
    _avg: AlbumAvgAggregateOutputType | null
    _sum: AlbumSumAggregateOutputType | null
    _min: AlbumMinAggregateOutputType | null
    _max: AlbumMaxAggregateOutputType | null
  }

  type GetAlbumGroupByPayload<T extends albumGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AlbumGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AlbumGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AlbumGroupByOutputType[P]>
            : GetScalarType<T[P], AlbumGroupByOutputType[P]>
        }
      >
    >


  export type albumSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    title?: boolean
    artist_id?: boolean
    album_id?: boolean
    artist?: boolean | artistDefaultArgs<ExtArgs>
    track?: boolean | album$trackArgs<ExtArgs>
    _count?: boolean | AlbumCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["album"]>

  export type albumSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    title?: boolean
    artist_id?: boolean
    album_id?: boolean
    artist?: boolean | artistDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["album"]>

  export type albumSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    title?: boolean
    artist_id?: boolean
    album_id?: boolean
    artist?: boolean | artistDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["album"]>

  export type albumSelectScalar = {
    title?: boolean
    artist_id?: boolean
    album_id?: boolean
  }

  export type albumOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"title" | "artist_id" | "album_id", ExtArgs["result"]["album"]>
  export type albumInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    artist?: boolean | artistDefaultArgs<ExtArgs>
    track?: boolean | album$trackArgs<ExtArgs>
    _count?: boolean | AlbumCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type albumIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    artist?: boolean | artistDefaultArgs<ExtArgs>
  }
  export type albumIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    artist?: boolean | artistDefaultArgs<ExtArgs>
  }

  export type $albumPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "album"
    objects: {
      artist: Prisma.$artistPayload<ExtArgs>
      track: Prisma.$trackPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      title: string
      artist_id: number
      album_id: number
    }, ExtArgs["result"]["album"]>
    composites: {}
  }

  type albumGetPayload<S extends boolean | null | undefined | albumDefaultArgs> = $Result.GetResult<Prisma.$albumPayload, S>

  type albumCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<albumFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: AlbumCountAggregateInputType | true
    }

  export interface albumDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['album'], meta: { name: 'album' } }
    /**
     * Find zero or one Album that matches the filter.
     * @param {albumFindUniqueArgs} args - Arguments to find a Album
     * @example
     * // Get one Album
     * const album = await prisma.album.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends albumFindUniqueArgs>(args: SelectSubset<T, albumFindUniqueArgs<ExtArgs>>): Prisma__albumClient<$Result.GetResult<Prisma.$albumPayload<ExtArgs>, T, "findUnique", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find one Album that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {albumFindUniqueOrThrowArgs} args - Arguments to find a Album
     * @example
     * // Get one Album
     * const album = await prisma.album.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends albumFindUniqueOrThrowArgs>(args: SelectSubset<T, albumFindUniqueOrThrowArgs<ExtArgs>>): Prisma__albumClient<$Result.GetResult<Prisma.$albumPayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find the first Album that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {albumFindFirstArgs} args - Arguments to find a Album
     * @example
     * // Get one Album
     * const album = await prisma.album.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends albumFindFirstArgs>(args?: SelectSubset<T, albumFindFirstArgs<ExtArgs>>): Prisma__albumClient<$Result.GetResult<Prisma.$albumPayload<ExtArgs>, T, "findFirst", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find the first Album that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {albumFindFirstOrThrowArgs} args - Arguments to find a Album
     * @example
     * // Get one Album
     * const album = await prisma.album.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends albumFindFirstOrThrowArgs>(args?: SelectSubset<T, albumFindFirstOrThrowArgs<ExtArgs>>): Prisma__albumClient<$Result.GetResult<Prisma.$albumPayload<ExtArgs>, T, "findFirstOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find zero or more Albums that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {albumFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Albums
     * const albums = await prisma.album.findMany()
     * 
     * // Get first 10 Albums
     * const albums = await prisma.album.findMany({ take: 10 })
     * 
     * // Only select the `title`
     * const albumWithTitleOnly = await prisma.album.findMany({ select: { title: true } })
     * 
     */
    findMany<T extends albumFindManyArgs>(args?: SelectSubset<T, albumFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$albumPayload<ExtArgs>, T, "findMany", ClientOptions>>

    /**
     * Create a Album.
     * @param {albumCreateArgs} args - Arguments to create a Album.
     * @example
     * // Create one Album
     * const Album = await prisma.album.create({
     *   data: {
     *     // ... data to create a Album
     *   }
     * })
     * 
     */
    create<T extends albumCreateArgs>(args: SelectSubset<T, albumCreateArgs<ExtArgs>>): Prisma__albumClient<$Result.GetResult<Prisma.$albumPayload<ExtArgs>, T, "create", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Create many Albums.
     * @param {albumCreateManyArgs} args - Arguments to create many Albums.
     * @example
     * // Create many Albums
     * const album = await prisma.album.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends albumCreateManyArgs>(args?: SelectSubset<T, albumCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Albums and returns the data saved in the database.
     * @param {albumCreateManyAndReturnArgs} args - Arguments to create many Albums.
     * @example
     * // Create many Albums
     * const album = await prisma.album.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Albums and only return the `title`
     * const albumWithTitleOnly = await prisma.album.createManyAndReturn({
     *   select: { title: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends albumCreateManyAndReturnArgs>(args?: SelectSubset<T, albumCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$albumPayload<ExtArgs>, T, "createManyAndReturn", ClientOptions>>

    /**
     * Delete a Album.
     * @param {albumDeleteArgs} args - Arguments to delete one Album.
     * @example
     * // Delete one Album
     * const Album = await prisma.album.delete({
     *   where: {
     *     // ... filter to delete one Album
     *   }
     * })
     * 
     */
    delete<T extends albumDeleteArgs>(args: SelectSubset<T, albumDeleteArgs<ExtArgs>>): Prisma__albumClient<$Result.GetResult<Prisma.$albumPayload<ExtArgs>, T, "delete", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Update one Album.
     * @param {albumUpdateArgs} args - Arguments to update one Album.
     * @example
     * // Update one Album
     * const album = await prisma.album.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends albumUpdateArgs>(args: SelectSubset<T, albumUpdateArgs<ExtArgs>>): Prisma__albumClient<$Result.GetResult<Prisma.$albumPayload<ExtArgs>, T, "update", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Delete zero or more Albums.
     * @param {albumDeleteManyArgs} args - Arguments to filter Albums to delete.
     * @example
     * // Delete a few Albums
     * const { count } = await prisma.album.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends albumDeleteManyArgs>(args?: SelectSubset<T, albumDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Albums.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {albumUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Albums
     * const album = await prisma.album.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends albumUpdateManyArgs>(args: SelectSubset<T, albumUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Albums and returns the data updated in the database.
     * @param {albumUpdateManyAndReturnArgs} args - Arguments to update many Albums.
     * @example
     * // Update many Albums
     * const album = await prisma.album.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Albums and only return the `title`
     * const albumWithTitleOnly = await prisma.album.updateManyAndReturn({
     *   select: { title: true },
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
    updateManyAndReturn<T extends albumUpdateManyAndReturnArgs>(args: SelectSubset<T, albumUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$albumPayload<ExtArgs>, T, "updateManyAndReturn", ClientOptions>>

    /**
     * Create or update one Album.
     * @param {albumUpsertArgs} args - Arguments to update or create a Album.
     * @example
     * // Update or create a Album
     * const album = await prisma.album.upsert({
     *   create: {
     *     // ... data to create a Album
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Album we want to update
     *   }
     * })
     */
    upsert<T extends albumUpsertArgs>(args: SelectSubset<T, albumUpsertArgs<ExtArgs>>): Prisma__albumClient<$Result.GetResult<Prisma.$albumPayload<ExtArgs>, T, "upsert", ClientOptions>, never, ExtArgs, ClientOptions>


    /**
     * Count the number of Albums.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {albumCountArgs} args - Arguments to filter Albums to count.
     * @example
     * // Count the number of Albums
     * const count = await prisma.album.count({
     *   where: {
     *     // ... the filter for the Albums we want to count
     *   }
     * })
    **/
    count<T extends albumCountArgs>(
      args?: Subset<T, albumCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AlbumCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Album.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AlbumAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends AlbumAggregateArgs>(args: Subset<T, AlbumAggregateArgs>): Prisma.PrismaPromise<GetAlbumAggregateType<T>>

    /**
     * Group by Album.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {albumGroupByArgs} args - Group by arguments.
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
      T extends albumGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: albumGroupByArgs['orderBy'] }
        : { orderBy?: albumGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, albumGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAlbumGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the album model
   */
  readonly fields: albumFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for album.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__albumClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    artist<T extends artistDefaultArgs<ExtArgs> = {}>(args?: Subset<T, artistDefaultArgs<ExtArgs>>): Prisma__artistClient<$Result.GetResult<Prisma.$artistPayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions> | Null, Null, ExtArgs, ClientOptions>
    track<T extends album$trackArgs<ExtArgs> = {}>(args?: Subset<T, album$trackArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$trackPayload<ExtArgs>, T, "findMany", ClientOptions> | Null>
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
   * Fields of the album model
   */ 
  interface albumFieldRefs {
    readonly title: FieldRef<"album", 'String'>
    readonly artist_id: FieldRef<"album", 'Int'>
    readonly album_id: FieldRef<"album", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * album findUnique
   */
  export type albumFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the album
     */
    select?: albumSelect<ExtArgs> | null
    /**
     * Omit specific fields from the album
     */
    omit?: albumOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: albumInclude<ExtArgs> | null
    /**
     * Filter, which album to fetch.
     */
    where: albumWhereUniqueInput
  }

  /**
   * album findUniqueOrThrow
   */
  export type albumFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the album
     */
    select?: albumSelect<ExtArgs> | null
    /**
     * Omit specific fields from the album
     */
    omit?: albumOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: albumInclude<ExtArgs> | null
    /**
     * Filter, which album to fetch.
     */
    where: albumWhereUniqueInput
  }

  /**
   * album findFirst
   */
  export type albumFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the album
     */
    select?: albumSelect<ExtArgs> | null
    /**
     * Omit specific fields from the album
     */
    omit?: albumOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: albumInclude<ExtArgs> | null
    /**
     * Filter, which album to fetch.
     */
    where?: albumWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of albums to fetch.
     */
    orderBy?: albumOrderByWithRelationInput | albumOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for albums.
     */
    cursor?: albumWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` albums from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` albums.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of albums.
     */
    distinct?: AlbumScalarFieldEnum | AlbumScalarFieldEnum[]
  }

  /**
   * album findFirstOrThrow
   */
  export type albumFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the album
     */
    select?: albumSelect<ExtArgs> | null
    /**
     * Omit specific fields from the album
     */
    omit?: albumOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: albumInclude<ExtArgs> | null
    /**
     * Filter, which album to fetch.
     */
    where?: albumWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of albums to fetch.
     */
    orderBy?: albumOrderByWithRelationInput | albumOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for albums.
     */
    cursor?: albumWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` albums from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` albums.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of albums.
     */
    distinct?: AlbumScalarFieldEnum | AlbumScalarFieldEnum[]
  }

  /**
   * album findMany
   */
  export type albumFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the album
     */
    select?: albumSelect<ExtArgs> | null
    /**
     * Omit specific fields from the album
     */
    omit?: albumOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: albumInclude<ExtArgs> | null
    /**
     * Filter, which albums to fetch.
     */
    where?: albumWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of albums to fetch.
     */
    orderBy?: albumOrderByWithRelationInput | albumOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing albums.
     */
    cursor?: albumWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` albums from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` albums.
     */
    skip?: number
    distinct?: AlbumScalarFieldEnum | AlbumScalarFieldEnum[]
  }

  /**
   * album create
   */
  export type albumCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the album
     */
    select?: albumSelect<ExtArgs> | null
    /**
     * Omit specific fields from the album
     */
    omit?: albumOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: albumInclude<ExtArgs> | null
    /**
     * The data needed to create a album.
     */
    data: XOR<albumCreateInput, albumUncheckedCreateInput>
  }

  /**
   * album createMany
   */
  export type albumCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many albums.
     */
    data: albumCreateManyInput | albumCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * album createManyAndReturn
   */
  export type albumCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the album
     */
    select?: albumSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the album
     */
    omit?: albumOmit<ExtArgs> | null
    /**
     * The data used to create many albums.
     */
    data: albumCreateManyInput | albumCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: albumIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * album update
   */
  export type albumUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the album
     */
    select?: albumSelect<ExtArgs> | null
    /**
     * Omit specific fields from the album
     */
    omit?: albumOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: albumInclude<ExtArgs> | null
    /**
     * The data needed to update a album.
     */
    data: XOR<albumUpdateInput, albumUncheckedUpdateInput>
    /**
     * Choose, which album to update.
     */
    where: albumWhereUniqueInput
  }

  /**
   * album updateMany
   */
  export type albumUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update albums.
     */
    data: XOR<albumUpdateManyMutationInput, albumUncheckedUpdateManyInput>
    /**
     * Filter which albums to update
     */
    where?: albumWhereInput
  }

  /**
   * album updateManyAndReturn
   */
  export type albumUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the album
     */
    select?: albumSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the album
     */
    omit?: albumOmit<ExtArgs> | null
    /**
     * The data used to update albums.
     */
    data: XOR<albumUpdateManyMutationInput, albumUncheckedUpdateManyInput>
    /**
     * Filter which albums to update
     */
    where?: albumWhereInput
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: albumIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * album upsert
   */
  export type albumUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the album
     */
    select?: albumSelect<ExtArgs> | null
    /**
     * Omit specific fields from the album
     */
    omit?: albumOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: albumInclude<ExtArgs> | null
    /**
     * The filter to search for the album to update in case it exists.
     */
    where: albumWhereUniqueInput
    /**
     * In case the album found by the `where` argument doesn't exist, create a new album with this data.
     */
    create: XOR<albumCreateInput, albumUncheckedCreateInput>
    /**
     * In case the album was found with the provided `where` argument, update it with this data.
     */
    update: XOR<albumUpdateInput, albumUncheckedUpdateInput>
  }

  /**
   * album delete
   */
  export type albumDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the album
     */
    select?: albumSelect<ExtArgs> | null
    /**
     * Omit specific fields from the album
     */
    omit?: albumOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: albumInclude<ExtArgs> | null
    /**
     * Filter which album to delete.
     */
    where: albumWhereUniqueInput
  }

  /**
   * album deleteMany
   */
  export type albumDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which albums to delete
     */
    where?: albumWhereInput
  }

  /**
   * album.track
   */
  export type album$trackArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track
     */
    select?: trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track
     */
    omit?: trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: trackInclude<ExtArgs> | null
    where?: trackWhereInput
    orderBy?: trackOrderByWithRelationInput | trackOrderByWithRelationInput[]
    cursor?: trackWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TrackScalarFieldEnum | TrackScalarFieldEnum[]
  }

  /**
   * album without action
   */
  export type albumDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the album
     */
    select?: albumSelect<ExtArgs> | null
    /**
     * Omit specific fields from the album
     */
    omit?: albumOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: albumInclude<ExtArgs> | null
  }


  /**
   * Model artist
   */

  export type AggregateArtist = {
    _count: ArtistCountAggregateOutputType | null
    _avg: ArtistAvgAggregateOutputType | null
    _sum: ArtistSumAggregateOutputType | null
    _min: ArtistMinAggregateOutputType | null
    _max: ArtistMaxAggregateOutputType | null
  }

  export type ArtistAvgAggregateOutputType = {
    artist_id: number | null
  }

  export type ArtistSumAggregateOutputType = {
    artist_id: number | null
  }

  export type ArtistMinAggregateOutputType = {
    name: string | null
    artist_id: number | null
  }

  export type ArtistMaxAggregateOutputType = {
    name: string | null
    artist_id: number | null
  }

  export type ArtistCountAggregateOutputType = {
    name: number
    artist_id: number
    _all: number
  }


  export type ArtistAvgAggregateInputType = {
    artist_id?: true
  }

  export type ArtistSumAggregateInputType = {
    artist_id?: true
  }

  export type ArtistMinAggregateInputType = {
    name?: true
    artist_id?: true
  }

  export type ArtistMaxAggregateInputType = {
    name?: true
    artist_id?: true
  }

  export type ArtistCountAggregateInputType = {
    name?: true
    artist_id?: true
    _all?: true
  }

  export type ArtistAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which artist to aggregate.
     */
    where?: artistWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of artists to fetch.
     */
    orderBy?: artistOrderByWithRelationInput | artistOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: artistWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` artists from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` artists.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned artists
    **/
    _count?: true | ArtistCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ArtistAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ArtistSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ArtistMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ArtistMaxAggregateInputType
  }

  export type GetArtistAggregateType<T extends ArtistAggregateArgs> = {
        [P in keyof T & keyof AggregateArtist]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateArtist[P]>
      : GetScalarType<T[P], AggregateArtist[P]>
  }




  export type artistGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: artistWhereInput
    orderBy?: artistOrderByWithAggregationInput | artistOrderByWithAggregationInput[]
    by: ArtistScalarFieldEnum[] | ArtistScalarFieldEnum
    having?: artistScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ArtistCountAggregateInputType | true
    _avg?: ArtistAvgAggregateInputType
    _sum?: ArtistSumAggregateInputType
    _min?: ArtistMinAggregateInputType
    _max?: ArtistMaxAggregateInputType
  }

  export type ArtistGroupByOutputType = {
    name: string
    artist_id: number
    _count: ArtistCountAggregateOutputType | null
    _avg: ArtistAvgAggregateOutputType | null
    _sum: ArtistSumAggregateOutputType | null
    _min: ArtistMinAggregateOutputType | null
    _max: ArtistMaxAggregateOutputType | null
  }

  type GetArtistGroupByPayload<T extends artistGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ArtistGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ArtistGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ArtistGroupByOutputType[P]>
            : GetScalarType<T[P], ArtistGroupByOutputType[P]>
        }
      >
    >


  export type artistSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    name?: boolean
    artist_id?: boolean
    album?: boolean | artist$albumArgs<ExtArgs>
    _count?: boolean | ArtistCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["artist"]>

  export type artistSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    name?: boolean
    artist_id?: boolean
  }, ExtArgs["result"]["artist"]>

  export type artistSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    name?: boolean
    artist_id?: boolean
  }, ExtArgs["result"]["artist"]>

  export type artistSelectScalar = {
    name?: boolean
    artist_id?: boolean
  }

  export type artistOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"name" | "artist_id", ExtArgs["result"]["artist"]>
  export type artistInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    album?: boolean | artist$albumArgs<ExtArgs>
    _count?: boolean | ArtistCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type artistIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type artistIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $artistPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "artist"
    objects: {
      album: Prisma.$albumPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      name: string
      artist_id: number
    }, ExtArgs["result"]["artist"]>
    composites: {}
  }

  type artistGetPayload<S extends boolean | null | undefined | artistDefaultArgs> = $Result.GetResult<Prisma.$artistPayload, S>

  type artistCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<artistFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ArtistCountAggregateInputType | true
    }

  export interface artistDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['artist'], meta: { name: 'artist' } }
    /**
     * Find zero or one Artist that matches the filter.
     * @param {artistFindUniqueArgs} args - Arguments to find a Artist
     * @example
     * // Get one Artist
     * const artist = await prisma.artist.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends artistFindUniqueArgs>(args: SelectSubset<T, artistFindUniqueArgs<ExtArgs>>): Prisma__artistClient<$Result.GetResult<Prisma.$artistPayload<ExtArgs>, T, "findUnique", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find one Artist that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {artistFindUniqueOrThrowArgs} args - Arguments to find a Artist
     * @example
     * // Get one Artist
     * const artist = await prisma.artist.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends artistFindUniqueOrThrowArgs>(args: SelectSubset<T, artistFindUniqueOrThrowArgs<ExtArgs>>): Prisma__artistClient<$Result.GetResult<Prisma.$artistPayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find the first Artist that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {artistFindFirstArgs} args - Arguments to find a Artist
     * @example
     * // Get one Artist
     * const artist = await prisma.artist.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends artistFindFirstArgs>(args?: SelectSubset<T, artistFindFirstArgs<ExtArgs>>): Prisma__artistClient<$Result.GetResult<Prisma.$artistPayload<ExtArgs>, T, "findFirst", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find the first Artist that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {artistFindFirstOrThrowArgs} args - Arguments to find a Artist
     * @example
     * // Get one Artist
     * const artist = await prisma.artist.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends artistFindFirstOrThrowArgs>(args?: SelectSubset<T, artistFindFirstOrThrowArgs<ExtArgs>>): Prisma__artistClient<$Result.GetResult<Prisma.$artistPayload<ExtArgs>, T, "findFirstOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find zero or more Artists that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {artistFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Artists
     * const artists = await prisma.artist.findMany()
     * 
     * // Get first 10 Artists
     * const artists = await prisma.artist.findMany({ take: 10 })
     * 
     * // Only select the `name`
     * const artistWithNameOnly = await prisma.artist.findMany({ select: { name: true } })
     * 
     */
    findMany<T extends artistFindManyArgs>(args?: SelectSubset<T, artistFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$artistPayload<ExtArgs>, T, "findMany", ClientOptions>>

    /**
     * Create a Artist.
     * @param {artistCreateArgs} args - Arguments to create a Artist.
     * @example
     * // Create one Artist
     * const Artist = await prisma.artist.create({
     *   data: {
     *     // ... data to create a Artist
     *   }
     * })
     * 
     */
    create<T extends artistCreateArgs>(args: SelectSubset<T, artistCreateArgs<ExtArgs>>): Prisma__artistClient<$Result.GetResult<Prisma.$artistPayload<ExtArgs>, T, "create", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Create many Artists.
     * @param {artistCreateManyArgs} args - Arguments to create many Artists.
     * @example
     * // Create many Artists
     * const artist = await prisma.artist.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends artistCreateManyArgs>(args?: SelectSubset<T, artistCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Artists and returns the data saved in the database.
     * @param {artistCreateManyAndReturnArgs} args - Arguments to create many Artists.
     * @example
     * // Create many Artists
     * const artist = await prisma.artist.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Artists and only return the `name`
     * const artistWithNameOnly = await prisma.artist.createManyAndReturn({
     *   select: { name: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends artistCreateManyAndReturnArgs>(args?: SelectSubset<T, artistCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$artistPayload<ExtArgs>, T, "createManyAndReturn", ClientOptions>>

    /**
     * Delete a Artist.
     * @param {artistDeleteArgs} args - Arguments to delete one Artist.
     * @example
     * // Delete one Artist
     * const Artist = await prisma.artist.delete({
     *   where: {
     *     // ... filter to delete one Artist
     *   }
     * })
     * 
     */
    delete<T extends artistDeleteArgs>(args: SelectSubset<T, artistDeleteArgs<ExtArgs>>): Prisma__artistClient<$Result.GetResult<Prisma.$artistPayload<ExtArgs>, T, "delete", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Update one Artist.
     * @param {artistUpdateArgs} args - Arguments to update one Artist.
     * @example
     * // Update one Artist
     * const artist = await prisma.artist.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends artistUpdateArgs>(args: SelectSubset<T, artistUpdateArgs<ExtArgs>>): Prisma__artistClient<$Result.GetResult<Prisma.$artistPayload<ExtArgs>, T, "update", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Delete zero or more Artists.
     * @param {artistDeleteManyArgs} args - Arguments to filter Artists to delete.
     * @example
     * // Delete a few Artists
     * const { count } = await prisma.artist.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends artistDeleteManyArgs>(args?: SelectSubset<T, artistDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Artists.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {artistUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Artists
     * const artist = await prisma.artist.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends artistUpdateManyArgs>(args: SelectSubset<T, artistUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Artists and returns the data updated in the database.
     * @param {artistUpdateManyAndReturnArgs} args - Arguments to update many Artists.
     * @example
     * // Update many Artists
     * const artist = await prisma.artist.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Artists and only return the `name`
     * const artistWithNameOnly = await prisma.artist.updateManyAndReturn({
     *   select: { name: true },
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
    updateManyAndReturn<T extends artistUpdateManyAndReturnArgs>(args: SelectSubset<T, artistUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$artistPayload<ExtArgs>, T, "updateManyAndReturn", ClientOptions>>

    /**
     * Create or update one Artist.
     * @param {artistUpsertArgs} args - Arguments to update or create a Artist.
     * @example
     * // Update or create a Artist
     * const artist = await prisma.artist.upsert({
     *   create: {
     *     // ... data to create a Artist
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Artist we want to update
     *   }
     * })
     */
    upsert<T extends artistUpsertArgs>(args: SelectSubset<T, artistUpsertArgs<ExtArgs>>): Prisma__artistClient<$Result.GetResult<Prisma.$artistPayload<ExtArgs>, T, "upsert", ClientOptions>, never, ExtArgs, ClientOptions>


    /**
     * Count the number of Artists.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {artistCountArgs} args - Arguments to filter Artists to count.
     * @example
     * // Count the number of Artists
     * const count = await prisma.artist.count({
     *   where: {
     *     // ... the filter for the Artists we want to count
     *   }
     * })
    **/
    count<T extends artistCountArgs>(
      args?: Subset<T, artistCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ArtistCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Artist.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ArtistAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends ArtistAggregateArgs>(args: Subset<T, ArtistAggregateArgs>): Prisma.PrismaPromise<GetArtistAggregateType<T>>

    /**
     * Group by Artist.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {artistGroupByArgs} args - Group by arguments.
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
      T extends artistGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: artistGroupByArgs['orderBy'] }
        : { orderBy?: artistGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, artistGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetArtistGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the artist model
   */
  readonly fields: artistFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for artist.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__artistClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    album<T extends artist$albumArgs<ExtArgs> = {}>(args?: Subset<T, artist$albumArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$albumPayload<ExtArgs>, T, "findMany", ClientOptions> | Null>
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
   * Fields of the artist model
   */ 
  interface artistFieldRefs {
    readonly name: FieldRef<"artist", 'String'>
    readonly artist_id: FieldRef<"artist", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * artist findUnique
   */
  export type artistFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the artist
     */
    select?: artistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the artist
     */
    omit?: artistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: artistInclude<ExtArgs> | null
    /**
     * Filter, which artist to fetch.
     */
    where: artistWhereUniqueInput
  }

  /**
   * artist findUniqueOrThrow
   */
  export type artistFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the artist
     */
    select?: artistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the artist
     */
    omit?: artistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: artistInclude<ExtArgs> | null
    /**
     * Filter, which artist to fetch.
     */
    where: artistWhereUniqueInput
  }

  /**
   * artist findFirst
   */
  export type artistFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the artist
     */
    select?: artistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the artist
     */
    omit?: artistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: artistInclude<ExtArgs> | null
    /**
     * Filter, which artist to fetch.
     */
    where?: artistWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of artists to fetch.
     */
    orderBy?: artistOrderByWithRelationInput | artistOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for artists.
     */
    cursor?: artistWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` artists from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` artists.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of artists.
     */
    distinct?: ArtistScalarFieldEnum | ArtistScalarFieldEnum[]
  }

  /**
   * artist findFirstOrThrow
   */
  export type artistFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the artist
     */
    select?: artistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the artist
     */
    omit?: artistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: artistInclude<ExtArgs> | null
    /**
     * Filter, which artist to fetch.
     */
    where?: artistWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of artists to fetch.
     */
    orderBy?: artistOrderByWithRelationInput | artistOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for artists.
     */
    cursor?: artistWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` artists from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` artists.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of artists.
     */
    distinct?: ArtistScalarFieldEnum | ArtistScalarFieldEnum[]
  }

  /**
   * artist findMany
   */
  export type artistFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the artist
     */
    select?: artistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the artist
     */
    omit?: artistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: artistInclude<ExtArgs> | null
    /**
     * Filter, which artists to fetch.
     */
    where?: artistWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of artists to fetch.
     */
    orderBy?: artistOrderByWithRelationInput | artistOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing artists.
     */
    cursor?: artistWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` artists from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` artists.
     */
    skip?: number
    distinct?: ArtistScalarFieldEnum | ArtistScalarFieldEnum[]
  }

  /**
   * artist create
   */
  export type artistCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the artist
     */
    select?: artistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the artist
     */
    omit?: artistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: artistInclude<ExtArgs> | null
    /**
     * The data needed to create a artist.
     */
    data: XOR<artistCreateInput, artistUncheckedCreateInput>
  }

  /**
   * artist createMany
   */
  export type artistCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many artists.
     */
    data: artistCreateManyInput | artistCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * artist createManyAndReturn
   */
  export type artistCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the artist
     */
    select?: artistSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the artist
     */
    omit?: artistOmit<ExtArgs> | null
    /**
     * The data used to create many artists.
     */
    data: artistCreateManyInput | artistCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * artist update
   */
  export type artistUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the artist
     */
    select?: artistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the artist
     */
    omit?: artistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: artistInclude<ExtArgs> | null
    /**
     * The data needed to update a artist.
     */
    data: XOR<artistUpdateInput, artistUncheckedUpdateInput>
    /**
     * Choose, which artist to update.
     */
    where: artistWhereUniqueInput
  }

  /**
   * artist updateMany
   */
  export type artistUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update artists.
     */
    data: XOR<artistUpdateManyMutationInput, artistUncheckedUpdateManyInput>
    /**
     * Filter which artists to update
     */
    where?: artistWhereInput
  }

  /**
   * artist updateManyAndReturn
   */
  export type artistUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the artist
     */
    select?: artistSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the artist
     */
    omit?: artistOmit<ExtArgs> | null
    /**
     * The data used to update artists.
     */
    data: XOR<artistUpdateManyMutationInput, artistUncheckedUpdateManyInput>
    /**
     * Filter which artists to update
     */
    where?: artistWhereInput
  }

  /**
   * artist upsert
   */
  export type artistUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the artist
     */
    select?: artistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the artist
     */
    omit?: artistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: artistInclude<ExtArgs> | null
    /**
     * The filter to search for the artist to update in case it exists.
     */
    where: artistWhereUniqueInput
    /**
     * In case the artist found by the `where` argument doesn't exist, create a new artist with this data.
     */
    create: XOR<artistCreateInput, artistUncheckedCreateInput>
    /**
     * In case the artist was found with the provided `where` argument, update it with this data.
     */
    update: XOR<artistUpdateInput, artistUncheckedUpdateInput>
  }

  /**
   * artist delete
   */
  export type artistDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the artist
     */
    select?: artistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the artist
     */
    omit?: artistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: artistInclude<ExtArgs> | null
    /**
     * Filter which artist to delete.
     */
    where: artistWhereUniqueInput
  }

  /**
   * artist deleteMany
   */
  export type artistDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which artists to delete
     */
    where?: artistWhereInput
  }

  /**
   * artist.album
   */
  export type artist$albumArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the album
     */
    select?: albumSelect<ExtArgs> | null
    /**
     * Omit specific fields from the album
     */
    omit?: albumOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: albumInclude<ExtArgs> | null
    where?: albumWhereInput
    orderBy?: albumOrderByWithRelationInput | albumOrderByWithRelationInput[]
    cursor?: albumWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AlbumScalarFieldEnum | AlbumScalarFieldEnum[]
  }

  /**
   * artist without action
   */
  export type artistDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the artist
     */
    select?: artistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the artist
     */
    omit?: artistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: artistInclude<ExtArgs> | null
  }


  /**
   * Model customer
   */

  export type AggregateCustomer = {
    _count: CustomerCountAggregateOutputType | null
    _avg: CustomerAvgAggregateOutputType | null
    _sum: CustomerSumAggregateOutputType | null
    _min: CustomerMinAggregateOutputType | null
    _max: CustomerMaxAggregateOutputType | null
  }

  export type CustomerAvgAggregateOutputType = {
    customer_id: number | null
    support_rep_id: number | null
  }

  export type CustomerSumAggregateOutputType = {
    customer_id: number | null
    support_rep_id: number | null
  }

  export type CustomerMinAggregateOutputType = {
    customer_id: number | null
    first_name: string | null
    last_name: string | null
    company: string | null
    address: string | null
    city: string | null
    state: string | null
    country: string | null
    postal_code: string | null
    phone: string | null
    fax: string | null
    email: string | null
    support_rep_id: number | null
  }

  export type CustomerMaxAggregateOutputType = {
    customer_id: number | null
    first_name: string | null
    last_name: string | null
    company: string | null
    address: string | null
    city: string | null
    state: string | null
    country: string | null
    postal_code: string | null
    phone: string | null
    fax: string | null
    email: string | null
    support_rep_id: number | null
  }

  export type CustomerCountAggregateOutputType = {
    customer_id: number
    first_name: number
    last_name: number
    company: number
    address: number
    city: number
    state: number
    country: number
    postal_code: number
    phone: number
    fax: number
    email: number
    support_rep_id: number
    _all: number
  }


  export type CustomerAvgAggregateInputType = {
    customer_id?: true
    support_rep_id?: true
  }

  export type CustomerSumAggregateInputType = {
    customer_id?: true
    support_rep_id?: true
  }

  export type CustomerMinAggregateInputType = {
    customer_id?: true
    first_name?: true
    last_name?: true
    company?: true
    address?: true
    city?: true
    state?: true
    country?: true
    postal_code?: true
    phone?: true
    fax?: true
    email?: true
    support_rep_id?: true
  }

  export type CustomerMaxAggregateInputType = {
    customer_id?: true
    first_name?: true
    last_name?: true
    company?: true
    address?: true
    city?: true
    state?: true
    country?: true
    postal_code?: true
    phone?: true
    fax?: true
    email?: true
    support_rep_id?: true
  }

  export type CustomerCountAggregateInputType = {
    customer_id?: true
    first_name?: true
    last_name?: true
    company?: true
    address?: true
    city?: true
    state?: true
    country?: true
    postal_code?: true
    phone?: true
    fax?: true
    email?: true
    support_rep_id?: true
    _all?: true
  }

  export type CustomerAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which customer to aggregate.
     */
    where?: customerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of customers to fetch.
     */
    orderBy?: customerOrderByWithRelationInput | customerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: customerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` customers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` customers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned customers
    **/
    _count?: true | CustomerCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: CustomerAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: CustomerSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CustomerMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CustomerMaxAggregateInputType
  }

  export type GetCustomerAggregateType<T extends CustomerAggregateArgs> = {
        [P in keyof T & keyof AggregateCustomer]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCustomer[P]>
      : GetScalarType<T[P], AggregateCustomer[P]>
  }




  export type customerGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: customerWhereInput
    orderBy?: customerOrderByWithAggregationInput | customerOrderByWithAggregationInput[]
    by: CustomerScalarFieldEnum[] | CustomerScalarFieldEnum
    having?: customerScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CustomerCountAggregateInputType | true
    _avg?: CustomerAvgAggregateInputType
    _sum?: CustomerSumAggregateInputType
    _min?: CustomerMinAggregateInputType
    _max?: CustomerMaxAggregateInputType
  }

  export type CustomerGroupByOutputType = {
    customer_id: number
    first_name: string
    last_name: string
    company: string | null
    address: string | null
    city: string | null
    state: string | null
    country: string | null
    postal_code: string | null
    phone: string | null
    fax: string | null
    email: string
    support_rep_id: number | null
    _count: CustomerCountAggregateOutputType | null
    _avg: CustomerAvgAggregateOutputType | null
    _sum: CustomerSumAggregateOutputType | null
    _min: CustomerMinAggregateOutputType | null
    _max: CustomerMaxAggregateOutputType | null
  }

  type GetCustomerGroupByPayload<T extends customerGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CustomerGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CustomerGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CustomerGroupByOutputType[P]>
            : GetScalarType<T[P], CustomerGroupByOutputType[P]>
        }
      >
    >


  export type customerSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    customer_id?: boolean
    first_name?: boolean
    last_name?: boolean
    company?: boolean
    address?: boolean
    city?: boolean
    state?: boolean
    country?: boolean
    postal_code?: boolean
    phone?: boolean
    fax?: boolean
    email?: boolean
    support_rep_id?: boolean
    employee?: boolean | customer$employeeArgs<ExtArgs>
    customer_review?: boolean | customer$customer_reviewArgs<ExtArgs>
    invoice?: boolean | customer$invoiceArgs<ExtArgs>
    _count?: boolean | CustomerCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["customer"]>

  export type customerSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    customer_id?: boolean
    first_name?: boolean
    last_name?: boolean
    company?: boolean
    address?: boolean
    city?: boolean
    state?: boolean
    country?: boolean
    postal_code?: boolean
    phone?: boolean
    fax?: boolean
    email?: boolean
    support_rep_id?: boolean
    employee?: boolean | customer$employeeArgs<ExtArgs>
  }, ExtArgs["result"]["customer"]>

  export type customerSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    customer_id?: boolean
    first_name?: boolean
    last_name?: boolean
    company?: boolean
    address?: boolean
    city?: boolean
    state?: boolean
    country?: boolean
    postal_code?: boolean
    phone?: boolean
    fax?: boolean
    email?: boolean
    support_rep_id?: boolean
    employee?: boolean | customer$employeeArgs<ExtArgs>
  }, ExtArgs["result"]["customer"]>

  export type customerSelectScalar = {
    customer_id?: boolean
    first_name?: boolean
    last_name?: boolean
    company?: boolean
    address?: boolean
    city?: boolean
    state?: boolean
    country?: boolean
    postal_code?: boolean
    phone?: boolean
    fax?: boolean
    email?: boolean
    support_rep_id?: boolean
  }

  export type customerOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"customer_id" | "first_name" | "last_name" | "company" | "address" | "city" | "state" | "country" | "postal_code" | "phone" | "fax" | "email" | "support_rep_id", ExtArgs["result"]["customer"]>
  export type customerInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    employee?: boolean | customer$employeeArgs<ExtArgs>
    customer_review?: boolean | customer$customer_reviewArgs<ExtArgs>
    invoice?: boolean | customer$invoiceArgs<ExtArgs>
    _count?: boolean | CustomerCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type customerIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    employee?: boolean | customer$employeeArgs<ExtArgs>
  }
  export type customerIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    employee?: boolean | customer$employeeArgs<ExtArgs>
  }

  export type $customerPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "customer"
    objects: {
      employee: Prisma.$employeePayload<ExtArgs> | null
      customer_review: Prisma.$customer_reviewPayload<ExtArgs>[]
      invoice: Prisma.$invoicePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      customer_id: number
      first_name: string
      last_name: string
      company: string | null
      address: string | null
      city: string | null
      state: string | null
      country: string | null
      postal_code: string | null
      phone: string | null
      fax: string | null
      email: string
      support_rep_id: number | null
    }, ExtArgs["result"]["customer"]>
    composites: {}
  }

  type customerGetPayload<S extends boolean | null | undefined | customerDefaultArgs> = $Result.GetResult<Prisma.$customerPayload, S>

  type customerCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<customerFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CustomerCountAggregateInputType | true
    }

  export interface customerDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['customer'], meta: { name: 'customer' } }
    /**
     * Find zero or one Customer that matches the filter.
     * @param {customerFindUniqueArgs} args - Arguments to find a Customer
     * @example
     * // Get one Customer
     * const customer = await prisma.customer.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends customerFindUniqueArgs>(args: SelectSubset<T, customerFindUniqueArgs<ExtArgs>>): Prisma__customerClient<$Result.GetResult<Prisma.$customerPayload<ExtArgs>, T, "findUnique", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find one Customer that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {customerFindUniqueOrThrowArgs} args - Arguments to find a Customer
     * @example
     * // Get one Customer
     * const customer = await prisma.customer.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends customerFindUniqueOrThrowArgs>(args: SelectSubset<T, customerFindUniqueOrThrowArgs<ExtArgs>>): Prisma__customerClient<$Result.GetResult<Prisma.$customerPayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find the first Customer that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {customerFindFirstArgs} args - Arguments to find a Customer
     * @example
     * // Get one Customer
     * const customer = await prisma.customer.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends customerFindFirstArgs>(args?: SelectSubset<T, customerFindFirstArgs<ExtArgs>>): Prisma__customerClient<$Result.GetResult<Prisma.$customerPayload<ExtArgs>, T, "findFirst", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find the first Customer that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {customerFindFirstOrThrowArgs} args - Arguments to find a Customer
     * @example
     * // Get one Customer
     * const customer = await prisma.customer.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends customerFindFirstOrThrowArgs>(args?: SelectSubset<T, customerFindFirstOrThrowArgs<ExtArgs>>): Prisma__customerClient<$Result.GetResult<Prisma.$customerPayload<ExtArgs>, T, "findFirstOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find zero or more Customers that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {customerFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Customers
     * const customers = await prisma.customer.findMany()
     * 
     * // Get first 10 Customers
     * const customers = await prisma.customer.findMany({ take: 10 })
     * 
     * // Only select the `customer_id`
     * const customerWithCustomer_idOnly = await prisma.customer.findMany({ select: { customer_id: true } })
     * 
     */
    findMany<T extends customerFindManyArgs>(args?: SelectSubset<T, customerFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$customerPayload<ExtArgs>, T, "findMany", ClientOptions>>

    /**
     * Create a Customer.
     * @param {customerCreateArgs} args - Arguments to create a Customer.
     * @example
     * // Create one Customer
     * const Customer = await prisma.customer.create({
     *   data: {
     *     // ... data to create a Customer
     *   }
     * })
     * 
     */
    create<T extends customerCreateArgs>(args: SelectSubset<T, customerCreateArgs<ExtArgs>>): Prisma__customerClient<$Result.GetResult<Prisma.$customerPayload<ExtArgs>, T, "create", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Create many Customers.
     * @param {customerCreateManyArgs} args - Arguments to create many Customers.
     * @example
     * // Create many Customers
     * const customer = await prisma.customer.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends customerCreateManyArgs>(args?: SelectSubset<T, customerCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Customers and returns the data saved in the database.
     * @param {customerCreateManyAndReturnArgs} args - Arguments to create many Customers.
     * @example
     * // Create many Customers
     * const customer = await prisma.customer.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Customers and only return the `customer_id`
     * const customerWithCustomer_idOnly = await prisma.customer.createManyAndReturn({
     *   select: { customer_id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends customerCreateManyAndReturnArgs>(args?: SelectSubset<T, customerCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$customerPayload<ExtArgs>, T, "createManyAndReturn", ClientOptions>>

    /**
     * Delete a Customer.
     * @param {customerDeleteArgs} args - Arguments to delete one Customer.
     * @example
     * // Delete one Customer
     * const Customer = await prisma.customer.delete({
     *   where: {
     *     // ... filter to delete one Customer
     *   }
     * })
     * 
     */
    delete<T extends customerDeleteArgs>(args: SelectSubset<T, customerDeleteArgs<ExtArgs>>): Prisma__customerClient<$Result.GetResult<Prisma.$customerPayload<ExtArgs>, T, "delete", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Update one Customer.
     * @param {customerUpdateArgs} args - Arguments to update one Customer.
     * @example
     * // Update one Customer
     * const customer = await prisma.customer.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends customerUpdateArgs>(args: SelectSubset<T, customerUpdateArgs<ExtArgs>>): Prisma__customerClient<$Result.GetResult<Prisma.$customerPayload<ExtArgs>, T, "update", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Delete zero or more Customers.
     * @param {customerDeleteManyArgs} args - Arguments to filter Customers to delete.
     * @example
     * // Delete a few Customers
     * const { count } = await prisma.customer.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends customerDeleteManyArgs>(args?: SelectSubset<T, customerDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Customers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {customerUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Customers
     * const customer = await prisma.customer.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends customerUpdateManyArgs>(args: SelectSubset<T, customerUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Customers and returns the data updated in the database.
     * @param {customerUpdateManyAndReturnArgs} args - Arguments to update many Customers.
     * @example
     * // Update many Customers
     * const customer = await prisma.customer.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Customers and only return the `customer_id`
     * const customerWithCustomer_idOnly = await prisma.customer.updateManyAndReturn({
     *   select: { customer_id: true },
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
    updateManyAndReturn<T extends customerUpdateManyAndReturnArgs>(args: SelectSubset<T, customerUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$customerPayload<ExtArgs>, T, "updateManyAndReturn", ClientOptions>>

    /**
     * Create or update one Customer.
     * @param {customerUpsertArgs} args - Arguments to update or create a Customer.
     * @example
     * // Update or create a Customer
     * const customer = await prisma.customer.upsert({
     *   create: {
     *     // ... data to create a Customer
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Customer we want to update
     *   }
     * })
     */
    upsert<T extends customerUpsertArgs>(args: SelectSubset<T, customerUpsertArgs<ExtArgs>>): Prisma__customerClient<$Result.GetResult<Prisma.$customerPayload<ExtArgs>, T, "upsert", ClientOptions>, never, ExtArgs, ClientOptions>


    /**
     * Count the number of Customers.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {customerCountArgs} args - Arguments to filter Customers to count.
     * @example
     * // Count the number of Customers
     * const count = await prisma.customer.count({
     *   where: {
     *     // ... the filter for the Customers we want to count
     *   }
     * })
    **/
    count<T extends customerCountArgs>(
      args?: Subset<T, customerCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CustomerCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Customer.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CustomerAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends CustomerAggregateArgs>(args: Subset<T, CustomerAggregateArgs>): Prisma.PrismaPromise<GetCustomerAggregateType<T>>

    /**
     * Group by Customer.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {customerGroupByArgs} args - Group by arguments.
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
      T extends customerGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: customerGroupByArgs['orderBy'] }
        : { orderBy?: customerGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, customerGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCustomerGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the customer model
   */
  readonly fields: customerFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for customer.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__customerClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    employee<T extends customer$employeeArgs<ExtArgs> = {}>(args?: Subset<T, customer$employeeArgs<ExtArgs>>): Prisma__employeeClient<$Result.GetResult<Prisma.$employeePayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions> | null, null, ExtArgs, ClientOptions>
    customer_review<T extends customer$customer_reviewArgs<ExtArgs> = {}>(args?: Subset<T, customer$customer_reviewArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$customer_reviewPayload<ExtArgs>, T, "findMany", ClientOptions> | Null>
    invoice<T extends customer$invoiceArgs<ExtArgs> = {}>(args?: Subset<T, customer$invoiceArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$invoicePayload<ExtArgs>, T, "findMany", ClientOptions> | Null>
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
   * Fields of the customer model
   */ 
  interface customerFieldRefs {
    readonly customer_id: FieldRef<"customer", 'Int'>
    readonly first_name: FieldRef<"customer", 'String'>
    readonly last_name: FieldRef<"customer", 'String'>
    readonly company: FieldRef<"customer", 'String'>
    readonly address: FieldRef<"customer", 'String'>
    readonly city: FieldRef<"customer", 'String'>
    readonly state: FieldRef<"customer", 'String'>
    readonly country: FieldRef<"customer", 'String'>
    readonly postal_code: FieldRef<"customer", 'String'>
    readonly phone: FieldRef<"customer", 'String'>
    readonly fax: FieldRef<"customer", 'String'>
    readonly email: FieldRef<"customer", 'String'>
    readonly support_rep_id: FieldRef<"customer", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * customer findUnique
   */
  export type customerFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer
     */
    select?: customerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer
     */
    omit?: customerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customerInclude<ExtArgs> | null
    /**
     * Filter, which customer to fetch.
     */
    where: customerWhereUniqueInput
  }

  /**
   * customer findUniqueOrThrow
   */
  export type customerFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer
     */
    select?: customerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer
     */
    omit?: customerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customerInclude<ExtArgs> | null
    /**
     * Filter, which customer to fetch.
     */
    where: customerWhereUniqueInput
  }

  /**
   * customer findFirst
   */
  export type customerFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer
     */
    select?: customerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer
     */
    omit?: customerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customerInclude<ExtArgs> | null
    /**
     * Filter, which customer to fetch.
     */
    where?: customerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of customers to fetch.
     */
    orderBy?: customerOrderByWithRelationInput | customerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for customers.
     */
    cursor?: customerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` customers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` customers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of customers.
     */
    distinct?: CustomerScalarFieldEnum | CustomerScalarFieldEnum[]
  }

  /**
   * customer findFirstOrThrow
   */
  export type customerFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer
     */
    select?: customerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer
     */
    omit?: customerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customerInclude<ExtArgs> | null
    /**
     * Filter, which customer to fetch.
     */
    where?: customerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of customers to fetch.
     */
    orderBy?: customerOrderByWithRelationInput | customerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for customers.
     */
    cursor?: customerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` customers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` customers.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of customers.
     */
    distinct?: CustomerScalarFieldEnum | CustomerScalarFieldEnum[]
  }

  /**
   * customer findMany
   */
  export type customerFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer
     */
    select?: customerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer
     */
    omit?: customerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customerInclude<ExtArgs> | null
    /**
     * Filter, which customers to fetch.
     */
    where?: customerWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of customers to fetch.
     */
    orderBy?: customerOrderByWithRelationInput | customerOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing customers.
     */
    cursor?: customerWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` customers from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` customers.
     */
    skip?: number
    distinct?: CustomerScalarFieldEnum | CustomerScalarFieldEnum[]
  }

  /**
   * customer create
   */
  export type customerCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer
     */
    select?: customerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer
     */
    omit?: customerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customerInclude<ExtArgs> | null
    /**
     * The data needed to create a customer.
     */
    data: XOR<customerCreateInput, customerUncheckedCreateInput>
  }

  /**
   * customer createMany
   */
  export type customerCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many customers.
     */
    data: customerCreateManyInput | customerCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * customer createManyAndReturn
   */
  export type customerCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer
     */
    select?: customerSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the customer
     */
    omit?: customerOmit<ExtArgs> | null
    /**
     * The data used to create many customers.
     */
    data: customerCreateManyInput | customerCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customerIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * customer update
   */
  export type customerUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer
     */
    select?: customerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer
     */
    omit?: customerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customerInclude<ExtArgs> | null
    /**
     * The data needed to update a customer.
     */
    data: XOR<customerUpdateInput, customerUncheckedUpdateInput>
    /**
     * Choose, which customer to update.
     */
    where: customerWhereUniqueInput
  }

  /**
   * customer updateMany
   */
  export type customerUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update customers.
     */
    data: XOR<customerUpdateManyMutationInput, customerUncheckedUpdateManyInput>
    /**
     * Filter which customers to update
     */
    where?: customerWhereInput
  }

  /**
   * customer updateManyAndReturn
   */
  export type customerUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer
     */
    select?: customerSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the customer
     */
    omit?: customerOmit<ExtArgs> | null
    /**
     * The data used to update customers.
     */
    data: XOR<customerUpdateManyMutationInput, customerUncheckedUpdateManyInput>
    /**
     * Filter which customers to update
     */
    where?: customerWhereInput
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customerIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * customer upsert
   */
  export type customerUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer
     */
    select?: customerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer
     */
    omit?: customerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customerInclude<ExtArgs> | null
    /**
     * The filter to search for the customer to update in case it exists.
     */
    where: customerWhereUniqueInput
    /**
     * In case the customer found by the `where` argument doesn't exist, create a new customer with this data.
     */
    create: XOR<customerCreateInput, customerUncheckedCreateInput>
    /**
     * In case the customer was found with the provided `where` argument, update it with this data.
     */
    update: XOR<customerUpdateInput, customerUncheckedUpdateInput>
  }

  /**
   * customer delete
   */
  export type customerDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer
     */
    select?: customerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer
     */
    omit?: customerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customerInclude<ExtArgs> | null
    /**
     * Filter which customer to delete.
     */
    where: customerWhereUniqueInput
  }

  /**
   * customer deleteMany
   */
  export type customerDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which customers to delete
     */
    where?: customerWhereInput
  }

  /**
   * customer.employee
   */
  export type customer$employeeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the employee
     */
    select?: employeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the employee
     */
    omit?: employeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: employeeInclude<ExtArgs> | null
    where?: employeeWhereInput
  }

  /**
   * customer.customer_review
   */
  export type customer$customer_reviewArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer_review
     */
    select?: customer_reviewSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer_review
     */
    omit?: customer_reviewOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customer_reviewInclude<ExtArgs> | null
    where?: customer_reviewWhereInput
    orderBy?: customer_reviewOrderByWithRelationInput | customer_reviewOrderByWithRelationInput[]
    cursor?: customer_reviewWhereUniqueInput
    take?: number
    skip?: number
    distinct?: Customer_reviewScalarFieldEnum | Customer_reviewScalarFieldEnum[]
  }

  /**
   * customer.invoice
   */
  export type customer$invoiceArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice
     */
    select?: invoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice
     */
    omit?: invoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoiceInclude<ExtArgs> | null
    where?: invoiceWhereInput
    orderBy?: invoiceOrderByWithRelationInput | invoiceOrderByWithRelationInput[]
    cursor?: invoiceWhereUniqueInput
    take?: number
    skip?: number
    distinct?: InvoiceScalarFieldEnum | InvoiceScalarFieldEnum[]
  }

  /**
   * customer without action
   */
  export type customerDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer
     */
    select?: customerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer
     */
    omit?: customerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customerInclude<ExtArgs> | null
  }


  /**
   * Model customer_review
   */

  export type AggregateCustomer_review = {
    _count: Customer_reviewCountAggregateOutputType | null
    _avg: Customer_reviewAvgAggregateOutputType | null
    _sum: Customer_reviewSumAggregateOutputType | null
    _min: Customer_reviewMinAggregateOutputType | null
    _max: Customer_reviewMaxAggregateOutputType | null
  }

  export type Customer_reviewAvgAggregateOutputType = {
    review_id: number | null
    customer_id: number | null
    invoice_id: number | null
    track_id: number | null
    rating: number | null
  }

  export type Customer_reviewSumAggregateOutputType = {
    review_id: number | null
    customer_id: number | null
    invoice_id: number | null
    track_id: number | null
    rating: number | null
  }

  export type Customer_reviewMinAggregateOutputType = {
    review_id: number | null
    customer_id: number | null
    invoice_id: number | null
    track_id: number | null
    rating: number | null
    review_comment: string | null
  }

  export type Customer_reviewMaxAggregateOutputType = {
    review_id: number | null
    customer_id: number | null
    invoice_id: number | null
    track_id: number | null
    rating: number | null
    review_comment: string | null
  }

  export type Customer_reviewCountAggregateOutputType = {
    review_id: number
    customer_id: number
    invoice_id: number
    track_id: number
    rating: number
    review_comment: number
    _all: number
  }


  export type Customer_reviewAvgAggregateInputType = {
    review_id?: true
    customer_id?: true
    invoice_id?: true
    track_id?: true
    rating?: true
  }

  export type Customer_reviewSumAggregateInputType = {
    review_id?: true
    customer_id?: true
    invoice_id?: true
    track_id?: true
    rating?: true
  }

  export type Customer_reviewMinAggregateInputType = {
    review_id?: true
    customer_id?: true
    invoice_id?: true
    track_id?: true
    rating?: true
    review_comment?: true
  }

  export type Customer_reviewMaxAggregateInputType = {
    review_id?: true
    customer_id?: true
    invoice_id?: true
    track_id?: true
    rating?: true
    review_comment?: true
  }

  export type Customer_reviewCountAggregateInputType = {
    review_id?: true
    customer_id?: true
    invoice_id?: true
    track_id?: true
    rating?: true
    review_comment?: true
    _all?: true
  }

  export type Customer_reviewAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which customer_review to aggregate.
     */
    where?: customer_reviewWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of customer_reviews to fetch.
     */
    orderBy?: customer_reviewOrderByWithRelationInput | customer_reviewOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: customer_reviewWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` customer_reviews from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` customer_reviews.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned customer_reviews
    **/
    _count?: true | Customer_reviewCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: Customer_reviewAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: Customer_reviewSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: Customer_reviewMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: Customer_reviewMaxAggregateInputType
  }

  export type GetCustomer_reviewAggregateType<T extends Customer_reviewAggregateArgs> = {
        [P in keyof T & keyof AggregateCustomer_review]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCustomer_review[P]>
      : GetScalarType<T[P], AggregateCustomer_review[P]>
  }




  export type customer_reviewGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: customer_reviewWhereInput
    orderBy?: customer_reviewOrderByWithAggregationInput | customer_reviewOrderByWithAggregationInput[]
    by: Customer_reviewScalarFieldEnum[] | Customer_reviewScalarFieldEnum
    having?: customer_reviewScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: Customer_reviewCountAggregateInputType | true
    _avg?: Customer_reviewAvgAggregateInputType
    _sum?: Customer_reviewSumAggregateInputType
    _min?: Customer_reviewMinAggregateInputType
    _max?: Customer_reviewMaxAggregateInputType
  }

  export type Customer_reviewGroupByOutputType = {
    review_id: number
    customer_id: number
    invoice_id: number
    track_id: number
    rating: number | null
    review_comment: string | null
    _count: Customer_reviewCountAggregateOutputType | null
    _avg: Customer_reviewAvgAggregateOutputType | null
    _sum: Customer_reviewSumAggregateOutputType | null
    _min: Customer_reviewMinAggregateOutputType | null
    _max: Customer_reviewMaxAggregateOutputType | null
  }

  type GetCustomer_reviewGroupByPayload<T extends customer_reviewGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<Customer_reviewGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof Customer_reviewGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], Customer_reviewGroupByOutputType[P]>
            : GetScalarType<T[P], Customer_reviewGroupByOutputType[P]>
        }
      >
    >


  export type customer_reviewSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    review_id?: boolean
    customer_id?: boolean
    invoice_id?: boolean
    track_id?: boolean
    rating?: boolean
    review_comment?: boolean
    customer?: boolean | customerDefaultArgs<ExtArgs>
    invoice?: boolean | invoiceDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["customer_review"]>

  export type customer_reviewSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    review_id?: boolean
    customer_id?: boolean
    invoice_id?: boolean
    track_id?: boolean
    rating?: boolean
    review_comment?: boolean
    customer?: boolean | customerDefaultArgs<ExtArgs>
    invoice?: boolean | invoiceDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["customer_review"]>

  export type customer_reviewSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    review_id?: boolean
    customer_id?: boolean
    invoice_id?: boolean
    track_id?: boolean
    rating?: boolean
    review_comment?: boolean
    customer?: boolean | customerDefaultArgs<ExtArgs>
    invoice?: boolean | invoiceDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["customer_review"]>

  export type customer_reviewSelectScalar = {
    review_id?: boolean
    customer_id?: boolean
    invoice_id?: boolean
    track_id?: boolean
    rating?: boolean
    review_comment?: boolean
  }

  export type customer_reviewOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"review_id" | "customer_id" | "invoice_id" | "track_id" | "rating" | "review_comment", ExtArgs["result"]["customer_review"]>
  export type customer_reviewInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    customer?: boolean | customerDefaultArgs<ExtArgs>
    invoice?: boolean | invoiceDefaultArgs<ExtArgs>
  }
  export type customer_reviewIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    customer?: boolean | customerDefaultArgs<ExtArgs>
    invoice?: boolean | invoiceDefaultArgs<ExtArgs>
  }
  export type customer_reviewIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    customer?: boolean | customerDefaultArgs<ExtArgs>
    invoice?: boolean | invoiceDefaultArgs<ExtArgs>
  }

  export type $customer_reviewPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "customer_review"
    objects: {
      customer: Prisma.$customerPayload<ExtArgs>
      invoice: Prisma.$invoicePayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      review_id: number
      customer_id: number
      invoice_id: number
      track_id: number
      rating: number | null
      review_comment: string | null
    }, ExtArgs["result"]["customer_review"]>
    composites: {}
  }

  type customer_reviewGetPayload<S extends boolean | null | undefined | customer_reviewDefaultArgs> = $Result.GetResult<Prisma.$customer_reviewPayload, S>

  type customer_reviewCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<customer_reviewFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: Customer_reviewCountAggregateInputType | true
    }

  export interface customer_reviewDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['customer_review'], meta: { name: 'customer_review' } }
    /**
     * Find zero or one Customer_review that matches the filter.
     * @param {customer_reviewFindUniqueArgs} args - Arguments to find a Customer_review
     * @example
     * // Get one Customer_review
     * const customer_review = await prisma.customer_review.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends customer_reviewFindUniqueArgs>(args: SelectSubset<T, customer_reviewFindUniqueArgs<ExtArgs>>): Prisma__customer_reviewClient<$Result.GetResult<Prisma.$customer_reviewPayload<ExtArgs>, T, "findUnique", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find one Customer_review that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {customer_reviewFindUniqueOrThrowArgs} args - Arguments to find a Customer_review
     * @example
     * // Get one Customer_review
     * const customer_review = await prisma.customer_review.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends customer_reviewFindUniqueOrThrowArgs>(args: SelectSubset<T, customer_reviewFindUniqueOrThrowArgs<ExtArgs>>): Prisma__customer_reviewClient<$Result.GetResult<Prisma.$customer_reviewPayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find the first Customer_review that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {customer_reviewFindFirstArgs} args - Arguments to find a Customer_review
     * @example
     * // Get one Customer_review
     * const customer_review = await prisma.customer_review.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends customer_reviewFindFirstArgs>(args?: SelectSubset<T, customer_reviewFindFirstArgs<ExtArgs>>): Prisma__customer_reviewClient<$Result.GetResult<Prisma.$customer_reviewPayload<ExtArgs>, T, "findFirst", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find the first Customer_review that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {customer_reviewFindFirstOrThrowArgs} args - Arguments to find a Customer_review
     * @example
     * // Get one Customer_review
     * const customer_review = await prisma.customer_review.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends customer_reviewFindFirstOrThrowArgs>(args?: SelectSubset<T, customer_reviewFindFirstOrThrowArgs<ExtArgs>>): Prisma__customer_reviewClient<$Result.GetResult<Prisma.$customer_reviewPayload<ExtArgs>, T, "findFirstOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find zero or more Customer_reviews that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {customer_reviewFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Customer_reviews
     * const customer_reviews = await prisma.customer_review.findMany()
     * 
     * // Get first 10 Customer_reviews
     * const customer_reviews = await prisma.customer_review.findMany({ take: 10 })
     * 
     * // Only select the `review_id`
     * const customer_reviewWithReview_idOnly = await prisma.customer_review.findMany({ select: { review_id: true } })
     * 
     */
    findMany<T extends customer_reviewFindManyArgs>(args?: SelectSubset<T, customer_reviewFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$customer_reviewPayload<ExtArgs>, T, "findMany", ClientOptions>>

    /**
     * Create a Customer_review.
     * @param {customer_reviewCreateArgs} args - Arguments to create a Customer_review.
     * @example
     * // Create one Customer_review
     * const Customer_review = await prisma.customer_review.create({
     *   data: {
     *     // ... data to create a Customer_review
     *   }
     * })
     * 
     */
    create<T extends customer_reviewCreateArgs>(args: SelectSubset<T, customer_reviewCreateArgs<ExtArgs>>): Prisma__customer_reviewClient<$Result.GetResult<Prisma.$customer_reviewPayload<ExtArgs>, T, "create", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Create many Customer_reviews.
     * @param {customer_reviewCreateManyArgs} args - Arguments to create many Customer_reviews.
     * @example
     * // Create many Customer_reviews
     * const customer_review = await prisma.customer_review.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends customer_reviewCreateManyArgs>(args?: SelectSubset<T, customer_reviewCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Customer_reviews and returns the data saved in the database.
     * @param {customer_reviewCreateManyAndReturnArgs} args - Arguments to create many Customer_reviews.
     * @example
     * // Create many Customer_reviews
     * const customer_review = await prisma.customer_review.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Customer_reviews and only return the `review_id`
     * const customer_reviewWithReview_idOnly = await prisma.customer_review.createManyAndReturn({
     *   select: { review_id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends customer_reviewCreateManyAndReturnArgs>(args?: SelectSubset<T, customer_reviewCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$customer_reviewPayload<ExtArgs>, T, "createManyAndReturn", ClientOptions>>

    /**
     * Delete a Customer_review.
     * @param {customer_reviewDeleteArgs} args - Arguments to delete one Customer_review.
     * @example
     * // Delete one Customer_review
     * const Customer_review = await prisma.customer_review.delete({
     *   where: {
     *     // ... filter to delete one Customer_review
     *   }
     * })
     * 
     */
    delete<T extends customer_reviewDeleteArgs>(args: SelectSubset<T, customer_reviewDeleteArgs<ExtArgs>>): Prisma__customer_reviewClient<$Result.GetResult<Prisma.$customer_reviewPayload<ExtArgs>, T, "delete", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Update one Customer_review.
     * @param {customer_reviewUpdateArgs} args - Arguments to update one Customer_review.
     * @example
     * // Update one Customer_review
     * const customer_review = await prisma.customer_review.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends customer_reviewUpdateArgs>(args: SelectSubset<T, customer_reviewUpdateArgs<ExtArgs>>): Prisma__customer_reviewClient<$Result.GetResult<Prisma.$customer_reviewPayload<ExtArgs>, T, "update", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Delete zero or more Customer_reviews.
     * @param {customer_reviewDeleteManyArgs} args - Arguments to filter Customer_reviews to delete.
     * @example
     * // Delete a few Customer_reviews
     * const { count } = await prisma.customer_review.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends customer_reviewDeleteManyArgs>(args?: SelectSubset<T, customer_reviewDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Customer_reviews.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {customer_reviewUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Customer_reviews
     * const customer_review = await prisma.customer_review.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends customer_reviewUpdateManyArgs>(args: SelectSubset<T, customer_reviewUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Customer_reviews and returns the data updated in the database.
     * @param {customer_reviewUpdateManyAndReturnArgs} args - Arguments to update many Customer_reviews.
     * @example
     * // Update many Customer_reviews
     * const customer_review = await prisma.customer_review.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Customer_reviews and only return the `review_id`
     * const customer_reviewWithReview_idOnly = await prisma.customer_review.updateManyAndReturn({
     *   select: { review_id: true },
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
    updateManyAndReturn<T extends customer_reviewUpdateManyAndReturnArgs>(args: SelectSubset<T, customer_reviewUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$customer_reviewPayload<ExtArgs>, T, "updateManyAndReturn", ClientOptions>>

    /**
     * Create or update one Customer_review.
     * @param {customer_reviewUpsertArgs} args - Arguments to update or create a Customer_review.
     * @example
     * // Update or create a Customer_review
     * const customer_review = await prisma.customer_review.upsert({
     *   create: {
     *     // ... data to create a Customer_review
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Customer_review we want to update
     *   }
     * })
     */
    upsert<T extends customer_reviewUpsertArgs>(args: SelectSubset<T, customer_reviewUpsertArgs<ExtArgs>>): Prisma__customer_reviewClient<$Result.GetResult<Prisma.$customer_reviewPayload<ExtArgs>, T, "upsert", ClientOptions>, never, ExtArgs, ClientOptions>


    /**
     * Count the number of Customer_reviews.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {customer_reviewCountArgs} args - Arguments to filter Customer_reviews to count.
     * @example
     * // Count the number of Customer_reviews
     * const count = await prisma.customer_review.count({
     *   where: {
     *     // ... the filter for the Customer_reviews we want to count
     *   }
     * })
    **/
    count<T extends customer_reviewCountArgs>(
      args?: Subset<T, customer_reviewCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], Customer_reviewCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Customer_review.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {Customer_reviewAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends Customer_reviewAggregateArgs>(args: Subset<T, Customer_reviewAggregateArgs>): Prisma.PrismaPromise<GetCustomer_reviewAggregateType<T>>

    /**
     * Group by Customer_review.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {customer_reviewGroupByArgs} args - Group by arguments.
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
      T extends customer_reviewGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: customer_reviewGroupByArgs['orderBy'] }
        : { orderBy?: customer_reviewGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, customer_reviewGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCustomer_reviewGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the customer_review model
   */
  readonly fields: customer_reviewFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for customer_review.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__customer_reviewClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    customer<T extends customerDefaultArgs<ExtArgs> = {}>(args?: Subset<T, customerDefaultArgs<ExtArgs>>): Prisma__customerClient<$Result.GetResult<Prisma.$customerPayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions> | Null, Null, ExtArgs, ClientOptions>
    invoice<T extends invoiceDefaultArgs<ExtArgs> = {}>(args?: Subset<T, invoiceDefaultArgs<ExtArgs>>): Prisma__invoiceClient<$Result.GetResult<Prisma.$invoicePayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions> | Null, Null, ExtArgs, ClientOptions>
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
   * Fields of the customer_review model
   */ 
  interface customer_reviewFieldRefs {
    readonly review_id: FieldRef<"customer_review", 'Int'>
    readonly customer_id: FieldRef<"customer_review", 'Int'>
    readonly invoice_id: FieldRef<"customer_review", 'Int'>
    readonly track_id: FieldRef<"customer_review", 'Int'>
    readonly rating: FieldRef<"customer_review", 'Int'>
    readonly review_comment: FieldRef<"customer_review", 'String'>
  }
    

  // Custom InputTypes
  /**
   * customer_review findUnique
   */
  export type customer_reviewFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer_review
     */
    select?: customer_reviewSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer_review
     */
    omit?: customer_reviewOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customer_reviewInclude<ExtArgs> | null
    /**
     * Filter, which customer_review to fetch.
     */
    where: customer_reviewWhereUniqueInput
  }

  /**
   * customer_review findUniqueOrThrow
   */
  export type customer_reviewFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer_review
     */
    select?: customer_reviewSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer_review
     */
    omit?: customer_reviewOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customer_reviewInclude<ExtArgs> | null
    /**
     * Filter, which customer_review to fetch.
     */
    where: customer_reviewWhereUniqueInput
  }

  /**
   * customer_review findFirst
   */
  export type customer_reviewFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer_review
     */
    select?: customer_reviewSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer_review
     */
    omit?: customer_reviewOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customer_reviewInclude<ExtArgs> | null
    /**
     * Filter, which customer_review to fetch.
     */
    where?: customer_reviewWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of customer_reviews to fetch.
     */
    orderBy?: customer_reviewOrderByWithRelationInput | customer_reviewOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for customer_reviews.
     */
    cursor?: customer_reviewWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` customer_reviews from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` customer_reviews.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of customer_reviews.
     */
    distinct?: Customer_reviewScalarFieldEnum | Customer_reviewScalarFieldEnum[]
  }

  /**
   * customer_review findFirstOrThrow
   */
  export type customer_reviewFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer_review
     */
    select?: customer_reviewSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer_review
     */
    omit?: customer_reviewOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customer_reviewInclude<ExtArgs> | null
    /**
     * Filter, which customer_review to fetch.
     */
    where?: customer_reviewWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of customer_reviews to fetch.
     */
    orderBy?: customer_reviewOrderByWithRelationInput | customer_reviewOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for customer_reviews.
     */
    cursor?: customer_reviewWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` customer_reviews from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` customer_reviews.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of customer_reviews.
     */
    distinct?: Customer_reviewScalarFieldEnum | Customer_reviewScalarFieldEnum[]
  }

  /**
   * customer_review findMany
   */
  export type customer_reviewFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer_review
     */
    select?: customer_reviewSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer_review
     */
    omit?: customer_reviewOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customer_reviewInclude<ExtArgs> | null
    /**
     * Filter, which customer_reviews to fetch.
     */
    where?: customer_reviewWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of customer_reviews to fetch.
     */
    orderBy?: customer_reviewOrderByWithRelationInput | customer_reviewOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing customer_reviews.
     */
    cursor?: customer_reviewWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` customer_reviews from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` customer_reviews.
     */
    skip?: number
    distinct?: Customer_reviewScalarFieldEnum | Customer_reviewScalarFieldEnum[]
  }

  /**
   * customer_review create
   */
  export type customer_reviewCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer_review
     */
    select?: customer_reviewSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer_review
     */
    omit?: customer_reviewOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customer_reviewInclude<ExtArgs> | null
    /**
     * The data needed to create a customer_review.
     */
    data: XOR<customer_reviewCreateInput, customer_reviewUncheckedCreateInput>
  }

  /**
   * customer_review createMany
   */
  export type customer_reviewCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many customer_reviews.
     */
    data: customer_reviewCreateManyInput | customer_reviewCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * customer_review createManyAndReturn
   */
  export type customer_reviewCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer_review
     */
    select?: customer_reviewSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the customer_review
     */
    omit?: customer_reviewOmit<ExtArgs> | null
    /**
     * The data used to create many customer_reviews.
     */
    data: customer_reviewCreateManyInput | customer_reviewCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customer_reviewIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * customer_review update
   */
  export type customer_reviewUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer_review
     */
    select?: customer_reviewSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer_review
     */
    omit?: customer_reviewOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customer_reviewInclude<ExtArgs> | null
    /**
     * The data needed to update a customer_review.
     */
    data: XOR<customer_reviewUpdateInput, customer_reviewUncheckedUpdateInput>
    /**
     * Choose, which customer_review to update.
     */
    where: customer_reviewWhereUniqueInput
  }

  /**
   * customer_review updateMany
   */
  export type customer_reviewUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update customer_reviews.
     */
    data: XOR<customer_reviewUpdateManyMutationInput, customer_reviewUncheckedUpdateManyInput>
    /**
     * Filter which customer_reviews to update
     */
    where?: customer_reviewWhereInput
  }

  /**
   * customer_review updateManyAndReturn
   */
  export type customer_reviewUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer_review
     */
    select?: customer_reviewSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the customer_review
     */
    omit?: customer_reviewOmit<ExtArgs> | null
    /**
     * The data used to update customer_reviews.
     */
    data: XOR<customer_reviewUpdateManyMutationInput, customer_reviewUncheckedUpdateManyInput>
    /**
     * Filter which customer_reviews to update
     */
    where?: customer_reviewWhereInput
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customer_reviewIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * customer_review upsert
   */
  export type customer_reviewUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer_review
     */
    select?: customer_reviewSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer_review
     */
    omit?: customer_reviewOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customer_reviewInclude<ExtArgs> | null
    /**
     * The filter to search for the customer_review to update in case it exists.
     */
    where: customer_reviewWhereUniqueInput
    /**
     * In case the customer_review found by the `where` argument doesn't exist, create a new customer_review with this data.
     */
    create: XOR<customer_reviewCreateInput, customer_reviewUncheckedCreateInput>
    /**
     * In case the customer_review was found with the provided `where` argument, update it with this data.
     */
    update: XOR<customer_reviewUpdateInput, customer_reviewUncheckedUpdateInput>
  }

  /**
   * customer_review delete
   */
  export type customer_reviewDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer_review
     */
    select?: customer_reviewSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer_review
     */
    omit?: customer_reviewOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customer_reviewInclude<ExtArgs> | null
    /**
     * Filter which customer_review to delete.
     */
    where: customer_reviewWhereUniqueInput
  }

  /**
   * customer_review deleteMany
   */
  export type customer_reviewDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which customer_reviews to delete
     */
    where?: customer_reviewWhereInput
  }

  /**
   * customer_review without action
   */
  export type customer_reviewDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer_review
     */
    select?: customer_reviewSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer_review
     */
    omit?: customer_reviewOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customer_reviewInclude<ExtArgs> | null
  }


  /**
   * Model employee
   */

  export type AggregateEmployee = {
    _count: EmployeeCountAggregateOutputType | null
    _avg: EmployeeAvgAggregateOutputType | null
    _sum: EmployeeSumAggregateOutputType | null
    _min: EmployeeMinAggregateOutputType | null
    _max: EmployeeMaxAggregateOutputType | null
  }

  export type EmployeeAvgAggregateOutputType = {
    employee_id: number | null
    reports_to: number | null
  }

  export type EmployeeSumAggregateOutputType = {
    employee_id: number | null
    reports_to: number | null
  }

  export type EmployeeMinAggregateOutputType = {
    employee_id: number | null
    last_name: string | null
    first_name: string | null
    title: string | null
    reports_to: number | null
    birth_date: Date | null
    hire_date: Date | null
    address: string | null
    city: string | null
    state: string | null
    country: string | null
    postal_code: string | null
    phone: string | null
    fax: string | null
    email: string | null
    termination_date: Date | null
  }

  export type EmployeeMaxAggregateOutputType = {
    employee_id: number | null
    last_name: string | null
    first_name: string | null
    title: string | null
    reports_to: number | null
    birth_date: Date | null
    hire_date: Date | null
    address: string | null
    city: string | null
    state: string | null
    country: string | null
    postal_code: string | null
    phone: string | null
    fax: string | null
    email: string | null
    termination_date: Date | null
  }

  export type EmployeeCountAggregateOutputType = {
    employee_id: number
    last_name: number
    first_name: number
    title: number
    reports_to: number
    birth_date: number
    hire_date: number
    address: number
    city: number
    state: number
    country: number
    postal_code: number
    phone: number
    fax: number
    email: number
    termination_date: number
    _all: number
  }


  export type EmployeeAvgAggregateInputType = {
    employee_id?: true
    reports_to?: true
  }

  export type EmployeeSumAggregateInputType = {
    employee_id?: true
    reports_to?: true
  }

  export type EmployeeMinAggregateInputType = {
    employee_id?: true
    last_name?: true
    first_name?: true
    title?: true
    reports_to?: true
    birth_date?: true
    hire_date?: true
    address?: true
    city?: true
    state?: true
    country?: true
    postal_code?: true
    phone?: true
    fax?: true
    email?: true
    termination_date?: true
  }

  export type EmployeeMaxAggregateInputType = {
    employee_id?: true
    last_name?: true
    first_name?: true
    title?: true
    reports_to?: true
    birth_date?: true
    hire_date?: true
    address?: true
    city?: true
    state?: true
    country?: true
    postal_code?: true
    phone?: true
    fax?: true
    email?: true
    termination_date?: true
  }

  export type EmployeeCountAggregateInputType = {
    employee_id?: true
    last_name?: true
    first_name?: true
    title?: true
    reports_to?: true
    birth_date?: true
    hire_date?: true
    address?: true
    city?: true
    state?: true
    country?: true
    postal_code?: true
    phone?: true
    fax?: true
    email?: true
    termination_date?: true
    _all?: true
  }

  export type EmployeeAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which employee to aggregate.
     */
    where?: employeeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of employees to fetch.
     */
    orderBy?: employeeOrderByWithRelationInput | employeeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: employeeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` employees from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` employees.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned employees
    **/
    _count?: true | EmployeeCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: EmployeeAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: EmployeeSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: EmployeeMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: EmployeeMaxAggregateInputType
  }

  export type GetEmployeeAggregateType<T extends EmployeeAggregateArgs> = {
        [P in keyof T & keyof AggregateEmployee]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateEmployee[P]>
      : GetScalarType<T[P], AggregateEmployee[P]>
  }




  export type employeeGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: employeeWhereInput
    orderBy?: employeeOrderByWithAggregationInput | employeeOrderByWithAggregationInput[]
    by: EmployeeScalarFieldEnum[] | EmployeeScalarFieldEnum
    having?: employeeScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: EmployeeCountAggregateInputType | true
    _avg?: EmployeeAvgAggregateInputType
    _sum?: EmployeeSumAggregateInputType
    _min?: EmployeeMinAggregateInputType
    _max?: EmployeeMaxAggregateInputType
  }

  export type EmployeeGroupByOutputType = {
    employee_id: number
    last_name: string
    first_name: string
    title: string | null
    reports_to: number | null
    birth_date: Date | null
    hire_date: Date
    address: string | null
    city: string | null
    state: string | null
    country: string | null
    postal_code: string | null
    phone: string | null
    fax: string | null
    email: string | null
    termination_date: Date | null
    _count: EmployeeCountAggregateOutputType | null
    _avg: EmployeeAvgAggregateOutputType | null
    _sum: EmployeeSumAggregateOutputType | null
    _min: EmployeeMinAggregateOutputType | null
    _max: EmployeeMaxAggregateOutputType | null
  }

  type GetEmployeeGroupByPayload<T extends employeeGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<EmployeeGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof EmployeeGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], EmployeeGroupByOutputType[P]>
            : GetScalarType<T[P], EmployeeGroupByOutputType[P]>
        }
      >
    >


  export type employeeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    employee_id?: boolean
    last_name?: boolean
    first_name?: boolean
    title?: boolean
    reports_to?: boolean
    birth_date?: boolean
    hire_date?: boolean
    address?: boolean
    city?: boolean
    state?: boolean
    country?: boolean
    postal_code?: boolean
    phone?: boolean
    fax?: boolean
    email?: boolean
    termination_date?: boolean
    customer?: boolean | employee$customerArgs<ExtArgs>
    employee?: boolean | employee$employeeArgs<ExtArgs>
    other_employee?: boolean | employee$other_employeeArgs<ExtArgs>
    track_discount?: boolean | employee$track_discountArgs<ExtArgs>
    _count?: boolean | EmployeeCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["employee"]>

  export type employeeSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    employee_id?: boolean
    last_name?: boolean
    first_name?: boolean
    title?: boolean
    reports_to?: boolean
    birth_date?: boolean
    hire_date?: boolean
    address?: boolean
    city?: boolean
    state?: boolean
    country?: boolean
    postal_code?: boolean
    phone?: boolean
    fax?: boolean
    email?: boolean
    termination_date?: boolean
    employee?: boolean | employee$employeeArgs<ExtArgs>
  }, ExtArgs["result"]["employee"]>

  export type employeeSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    employee_id?: boolean
    last_name?: boolean
    first_name?: boolean
    title?: boolean
    reports_to?: boolean
    birth_date?: boolean
    hire_date?: boolean
    address?: boolean
    city?: boolean
    state?: boolean
    country?: boolean
    postal_code?: boolean
    phone?: boolean
    fax?: boolean
    email?: boolean
    termination_date?: boolean
    employee?: boolean | employee$employeeArgs<ExtArgs>
  }, ExtArgs["result"]["employee"]>

  export type employeeSelectScalar = {
    employee_id?: boolean
    last_name?: boolean
    first_name?: boolean
    title?: boolean
    reports_to?: boolean
    birth_date?: boolean
    hire_date?: boolean
    address?: boolean
    city?: boolean
    state?: boolean
    country?: boolean
    postal_code?: boolean
    phone?: boolean
    fax?: boolean
    email?: boolean
    termination_date?: boolean
  }

  export type employeeOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"employee_id" | "last_name" | "first_name" | "title" | "reports_to" | "birth_date" | "hire_date" | "address" | "city" | "state" | "country" | "postal_code" | "phone" | "fax" | "email" | "termination_date", ExtArgs["result"]["employee"]>
  export type employeeInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    customer?: boolean | employee$customerArgs<ExtArgs>
    employee?: boolean | employee$employeeArgs<ExtArgs>
    other_employee?: boolean | employee$other_employeeArgs<ExtArgs>
    track_discount?: boolean | employee$track_discountArgs<ExtArgs>
    _count?: boolean | EmployeeCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type employeeIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    employee?: boolean | employee$employeeArgs<ExtArgs>
  }
  export type employeeIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    employee?: boolean | employee$employeeArgs<ExtArgs>
  }

  export type $employeePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "employee"
    objects: {
      customer: Prisma.$customerPayload<ExtArgs>[]
      employee: Prisma.$employeePayload<ExtArgs> | null
      other_employee: Prisma.$employeePayload<ExtArgs>[]
      track_discount: Prisma.$track_discountPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      employee_id: number
      last_name: string
      first_name: string
      title: string | null
      reports_to: number | null
      birth_date: Date | null
      hire_date: Date
      address: string | null
      city: string | null
      state: string | null
      country: string | null
      postal_code: string | null
      phone: string | null
      fax: string | null
      email: string | null
      termination_date: Date | null
    }, ExtArgs["result"]["employee"]>
    composites: {}
  }

  type employeeGetPayload<S extends boolean | null | undefined | employeeDefaultArgs> = $Result.GetResult<Prisma.$employeePayload, S>

  type employeeCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<employeeFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: EmployeeCountAggregateInputType | true
    }

  export interface employeeDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['employee'], meta: { name: 'employee' } }
    /**
     * Find zero or one Employee that matches the filter.
     * @param {employeeFindUniqueArgs} args - Arguments to find a Employee
     * @example
     * // Get one Employee
     * const employee = await prisma.employee.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends employeeFindUniqueArgs>(args: SelectSubset<T, employeeFindUniqueArgs<ExtArgs>>): Prisma__employeeClient<$Result.GetResult<Prisma.$employeePayload<ExtArgs>, T, "findUnique", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find one Employee that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {employeeFindUniqueOrThrowArgs} args - Arguments to find a Employee
     * @example
     * // Get one Employee
     * const employee = await prisma.employee.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends employeeFindUniqueOrThrowArgs>(args: SelectSubset<T, employeeFindUniqueOrThrowArgs<ExtArgs>>): Prisma__employeeClient<$Result.GetResult<Prisma.$employeePayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find the first Employee that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {employeeFindFirstArgs} args - Arguments to find a Employee
     * @example
     * // Get one Employee
     * const employee = await prisma.employee.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends employeeFindFirstArgs>(args?: SelectSubset<T, employeeFindFirstArgs<ExtArgs>>): Prisma__employeeClient<$Result.GetResult<Prisma.$employeePayload<ExtArgs>, T, "findFirst", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find the first Employee that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {employeeFindFirstOrThrowArgs} args - Arguments to find a Employee
     * @example
     * // Get one Employee
     * const employee = await prisma.employee.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends employeeFindFirstOrThrowArgs>(args?: SelectSubset<T, employeeFindFirstOrThrowArgs<ExtArgs>>): Prisma__employeeClient<$Result.GetResult<Prisma.$employeePayload<ExtArgs>, T, "findFirstOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find zero or more Employees that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {employeeFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Employees
     * const employees = await prisma.employee.findMany()
     * 
     * // Get first 10 Employees
     * const employees = await prisma.employee.findMany({ take: 10 })
     * 
     * // Only select the `employee_id`
     * const employeeWithEmployee_idOnly = await prisma.employee.findMany({ select: { employee_id: true } })
     * 
     */
    findMany<T extends employeeFindManyArgs>(args?: SelectSubset<T, employeeFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$employeePayload<ExtArgs>, T, "findMany", ClientOptions>>

    /**
     * Create a Employee.
     * @param {employeeCreateArgs} args - Arguments to create a Employee.
     * @example
     * // Create one Employee
     * const Employee = await prisma.employee.create({
     *   data: {
     *     // ... data to create a Employee
     *   }
     * })
     * 
     */
    create<T extends employeeCreateArgs>(args: SelectSubset<T, employeeCreateArgs<ExtArgs>>): Prisma__employeeClient<$Result.GetResult<Prisma.$employeePayload<ExtArgs>, T, "create", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Create many Employees.
     * @param {employeeCreateManyArgs} args - Arguments to create many Employees.
     * @example
     * // Create many Employees
     * const employee = await prisma.employee.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends employeeCreateManyArgs>(args?: SelectSubset<T, employeeCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Employees and returns the data saved in the database.
     * @param {employeeCreateManyAndReturnArgs} args - Arguments to create many Employees.
     * @example
     * // Create many Employees
     * const employee = await prisma.employee.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Employees and only return the `employee_id`
     * const employeeWithEmployee_idOnly = await prisma.employee.createManyAndReturn({
     *   select: { employee_id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends employeeCreateManyAndReturnArgs>(args?: SelectSubset<T, employeeCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$employeePayload<ExtArgs>, T, "createManyAndReturn", ClientOptions>>

    /**
     * Delete a Employee.
     * @param {employeeDeleteArgs} args - Arguments to delete one Employee.
     * @example
     * // Delete one Employee
     * const Employee = await prisma.employee.delete({
     *   where: {
     *     // ... filter to delete one Employee
     *   }
     * })
     * 
     */
    delete<T extends employeeDeleteArgs>(args: SelectSubset<T, employeeDeleteArgs<ExtArgs>>): Prisma__employeeClient<$Result.GetResult<Prisma.$employeePayload<ExtArgs>, T, "delete", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Update one Employee.
     * @param {employeeUpdateArgs} args - Arguments to update one Employee.
     * @example
     * // Update one Employee
     * const employee = await prisma.employee.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends employeeUpdateArgs>(args: SelectSubset<T, employeeUpdateArgs<ExtArgs>>): Prisma__employeeClient<$Result.GetResult<Prisma.$employeePayload<ExtArgs>, T, "update", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Delete zero or more Employees.
     * @param {employeeDeleteManyArgs} args - Arguments to filter Employees to delete.
     * @example
     * // Delete a few Employees
     * const { count } = await prisma.employee.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends employeeDeleteManyArgs>(args?: SelectSubset<T, employeeDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Employees.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {employeeUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Employees
     * const employee = await prisma.employee.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends employeeUpdateManyArgs>(args: SelectSubset<T, employeeUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Employees and returns the data updated in the database.
     * @param {employeeUpdateManyAndReturnArgs} args - Arguments to update many Employees.
     * @example
     * // Update many Employees
     * const employee = await prisma.employee.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Employees and only return the `employee_id`
     * const employeeWithEmployee_idOnly = await prisma.employee.updateManyAndReturn({
     *   select: { employee_id: true },
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
    updateManyAndReturn<T extends employeeUpdateManyAndReturnArgs>(args: SelectSubset<T, employeeUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$employeePayload<ExtArgs>, T, "updateManyAndReturn", ClientOptions>>

    /**
     * Create or update one Employee.
     * @param {employeeUpsertArgs} args - Arguments to update or create a Employee.
     * @example
     * // Update or create a Employee
     * const employee = await prisma.employee.upsert({
     *   create: {
     *     // ... data to create a Employee
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Employee we want to update
     *   }
     * })
     */
    upsert<T extends employeeUpsertArgs>(args: SelectSubset<T, employeeUpsertArgs<ExtArgs>>): Prisma__employeeClient<$Result.GetResult<Prisma.$employeePayload<ExtArgs>, T, "upsert", ClientOptions>, never, ExtArgs, ClientOptions>


    /**
     * Count the number of Employees.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {employeeCountArgs} args - Arguments to filter Employees to count.
     * @example
     * // Count the number of Employees
     * const count = await prisma.employee.count({
     *   where: {
     *     // ... the filter for the Employees we want to count
     *   }
     * })
    **/
    count<T extends employeeCountArgs>(
      args?: Subset<T, employeeCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], EmployeeCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Employee.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EmployeeAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends EmployeeAggregateArgs>(args: Subset<T, EmployeeAggregateArgs>): Prisma.PrismaPromise<GetEmployeeAggregateType<T>>

    /**
     * Group by Employee.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {employeeGroupByArgs} args - Group by arguments.
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
      T extends employeeGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: employeeGroupByArgs['orderBy'] }
        : { orderBy?: employeeGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, employeeGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetEmployeeGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the employee model
   */
  readonly fields: employeeFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for employee.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__employeeClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    customer<T extends employee$customerArgs<ExtArgs> = {}>(args?: Subset<T, employee$customerArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$customerPayload<ExtArgs>, T, "findMany", ClientOptions> | Null>
    employee<T extends employee$employeeArgs<ExtArgs> = {}>(args?: Subset<T, employee$employeeArgs<ExtArgs>>): Prisma__employeeClient<$Result.GetResult<Prisma.$employeePayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions> | null, null, ExtArgs, ClientOptions>
    other_employee<T extends employee$other_employeeArgs<ExtArgs> = {}>(args?: Subset<T, employee$other_employeeArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$employeePayload<ExtArgs>, T, "findMany", ClientOptions> | Null>
    track_discount<T extends employee$track_discountArgs<ExtArgs> = {}>(args?: Subset<T, employee$track_discountArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$track_discountPayload<ExtArgs>, T, "findMany", ClientOptions> | Null>
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
   * Fields of the employee model
   */ 
  interface employeeFieldRefs {
    readonly employee_id: FieldRef<"employee", 'Int'>
    readonly last_name: FieldRef<"employee", 'String'>
    readonly first_name: FieldRef<"employee", 'String'>
    readonly title: FieldRef<"employee", 'String'>
    readonly reports_to: FieldRef<"employee", 'Int'>
    readonly birth_date: FieldRef<"employee", 'DateTime'>
    readonly hire_date: FieldRef<"employee", 'DateTime'>
    readonly address: FieldRef<"employee", 'String'>
    readonly city: FieldRef<"employee", 'String'>
    readonly state: FieldRef<"employee", 'String'>
    readonly country: FieldRef<"employee", 'String'>
    readonly postal_code: FieldRef<"employee", 'String'>
    readonly phone: FieldRef<"employee", 'String'>
    readonly fax: FieldRef<"employee", 'String'>
    readonly email: FieldRef<"employee", 'String'>
    readonly termination_date: FieldRef<"employee", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * employee findUnique
   */
  export type employeeFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the employee
     */
    select?: employeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the employee
     */
    omit?: employeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: employeeInclude<ExtArgs> | null
    /**
     * Filter, which employee to fetch.
     */
    where: employeeWhereUniqueInput
  }

  /**
   * employee findUniqueOrThrow
   */
  export type employeeFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the employee
     */
    select?: employeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the employee
     */
    omit?: employeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: employeeInclude<ExtArgs> | null
    /**
     * Filter, which employee to fetch.
     */
    where: employeeWhereUniqueInput
  }

  /**
   * employee findFirst
   */
  export type employeeFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the employee
     */
    select?: employeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the employee
     */
    omit?: employeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: employeeInclude<ExtArgs> | null
    /**
     * Filter, which employee to fetch.
     */
    where?: employeeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of employees to fetch.
     */
    orderBy?: employeeOrderByWithRelationInput | employeeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for employees.
     */
    cursor?: employeeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` employees from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` employees.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of employees.
     */
    distinct?: EmployeeScalarFieldEnum | EmployeeScalarFieldEnum[]
  }

  /**
   * employee findFirstOrThrow
   */
  export type employeeFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the employee
     */
    select?: employeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the employee
     */
    omit?: employeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: employeeInclude<ExtArgs> | null
    /**
     * Filter, which employee to fetch.
     */
    where?: employeeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of employees to fetch.
     */
    orderBy?: employeeOrderByWithRelationInput | employeeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for employees.
     */
    cursor?: employeeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` employees from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` employees.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of employees.
     */
    distinct?: EmployeeScalarFieldEnum | EmployeeScalarFieldEnum[]
  }

  /**
   * employee findMany
   */
  export type employeeFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the employee
     */
    select?: employeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the employee
     */
    omit?: employeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: employeeInclude<ExtArgs> | null
    /**
     * Filter, which employees to fetch.
     */
    where?: employeeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of employees to fetch.
     */
    orderBy?: employeeOrderByWithRelationInput | employeeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing employees.
     */
    cursor?: employeeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` employees from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` employees.
     */
    skip?: number
    distinct?: EmployeeScalarFieldEnum | EmployeeScalarFieldEnum[]
  }

  /**
   * employee create
   */
  export type employeeCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the employee
     */
    select?: employeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the employee
     */
    omit?: employeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: employeeInclude<ExtArgs> | null
    /**
     * The data needed to create a employee.
     */
    data: XOR<employeeCreateInput, employeeUncheckedCreateInput>
  }

  /**
   * employee createMany
   */
  export type employeeCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many employees.
     */
    data: employeeCreateManyInput | employeeCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * employee createManyAndReturn
   */
  export type employeeCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the employee
     */
    select?: employeeSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the employee
     */
    omit?: employeeOmit<ExtArgs> | null
    /**
     * The data used to create many employees.
     */
    data: employeeCreateManyInput | employeeCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: employeeIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * employee update
   */
  export type employeeUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the employee
     */
    select?: employeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the employee
     */
    omit?: employeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: employeeInclude<ExtArgs> | null
    /**
     * The data needed to update a employee.
     */
    data: XOR<employeeUpdateInput, employeeUncheckedUpdateInput>
    /**
     * Choose, which employee to update.
     */
    where: employeeWhereUniqueInput
  }

  /**
   * employee updateMany
   */
  export type employeeUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update employees.
     */
    data: XOR<employeeUpdateManyMutationInput, employeeUncheckedUpdateManyInput>
    /**
     * Filter which employees to update
     */
    where?: employeeWhereInput
  }

  /**
   * employee updateManyAndReturn
   */
  export type employeeUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the employee
     */
    select?: employeeSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the employee
     */
    omit?: employeeOmit<ExtArgs> | null
    /**
     * The data used to update employees.
     */
    data: XOR<employeeUpdateManyMutationInput, employeeUncheckedUpdateManyInput>
    /**
     * Filter which employees to update
     */
    where?: employeeWhereInput
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: employeeIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * employee upsert
   */
  export type employeeUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the employee
     */
    select?: employeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the employee
     */
    omit?: employeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: employeeInclude<ExtArgs> | null
    /**
     * The filter to search for the employee to update in case it exists.
     */
    where: employeeWhereUniqueInput
    /**
     * In case the employee found by the `where` argument doesn't exist, create a new employee with this data.
     */
    create: XOR<employeeCreateInput, employeeUncheckedCreateInput>
    /**
     * In case the employee was found with the provided `where` argument, update it with this data.
     */
    update: XOR<employeeUpdateInput, employeeUncheckedUpdateInput>
  }

  /**
   * employee delete
   */
  export type employeeDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the employee
     */
    select?: employeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the employee
     */
    omit?: employeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: employeeInclude<ExtArgs> | null
    /**
     * Filter which employee to delete.
     */
    where: employeeWhereUniqueInput
  }

  /**
   * employee deleteMany
   */
  export type employeeDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which employees to delete
     */
    where?: employeeWhereInput
  }

  /**
   * employee.customer
   */
  export type employee$customerArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer
     */
    select?: customerSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer
     */
    omit?: customerOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customerInclude<ExtArgs> | null
    where?: customerWhereInput
    orderBy?: customerOrderByWithRelationInput | customerOrderByWithRelationInput[]
    cursor?: customerWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CustomerScalarFieldEnum | CustomerScalarFieldEnum[]
  }

  /**
   * employee.employee
   */
  export type employee$employeeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the employee
     */
    select?: employeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the employee
     */
    omit?: employeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: employeeInclude<ExtArgs> | null
    where?: employeeWhereInput
  }

  /**
   * employee.other_employee
   */
  export type employee$other_employeeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the employee
     */
    select?: employeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the employee
     */
    omit?: employeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: employeeInclude<ExtArgs> | null
    where?: employeeWhereInput
    orderBy?: employeeOrderByWithRelationInput | employeeOrderByWithRelationInput[]
    cursor?: employeeWhereUniqueInput
    take?: number
    skip?: number
    distinct?: EmployeeScalarFieldEnum | EmployeeScalarFieldEnum[]
  }

  /**
   * employee.track_discount
   */
  export type employee$track_discountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track_discount
     */
    select?: track_discountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track_discount
     */
    omit?: track_discountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: track_discountInclude<ExtArgs> | null
    where?: track_discountWhereInput
    orderBy?: track_discountOrderByWithRelationInput | track_discountOrderByWithRelationInput[]
    cursor?: track_discountWhereUniqueInput
    take?: number
    skip?: number
    distinct?: Track_discountScalarFieldEnum | Track_discountScalarFieldEnum[]
  }

  /**
   * employee without action
   */
  export type employeeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the employee
     */
    select?: employeeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the employee
     */
    omit?: employeeOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: employeeInclude<ExtArgs> | null
  }


  /**
   * Model genre
   */

  export type AggregateGenre = {
    _count: GenreCountAggregateOutputType | null
    _avg: GenreAvgAggregateOutputType | null
    _sum: GenreSumAggregateOutputType | null
    _min: GenreMinAggregateOutputType | null
    _max: GenreMaxAggregateOutputType | null
  }

  export type GenreAvgAggregateOutputType = {
    genre_id: number | null
  }

  export type GenreSumAggregateOutputType = {
    genre_id: number | null
  }

  export type GenreMinAggregateOutputType = {
    genre_id: number | null
    name: string | null
  }

  export type GenreMaxAggregateOutputType = {
    genre_id: number | null
    name: string | null
  }

  export type GenreCountAggregateOutputType = {
    genre_id: number
    name: number
    _all: number
  }


  export type GenreAvgAggregateInputType = {
    genre_id?: true
  }

  export type GenreSumAggregateInputType = {
    genre_id?: true
  }

  export type GenreMinAggregateInputType = {
    genre_id?: true
    name?: true
  }

  export type GenreMaxAggregateInputType = {
    genre_id?: true
    name?: true
  }

  export type GenreCountAggregateInputType = {
    genre_id?: true
    name?: true
    _all?: true
  }

  export type GenreAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which genre to aggregate.
     */
    where?: genreWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of genres to fetch.
     */
    orderBy?: genreOrderByWithRelationInput | genreOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: genreWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` genres from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` genres.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned genres
    **/
    _count?: true | GenreCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: GenreAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: GenreSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: GenreMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: GenreMaxAggregateInputType
  }

  export type GetGenreAggregateType<T extends GenreAggregateArgs> = {
        [P in keyof T & keyof AggregateGenre]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateGenre[P]>
      : GetScalarType<T[P], AggregateGenre[P]>
  }




  export type genreGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: genreWhereInput
    orderBy?: genreOrderByWithAggregationInput | genreOrderByWithAggregationInput[]
    by: GenreScalarFieldEnum[] | GenreScalarFieldEnum
    having?: genreScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: GenreCountAggregateInputType | true
    _avg?: GenreAvgAggregateInputType
    _sum?: GenreSumAggregateInputType
    _min?: GenreMinAggregateInputType
    _max?: GenreMaxAggregateInputType
  }

  export type GenreGroupByOutputType = {
    genre_id: number
    name: string | null
    _count: GenreCountAggregateOutputType | null
    _avg: GenreAvgAggregateOutputType | null
    _sum: GenreSumAggregateOutputType | null
    _min: GenreMinAggregateOutputType | null
    _max: GenreMaxAggregateOutputType | null
  }

  type GetGenreGroupByPayload<T extends genreGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<GenreGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof GenreGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], GenreGroupByOutputType[P]>
            : GetScalarType<T[P], GenreGroupByOutputType[P]>
        }
      >
    >


  export type genreSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    genre_id?: boolean
    name?: boolean
  }, ExtArgs["result"]["genre"]>

  export type genreSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    genre_id?: boolean
    name?: boolean
  }, ExtArgs["result"]["genre"]>

  export type genreSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    genre_id?: boolean
    name?: boolean
  }, ExtArgs["result"]["genre"]>

  export type genreSelectScalar = {
    genre_id?: boolean
    name?: boolean
  }

  export type genreOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"genre_id" | "name", ExtArgs["result"]["genre"]>

  export type $genrePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "genre"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      genre_id: number
      name: string | null
    }, ExtArgs["result"]["genre"]>
    composites: {}
  }

  type genreGetPayload<S extends boolean | null | undefined | genreDefaultArgs> = $Result.GetResult<Prisma.$genrePayload, S>

  type genreCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<genreFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: GenreCountAggregateInputType | true
    }

  export interface genreDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['genre'], meta: { name: 'genre' } }
    /**
     * Find zero or one Genre that matches the filter.
     * @param {genreFindUniqueArgs} args - Arguments to find a Genre
     * @example
     * // Get one Genre
     * const genre = await prisma.genre.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends genreFindUniqueArgs>(args: SelectSubset<T, genreFindUniqueArgs<ExtArgs>>): Prisma__genreClient<$Result.GetResult<Prisma.$genrePayload<ExtArgs>, T, "findUnique", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find one Genre that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {genreFindUniqueOrThrowArgs} args - Arguments to find a Genre
     * @example
     * // Get one Genre
     * const genre = await prisma.genre.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends genreFindUniqueOrThrowArgs>(args: SelectSubset<T, genreFindUniqueOrThrowArgs<ExtArgs>>): Prisma__genreClient<$Result.GetResult<Prisma.$genrePayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find the first Genre that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {genreFindFirstArgs} args - Arguments to find a Genre
     * @example
     * // Get one Genre
     * const genre = await prisma.genre.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends genreFindFirstArgs>(args?: SelectSubset<T, genreFindFirstArgs<ExtArgs>>): Prisma__genreClient<$Result.GetResult<Prisma.$genrePayload<ExtArgs>, T, "findFirst", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find the first Genre that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {genreFindFirstOrThrowArgs} args - Arguments to find a Genre
     * @example
     * // Get one Genre
     * const genre = await prisma.genre.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends genreFindFirstOrThrowArgs>(args?: SelectSubset<T, genreFindFirstOrThrowArgs<ExtArgs>>): Prisma__genreClient<$Result.GetResult<Prisma.$genrePayload<ExtArgs>, T, "findFirstOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find zero or more Genres that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {genreFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Genres
     * const genres = await prisma.genre.findMany()
     * 
     * // Get first 10 Genres
     * const genres = await prisma.genre.findMany({ take: 10 })
     * 
     * // Only select the `genre_id`
     * const genreWithGenre_idOnly = await prisma.genre.findMany({ select: { genre_id: true } })
     * 
     */
    findMany<T extends genreFindManyArgs>(args?: SelectSubset<T, genreFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$genrePayload<ExtArgs>, T, "findMany", ClientOptions>>

    /**
     * Create a Genre.
     * @param {genreCreateArgs} args - Arguments to create a Genre.
     * @example
     * // Create one Genre
     * const Genre = await prisma.genre.create({
     *   data: {
     *     // ... data to create a Genre
     *   }
     * })
     * 
     */
    create<T extends genreCreateArgs>(args: SelectSubset<T, genreCreateArgs<ExtArgs>>): Prisma__genreClient<$Result.GetResult<Prisma.$genrePayload<ExtArgs>, T, "create", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Create many Genres.
     * @param {genreCreateManyArgs} args - Arguments to create many Genres.
     * @example
     * // Create many Genres
     * const genre = await prisma.genre.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends genreCreateManyArgs>(args?: SelectSubset<T, genreCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Genres and returns the data saved in the database.
     * @param {genreCreateManyAndReturnArgs} args - Arguments to create many Genres.
     * @example
     * // Create many Genres
     * const genre = await prisma.genre.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Genres and only return the `genre_id`
     * const genreWithGenre_idOnly = await prisma.genre.createManyAndReturn({
     *   select: { genre_id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends genreCreateManyAndReturnArgs>(args?: SelectSubset<T, genreCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$genrePayload<ExtArgs>, T, "createManyAndReturn", ClientOptions>>

    /**
     * Delete a Genre.
     * @param {genreDeleteArgs} args - Arguments to delete one Genre.
     * @example
     * // Delete one Genre
     * const Genre = await prisma.genre.delete({
     *   where: {
     *     // ... filter to delete one Genre
     *   }
     * })
     * 
     */
    delete<T extends genreDeleteArgs>(args: SelectSubset<T, genreDeleteArgs<ExtArgs>>): Prisma__genreClient<$Result.GetResult<Prisma.$genrePayload<ExtArgs>, T, "delete", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Update one Genre.
     * @param {genreUpdateArgs} args - Arguments to update one Genre.
     * @example
     * // Update one Genre
     * const genre = await prisma.genre.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends genreUpdateArgs>(args: SelectSubset<T, genreUpdateArgs<ExtArgs>>): Prisma__genreClient<$Result.GetResult<Prisma.$genrePayload<ExtArgs>, T, "update", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Delete zero or more Genres.
     * @param {genreDeleteManyArgs} args - Arguments to filter Genres to delete.
     * @example
     * // Delete a few Genres
     * const { count } = await prisma.genre.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends genreDeleteManyArgs>(args?: SelectSubset<T, genreDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Genres.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {genreUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Genres
     * const genre = await prisma.genre.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends genreUpdateManyArgs>(args: SelectSubset<T, genreUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Genres and returns the data updated in the database.
     * @param {genreUpdateManyAndReturnArgs} args - Arguments to update many Genres.
     * @example
     * // Update many Genres
     * const genre = await prisma.genre.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Genres and only return the `genre_id`
     * const genreWithGenre_idOnly = await prisma.genre.updateManyAndReturn({
     *   select: { genre_id: true },
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
    updateManyAndReturn<T extends genreUpdateManyAndReturnArgs>(args: SelectSubset<T, genreUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$genrePayload<ExtArgs>, T, "updateManyAndReturn", ClientOptions>>

    /**
     * Create or update one Genre.
     * @param {genreUpsertArgs} args - Arguments to update or create a Genre.
     * @example
     * // Update or create a Genre
     * const genre = await prisma.genre.upsert({
     *   create: {
     *     // ... data to create a Genre
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Genre we want to update
     *   }
     * })
     */
    upsert<T extends genreUpsertArgs>(args: SelectSubset<T, genreUpsertArgs<ExtArgs>>): Prisma__genreClient<$Result.GetResult<Prisma.$genrePayload<ExtArgs>, T, "upsert", ClientOptions>, never, ExtArgs, ClientOptions>


    /**
     * Count the number of Genres.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {genreCountArgs} args - Arguments to filter Genres to count.
     * @example
     * // Count the number of Genres
     * const count = await prisma.genre.count({
     *   where: {
     *     // ... the filter for the Genres we want to count
     *   }
     * })
    **/
    count<T extends genreCountArgs>(
      args?: Subset<T, genreCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], GenreCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Genre.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {GenreAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends GenreAggregateArgs>(args: Subset<T, GenreAggregateArgs>): Prisma.PrismaPromise<GetGenreAggregateType<T>>

    /**
     * Group by Genre.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {genreGroupByArgs} args - Group by arguments.
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
      T extends genreGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: genreGroupByArgs['orderBy'] }
        : { orderBy?: genreGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, genreGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetGenreGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the genre model
   */
  readonly fields: genreFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for genre.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__genreClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> extends Prisma.PrismaPromise<T> {
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
   * Fields of the genre model
   */ 
  interface genreFieldRefs {
    readonly genre_id: FieldRef<"genre", 'Int'>
    readonly name: FieldRef<"genre", 'String'>
  }
    

  // Custom InputTypes
  /**
   * genre findUnique
   */
  export type genreFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the genre
     */
    select?: genreSelect<ExtArgs> | null
    /**
     * Omit specific fields from the genre
     */
    omit?: genreOmit<ExtArgs> | null
    /**
     * Filter, which genre to fetch.
     */
    where: genreWhereUniqueInput
  }

  /**
   * genre findUniqueOrThrow
   */
  export type genreFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the genre
     */
    select?: genreSelect<ExtArgs> | null
    /**
     * Omit specific fields from the genre
     */
    omit?: genreOmit<ExtArgs> | null
    /**
     * Filter, which genre to fetch.
     */
    where: genreWhereUniqueInput
  }

  /**
   * genre findFirst
   */
  export type genreFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the genre
     */
    select?: genreSelect<ExtArgs> | null
    /**
     * Omit specific fields from the genre
     */
    omit?: genreOmit<ExtArgs> | null
    /**
     * Filter, which genre to fetch.
     */
    where?: genreWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of genres to fetch.
     */
    orderBy?: genreOrderByWithRelationInput | genreOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for genres.
     */
    cursor?: genreWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` genres from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` genres.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of genres.
     */
    distinct?: GenreScalarFieldEnum | GenreScalarFieldEnum[]
  }

  /**
   * genre findFirstOrThrow
   */
  export type genreFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the genre
     */
    select?: genreSelect<ExtArgs> | null
    /**
     * Omit specific fields from the genre
     */
    omit?: genreOmit<ExtArgs> | null
    /**
     * Filter, which genre to fetch.
     */
    where?: genreWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of genres to fetch.
     */
    orderBy?: genreOrderByWithRelationInput | genreOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for genres.
     */
    cursor?: genreWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` genres from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` genres.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of genres.
     */
    distinct?: GenreScalarFieldEnum | GenreScalarFieldEnum[]
  }

  /**
   * genre findMany
   */
  export type genreFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the genre
     */
    select?: genreSelect<ExtArgs> | null
    /**
     * Omit specific fields from the genre
     */
    omit?: genreOmit<ExtArgs> | null
    /**
     * Filter, which genres to fetch.
     */
    where?: genreWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of genres to fetch.
     */
    orderBy?: genreOrderByWithRelationInput | genreOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing genres.
     */
    cursor?: genreWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` genres from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` genres.
     */
    skip?: number
    distinct?: GenreScalarFieldEnum | GenreScalarFieldEnum[]
  }

  /**
   * genre create
   */
  export type genreCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the genre
     */
    select?: genreSelect<ExtArgs> | null
    /**
     * Omit specific fields from the genre
     */
    omit?: genreOmit<ExtArgs> | null
    /**
     * The data needed to create a genre.
     */
    data: XOR<genreCreateInput, genreUncheckedCreateInput>
  }

  /**
   * genre createMany
   */
  export type genreCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many genres.
     */
    data: genreCreateManyInput | genreCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * genre createManyAndReturn
   */
  export type genreCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the genre
     */
    select?: genreSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the genre
     */
    omit?: genreOmit<ExtArgs> | null
    /**
     * The data used to create many genres.
     */
    data: genreCreateManyInput | genreCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * genre update
   */
  export type genreUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the genre
     */
    select?: genreSelect<ExtArgs> | null
    /**
     * Omit specific fields from the genre
     */
    omit?: genreOmit<ExtArgs> | null
    /**
     * The data needed to update a genre.
     */
    data: XOR<genreUpdateInput, genreUncheckedUpdateInput>
    /**
     * Choose, which genre to update.
     */
    where: genreWhereUniqueInput
  }

  /**
   * genre updateMany
   */
  export type genreUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update genres.
     */
    data: XOR<genreUpdateManyMutationInput, genreUncheckedUpdateManyInput>
    /**
     * Filter which genres to update
     */
    where?: genreWhereInput
  }

  /**
   * genre updateManyAndReturn
   */
  export type genreUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the genre
     */
    select?: genreSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the genre
     */
    omit?: genreOmit<ExtArgs> | null
    /**
     * The data used to update genres.
     */
    data: XOR<genreUpdateManyMutationInput, genreUncheckedUpdateManyInput>
    /**
     * Filter which genres to update
     */
    where?: genreWhereInput
  }

  /**
   * genre upsert
   */
  export type genreUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the genre
     */
    select?: genreSelect<ExtArgs> | null
    /**
     * Omit specific fields from the genre
     */
    omit?: genreOmit<ExtArgs> | null
    /**
     * The filter to search for the genre to update in case it exists.
     */
    where: genreWhereUniqueInput
    /**
     * In case the genre found by the `where` argument doesn't exist, create a new genre with this data.
     */
    create: XOR<genreCreateInput, genreUncheckedCreateInput>
    /**
     * In case the genre was found with the provided `where` argument, update it with this data.
     */
    update: XOR<genreUpdateInput, genreUncheckedUpdateInput>
  }

  /**
   * genre delete
   */
  export type genreDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the genre
     */
    select?: genreSelect<ExtArgs> | null
    /**
     * Omit specific fields from the genre
     */
    omit?: genreOmit<ExtArgs> | null
    /**
     * Filter which genre to delete.
     */
    where: genreWhereUniqueInput
  }

  /**
   * genre deleteMany
   */
  export type genreDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which genres to delete
     */
    where?: genreWhereInput
  }

  /**
   * genre without action
   */
  export type genreDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the genre
     */
    select?: genreSelect<ExtArgs> | null
    /**
     * Omit specific fields from the genre
     */
    omit?: genreOmit<ExtArgs> | null
  }


  /**
   * Model invoice
   */

  export type AggregateInvoice = {
    _count: InvoiceCountAggregateOutputType | null
    _avg: InvoiceAvgAggregateOutputType | null
    _sum: InvoiceSumAggregateOutputType | null
    _min: InvoiceMinAggregateOutputType | null
    _max: InvoiceMaxAggregateOutputType | null
  }

  export type InvoiceAvgAggregateOutputType = {
    invoice_id: number | null
    customer_id: number | null
    total: Decimal | null
  }

  export type InvoiceSumAggregateOutputType = {
    invoice_id: number | null
    customer_id: number | null
    total: Decimal | null
  }

  export type InvoiceMinAggregateOutputType = {
    invoice_id: number | null
    customer_id: number | null
    invoice_date: Date | null
    billing_address: string | null
    billing_city: string | null
    billing_state: string | null
    billing_country: string | null
    billing_postal_code: string | null
    total: Decimal | null
  }

  export type InvoiceMaxAggregateOutputType = {
    invoice_id: number | null
    customer_id: number | null
    invoice_date: Date | null
    billing_address: string | null
    billing_city: string | null
    billing_state: string | null
    billing_country: string | null
    billing_postal_code: string | null
    total: Decimal | null
  }

  export type InvoiceCountAggregateOutputType = {
    invoice_id: number
    customer_id: number
    invoice_date: number
    billing_address: number
    billing_city: number
    billing_state: number
    billing_country: number
    billing_postal_code: number
    total: number
    _all: number
  }


  export type InvoiceAvgAggregateInputType = {
    invoice_id?: true
    customer_id?: true
    total?: true
  }

  export type InvoiceSumAggregateInputType = {
    invoice_id?: true
    customer_id?: true
    total?: true
  }

  export type InvoiceMinAggregateInputType = {
    invoice_id?: true
    customer_id?: true
    invoice_date?: true
    billing_address?: true
    billing_city?: true
    billing_state?: true
    billing_country?: true
    billing_postal_code?: true
    total?: true
  }

  export type InvoiceMaxAggregateInputType = {
    invoice_id?: true
    customer_id?: true
    invoice_date?: true
    billing_address?: true
    billing_city?: true
    billing_state?: true
    billing_country?: true
    billing_postal_code?: true
    total?: true
  }

  export type InvoiceCountAggregateInputType = {
    invoice_id?: true
    customer_id?: true
    invoice_date?: true
    billing_address?: true
    billing_city?: true
    billing_state?: true
    billing_country?: true
    billing_postal_code?: true
    total?: true
    _all?: true
  }

  export type InvoiceAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which invoice to aggregate.
     */
    where?: invoiceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of invoices to fetch.
     */
    orderBy?: invoiceOrderByWithRelationInput | invoiceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: invoiceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` invoices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` invoices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned invoices
    **/
    _count?: true | InvoiceCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: InvoiceAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: InvoiceSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: InvoiceMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: InvoiceMaxAggregateInputType
  }

  export type GetInvoiceAggregateType<T extends InvoiceAggregateArgs> = {
        [P in keyof T & keyof AggregateInvoice]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateInvoice[P]>
      : GetScalarType<T[P], AggregateInvoice[P]>
  }




  export type invoiceGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: invoiceWhereInput
    orderBy?: invoiceOrderByWithAggregationInput | invoiceOrderByWithAggregationInput[]
    by: InvoiceScalarFieldEnum[] | InvoiceScalarFieldEnum
    having?: invoiceScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: InvoiceCountAggregateInputType | true
    _avg?: InvoiceAvgAggregateInputType
    _sum?: InvoiceSumAggregateInputType
    _min?: InvoiceMinAggregateInputType
    _max?: InvoiceMaxAggregateInputType
  }

  export type InvoiceGroupByOutputType = {
    invoice_id: number
    customer_id: number
    invoice_date: Date
    billing_address: string | null
    billing_city: string | null
    billing_state: string | null
    billing_country: string | null
    billing_postal_code: string | null
    total: Decimal
    _count: InvoiceCountAggregateOutputType | null
    _avg: InvoiceAvgAggregateOutputType | null
    _sum: InvoiceSumAggregateOutputType | null
    _min: InvoiceMinAggregateOutputType | null
    _max: InvoiceMaxAggregateOutputType | null
  }

  type GetInvoiceGroupByPayload<T extends invoiceGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<InvoiceGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof InvoiceGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], InvoiceGroupByOutputType[P]>
            : GetScalarType<T[P], InvoiceGroupByOutputType[P]>
        }
      >
    >


  export type invoiceSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    invoice_id?: boolean
    customer_id?: boolean
    invoice_date?: boolean
    billing_address?: boolean
    billing_city?: boolean
    billing_state?: boolean
    billing_country?: boolean
    billing_postal_code?: boolean
    total?: boolean
    customer_review?: boolean | invoice$customer_reviewArgs<ExtArgs>
    customer?: boolean | customerDefaultArgs<ExtArgs>
    invoice_line?: boolean | invoice$invoice_lineArgs<ExtArgs>
    _count?: boolean | InvoiceCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["invoice"]>

  export type invoiceSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    invoice_id?: boolean
    customer_id?: boolean
    invoice_date?: boolean
    billing_address?: boolean
    billing_city?: boolean
    billing_state?: boolean
    billing_country?: boolean
    billing_postal_code?: boolean
    total?: boolean
    customer?: boolean | customerDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["invoice"]>

  export type invoiceSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    invoice_id?: boolean
    customer_id?: boolean
    invoice_date?: boolean
    billing_address?: boolean
    billing_city?: boolean
    billing_state?: boolean
    billing_country?: boolean
    billing_postal_code?: boolean
    total?: boolean
    customer?: boolean | customerDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["invoice"]>

  export type invoiceSelectScalar = {
    invoice_id?: boolean
    customer_id?: boolean
    invoice_date?: boolean
    billing_address?: boolean
    billing_city?: boolean
    billing_state?: boolean
    billing_country?: boolean
    billing_postal_code?: boolean
    total?: boolean
  }

  export type invoiceOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"invoice_id" | "customer_id" | "invoice_date" | "billing_address" | "billing_city" | "billing_state" | "billing_country" | "billing_postal_code" | "total", ExtArgs["result"]["invoice"]>
  export type invoiceInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    customer_review?: boolean | invoice$customer_reviewArgs<ExtArgs>
    customer?: boolean | customerDefaultArgs<ExtArgs>
    invoice_line?: boolean | invoice$invoice_lineArgs<ExtArgs>
    _count?: boolean | InvoiceCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type invoiceIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    customer?: boolean | customerDefaultArgs<ExtArgs>
  }
  export type invoiceIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    customer?: boolean | customerDefaultArgs<ExtArgs>
  }

  export type $invoicePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "invoice"
    objects: {
      customer_review: Prisma.$customer_reviewPayload<ExtArgs>[]
      customer: Prisma.$customerPayload<ExtArgs>
      invoice_line: Prisma.$invoice_linePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      invoice_id: number
      customer_id: number
      invoice_date: Date
      billing_address: string | null
      billing_city: string | null
      billing_state: string | null
      billing_country: string | null
      billing_postal_code: string | null
      total: Prisma.Decimal
    }, ExtArgs["result"]["invoice"]>
    composites: {}
  }

  type invoiceGetPayload<S extends boolean | null | undefined | invoiceDefaultArgs> = $Result.GetResult<Prisma.$invoicePayload, S>

  type invoiceCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<invoiceFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: InvoiceCountAggregateInputType | true
    }

  export interface invoiceDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['invoice'], meta: { name: 'invoice' } }
    /**
     * Find zero or one Invoice that matches the filter.
     * @param {invoiceFindUniqueArgs} args - Arguments to find a Invoice
     * @example
     * // Get one Invoice
     * const invoice = await prisma.invoice.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends invoiceFindUniqueArgs>(args: SelectSubset<T, invoiceFindUniqueArgs<ExtArgs>>): Prisma__invoiceClient<$Result.GetResult<Prisma.$invoicePayload<ExtArgs>, T, "findUnique", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find one Invoice that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {invoiceFindUniqueOrThrowArgs} args - Arguments to find a Invoice
     * @example
     * // Get one Invoice
     * const invoice = await prisma.invoice.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends invoiceFindUniqueOrThrowArgs>(args: SelectSubset<T, invoiceFindUniqueOrThrowArgs<ExtArgs>>): Prisma__invoiceClient<$Result.GetResult<Prisma.$invoicePayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find the first Invoice that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {invoiceFindFirstArgs} args - Arguments to find a Invoice
     * @example
     * // Get one Invoice
     * const invoice = await prisma.invoice.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends invoiceFindFirstArgs>(args?: SelectSubset<T, invoiceFindFirstArgs<ExtArgs>>): Prisma__invoiceClient<$Result.GetResult<Prisma.$invoicePayload<ExtArgs>, T, "findFirst", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find the first Invoice that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {invoiceFindFirstOrThrowArgs} args - Arguments to find a Invoice
     * @example
     * // Get one Invoice
     * const invoice = await prisma.invoice.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends invoiceFindFirstOrThrowArgs>(args?: SelectSubset<T, invoiceFindFirstOrThrowArgs<ExtArgs>>): Prisma__invoiceClient<$Result.GetResult<Prisma.$invoicePayload<ExtArgs>, T, "findFirstOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find zero or more Invoices that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {invoiceFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Invoices
     * const invoices = await prisma.invoice.findMany()
     * 
     * // Get first 10 Invoices
     * const invoices = await prisma.invoice.findMany({ take: 10 })
     * 
     * // Only select the `invoice_id`
     * const invoiceWithInvoice_idOnly = await prisma.invoice.findMany({ select: { invoice_id: true } })
     * 
     */
    findMany<T extends invoiceFindManyArgs>(args?: SelectSubset<T, invoiceFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$invoicePayload<ExtArgs>, T, "findMany", ClientOptions>>

    /**
     * Create a Invoice.
     * @param {invoiceCreateArgs} args - Arguments to create a Invoice.
     * @example
     * // Create one Invoice
     * const Invoice = await prisma.invoice.create({
     *   data: {
     *     // ... data to create a Invoice
     *   }
     * })
     * 
     */
    create<T extends invoiceCreateArgs>(args: SelectSubset<T, invoiceCreateArgs<ExtArgs>>): Prisma__invoiceClient<$Result.GetResult<Prisma.$invoicePayload<ExtArgs>, T, "create", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Create many Invoices.
     * @param {invoiceCreateManyArgs} args - Arguments to create many Invoices.
     * @example
     * // Create many Invoices
     * const invoice = await prisma.invoice.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends invoiceCreateManyArgs>(args?: SelectSubset<T, invoiceCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Invoices and returns the data saved in the database.
     * @param {invoiceCreateManyAndReturnArgs} args - Arguments to create many Invoices.
     * @example
     * // Create many Invoices
     * const invoice = await prisma.invoice.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Invoices and only return the `invoice_id`
     * const invoiceWithInvoice_idOnly = await prisma.invoice.createManyAndReturn({
     *   select: { invoice_id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends invoiceCreateManyAndReturnArgs>(args?: SelectSubset<T, invoiceCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$invoicePayload<ExtArgs>, T, "createManyAndReturn", ClientOptions>>

    /**
     * Delete a Invoice.
     * @param {invoiceDeleteArgs} args - Arguments to delete one Invoice.
     * @example
     * // Delete one Invoice
     * const Invoice = await prisma.invoice.delete({
     *   where: {
     *     // ... filter to delete one Invoice
     *   }
     * })
     * 
     */
    delete<T extends invoiceDeleteArgs>(args: SelectSubset<T, invoiceDeleteArgs<ExtArgs>>): Prisma__invoiceClient<$Result.GetResult<Prisma.$invoicePayload<ExtArgs>, T, "delete", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Update one Invoice.
     * @param {invoiceUpdateArgs} args - Arguments to update one Invoice.
     * @example
     * // Update one Invoice
     * const invoice = await prisma.invoice.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends invoiceUpdateArgs>(args: SelectSubset<T, invoiceUpdateArgs<ExtArgs>>): Prisma__invoiceClient<$Result.GetResult<Prisma.$invoicePayload<ExtArgs>, T, "update", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Delete zero or more Invoices.
     * @param {invoiceDeleteManyArgs} args - Arguments to filter Invoices to delete.
     * @example
     * // Delete a few Invoices
     * const { count } = await prisma.invoice.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends invoiceDeleteManyArgs>(args?: SelectSubset<T, invoiceDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Invoices.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {invoiceUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Invoices
     * const invoice = await prisma.invoice.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends invoiceUpdateManyArgs>(args: SelectSubset<T, invoiceUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Invoices and returns the data updated in the database.
     * @param {invoiceUpdateManyAndReturnArgs} args - Arguments to update many Invoices.
     * @example
     * // Update many Invoices
     * const invoice = await prisma.invoice.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Invoices and only return the `invoice_id`
     * const invoiceWithInvoice_idOnly = await prisma.invoice.updateManyAndReturn({
     *   select: { invoice_id: true },
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
    updateManyAndReturn<T extends invoiceUpdateManyAndReturnArgs>(args: SelectSubset<T, invoiceUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$invoicePayload<ExtArgs>, T, "updateManyAndReturn", ClientOptions>>

    /**
     * Create or update one Invoice.
     * @param {invoiceUpsertArgs} args - Arguments to update or create a Invoice.
     * @example
     * // Update or create a Invoice
     * const invoice = await prisma.invoice.upsert({
     *   create: {
     *     // ... data to create a Invoice
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Invoice we want to update
     *   }
     * })
     */
    upsert<T extends invoiceUpsertArgs>(args: SelectSubset<T, invoiceUpsertArgs<ExtArgs>>): Prisma__invoiceClient<$Result.GetResult<Prisma.$invoicePayload<ExtArgs>, T, "upsert", ClientOptions>, never, ExtArgs, ClientOptions>


    /**
     * Count the number of Invoices.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {invoiceCountArgs} args - Arguments to filter Invoices to count.
     * @example
     * // Count the number of Invoices
     * const count = await prisma.invoice.count({
     *   where: {
     *     // ... the filter for the Invoices we want to count
     *   }
     * })
    **/
    count<T extends invoiceCountArgs>(
      args?: Subset<T, invoiceCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], InvoiceCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Invoice.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {InvoiceAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends InvoiceAggregateArgs>(args: Subset<T, InvoiceAggregateArgs>): Prisma.PrismaPromise<GetInvoiceAggregateType<T>>

    /**
     * Group by Invoice.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {invoiceGroupByArgs} args - Group by arguments.
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
      T extends invoiceGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: invoiceGroupByArgs['orderBy'] }
        : { orderBy?: invoiceGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, invoiceGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetInvoiceGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the invoice model
   */
  readonly fields: invoiceFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for invoice.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__invoiceClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    customer_review<T extends invoice$customer_reviewArgs<ExtArgs> = {}>(args?: Subset<T, invoice$customer_reviewArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$customer_reviewPayload<ExtArgs>, T, "findMany", ClientOptions> | Null>
    customer<T extends customerDefaultArgs<ExtArgs> = {}>(args?: Subset<T, customerDefaultArgs<ExtArgs>>): Prisma__customerClient<$Result.GetResult<Prisma.$customerPayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions> | Null, Null, ExtArgs, ClientOptions>
    invoice_line<T extends invoice$invoice_lineArgs<ExtArgs> = {}>(args?: Subset<T, invoice$invoice_lineArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$invoice_linePayload<ExtArgs>, T, "findMany", ClientOptions> | Null>
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
   * Fields of the invoice model
   */ 
  interface invoiceFieldRefs {
    readonly invoice_id: FieldRef<"invoice", 'Int'>
    readonly customer_id: FieldRef<"invoice", 'Int'>
    readonly invoice_date: FieldRef<"invoice", 'DateTime'>
    readonly billing_address: FieldRef<"invoice", 'String'>
    readonly billing_city: FieldRef<"invoice", 'String'>
    readonly billing_state: FieldRef<"invoice", 'String'>
    readonly billing_country: FieldRef<"invoice", 'String'>
    readonly billing_postal_code: FieldRef<"invoice", 'String'>
    readonly total: FieldRef<"invoice", 'Decimal'>
  }
    

  // Custom InputTypes
  /**
   * invoice findUnique
   */
  export type invoiceFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice
     */
    select?: invoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice
     */
    omit?: invoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoiceInclude<ExtArgs> | null
    /**
     * Filter, which invoice to fetch.
     */
    where: invoiceWhereUniqueInput
  }

  /**
   * invoice findUniqueOrThrow
   */
  export type invoiceFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice
     */
    select?: invoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice
     */
    omit?: invoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoiceInclude<ExtArgs> | null
    /**
     * Filter, which invoice to fetch.
     */
    where: invoiceWhereUniqueInput
  }

  /**
   * invoice findFirst
   */
  export type invoiceFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice
     */
    select?: invoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice
     */
    omit?: invoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoiceInclude<ExtArgs> | null
    /**
     * Filter, which invoice to fetch.
     */
    where?: invoiceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of invoices to fetch.
     */
    orderBy?: invoiceOrderByWithRelationInput | invoiceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for invoices.
     */
    cursor?: invoiceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` invoices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` invoices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of invoices.
     */
    distinct?: InvoiceScalarFieldEnum | InvoiceScalarFieldEnum[]
  }

  /**
   * invoice findFirstOrThrow
   */
  export type invoiceFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice
     */
    select?: invoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice
     */
    omit?: invoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoiceInclude<ExtArgs> | null
    /**
     * Filter, which invoice to fetch.
     */
    where?: invoiceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of invoices to fetch.
     */
    orderBy?: invoiceOrderByWithRelationInput | invoiceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for invoices.
     */
    cursor?: invoiceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` invoices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` invoices.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of invoices.
     */
    distinct?: InvoiceScalarFieldEnum | InvoiceScalarFieldEnum[]
  }

  /**
   * invoice findMany
   */
  export type invoiceFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice
     */
    select?: invoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice
     */
    omit?: invoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoiceInclude<ExtArgs> | null
    /**
     * Filter, which invoices to fetch.
     */
    where?: invoiceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of invoices to fetch.
     */
    orderBy?: invoiceOrderByWithRelationInput | invoiceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing invoices.
     */
    cursor?: invoiceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` invoices from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` invoices.
     */
    skip?: number
    distinct?: InvoiceScalarFieldEnum | InvoiceScalarFieldEnum[]
  }

  /**
   * invoice create
   */
  export type invoiceCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice
     */
    select?: invoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice
     */
    omit?: invoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoiceInclude<ExtArgs> | null
    /**
     * The data needed to create a invoice.
     */
    data: XOR<invoiceCreateInput, invoiceUncheckedCreateInput>
  }

  /**
   * invoice createMany
   */
  export type invoiceCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many invoices.
     */
    data: invoiceCreateManyInput | invoiceCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * invoice createManyAndReturn
   */
  export type invoiceCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice
     */
    select?: invoiceSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the invoice
     */
    omit?: invoiceOmit<ExtArgs> | null
    /**
     * The data used to create many invoices.
     */
    data: invoiceCreateManyInput | invoiceCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoiceIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * invoice update
   */
  export type invoiceUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice
     */
    select?: invoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice
     */
    omit?: invoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoiceInclude<ExtArgs> | null
    /**
     * The data needed to update a invoice.
     */
    data: XOR<invoiceUpdateInput, invoiceUncheckedUpdateInput>
    /**
     * Choose, which invoice to update.
     */
    where: invoiceWhereUniqueInput
  }

  /**
   * invoice updateMany
   */
  export type invoiceUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update invoices.
     */
    data: XOR<invoiceUpdateManyMutationInput, invoiceUncheckedUpdateManyInput>
    /**
     * Filter which invoices to update
     */
    where?: invoiceWhereInput
  }

  /**
   * invoice updateManyAndReturn
   */
  export type invoiceUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice
     */
    select?: invoiceSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the invoice
     */
    omit?: invoiceOmit<ExtArgs> | null
    /**
     * The data used to update invoices.
     */
    data: XOR<invoiceUpdateManyMutationInput, invoiceUncheckedUpdateManyInput>
    /**
     * Filter which invoices to update
     */
    where?: invoiceWhereInput
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoiceIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * invoice upsert
   */
  export type invoiceUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice
     */
    select?: invoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice
     */
    omit?: invoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoiceInclude<ExtArgs> | null
    /**
     * The filter to search for the invoice to update in case it exists.
     */
    where: invoiceWhereUniqueInput
    /**
     * In case the invoice found by the `where` argument doesn't exist, create a new invoice with this data.
     */
    create: XOR<invoiceCreateInput, invoiceUncheckedCreateInput>
    /**
     * In case the invoice was found with the provided `where` argument, update it with this data.
     */
    update: XOR<invoiceUpdateInput, invoiceUncheckedUpdateInput>
  }

  /**
   * invoice delete
   */
  export type invoiceDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice
     */
    select?: invoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice
     */
    omit?: invoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoiceInclude<ExtArgs> | null
    /**
     * Filter which invoice to delete.
     */
    where: invoiceWhereUniqueInput
  }

  /**
   * invoice deleteMany
   */
  export type invoiceDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which invoices to delete
     */
    where?: invoiceWhereInput
  }

  /**
   * invoice.customer_review
   */
  export type invoice$customer_reviewArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the customer_review
     */
    select?: customer_reviewSelect<ExtArgs> | null
    /**
     * Omit specific fields from the customer_review
     */
    omit?: customer_reviewOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: customer_reviewInclude<ExtArgs> | null
    where?: customer_reviewWhereInput
    orderBy?: customer_reviewOrderByWithRelationInput | customer_reviewOrderByWithRelationInput[]
    cursor?: customer_reviewWhereUniqueInput
    take?: number
    skip?: number
    distinct?: Customer_reviewScalarFieldEnum | Customer_reviewScalarFieldEnum[]
  }

  /**
   * invoice.invoice_line
   */
  export type invoice$invoice_lineArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice_line
     */
    select?: invoice_lineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice_line
     */
    omit?: invoice_lineOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoice_lineInclude<ExtArgs> | null
    where?: invoice_lineWhereInput
    orderBy?: invoice_lineOrderByWithRelationInput | invoice_lineOrderByWithRelationInput[]
    cursor?: invoice_lineWhereUniqueInput
    take?: number
    skip?: number
    distinct?: Invoice_lineScalarFieldEnum | Invoice_lineScalarFieldEnum[]
  }

  /**
   * invoice without action
   */
  export type invoiceDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice
     */
    select?: invoiceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice
     */
    omit?: invoiceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoiceInclude<ExtArgs> | null
  }


  /**
   * Model invoice_line
   */

  export type AggregateInvoice_line = {
    _count: Invoice_lineCountAggregateOutputType | null
    _avg: Invoice_lineAvgAggregateOutputType | null
    _sum: Invoice_lineSumAggregateOutputType | null
    _min: Invoice_lineMinAggregateOutputType | null
    _max: Invoice_lineMaxAggregateOutputType | null
  }

  export type Invoice_lineAvgAggregateOutputType = {
    invoice_line_id: number | null
    invoice_id: number | null
    track_id: number | null
    unit_price: Decimal | null
    quantity: number | null
  }

  export type Invoice_lineSumAggregateOutputType = {
    invoice_line_id: number | null
    invoice_id: number | null
    track_id: number | null
    unit_price: Decimal | null
    quantity: number | null
  }

  export type Invoice_lineMinAggregateOutputType = {
    invoice_line_id: number | null
    invoice_id: number | null
    track_id: number | null
    unit_price: Decimal | null
    quantity: number | null
  }

  export type Invoice_lineMaxAggregateOutputType = {
    invoice_line_id: number | null
    invoice_id: number | null
    track_id: number | null
    unit_price: Decimal | null
    quantity: number | null
  }

  export type Invoice_lineCountAggregateOutputType = {
    invoice_line_id: number
    invoice_id: number
    track_id: number
    unit_price: number
    quantity: number
    _all: number
  }


  export type Invoice_lineAvgAggregateInputType = {
    invoice_line_id?: true
    invoice_id?: true
    track_id?: true
    unit_price?: true
    quantity?: true
  }

  export type Invoice_lineSumAggregateInputType = {
    invoice_line_id?: true
    invoice_id?: true
    track_id?: true
    unit_price?: true
    quantity?: true
  }

  export type Invoice_lineMinAggregateInputType = {
    invoice_line_id?: true
    invoice_id?: true
    track_id?: true
    unit_price?: true
    quantity?: true
  }

  export type Invoice_lineMaxAggregateInputType = {
    invoice_line_id?: true
    invoice_id?: true
    track_id?: true
    unit_price?: true
    quantity?: true
  }

  export type Invoice_lineCountAggregateInputType = {
    invoice_line_id?: true
    invoice_id?: true
    track_id?: true
    unit_price?: true
    quantity?: true
    _all?: true
  }

  export type Invoice_lineAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which invoice_line to aggregate.
     */
    where?: invoice_lineWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of invoice_lines to fetch.
     */
    orderBy?: invoice_lineOrderByWithRelationInput | invoice_lineOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: invoice_lineWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` invoice_lines from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` invoice_lines.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned invoice_lines
    **/
    _count?: true | Invoice_lineCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: Invoice_lineAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: Invoice_lineSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: Invoice_lineMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: Invoice_lineMaxAggregateInputType
  }

  export type GetInvoice_lineAggregateType<T extends Invoice_lineAggregateArgs> = {
        [P in keyof T & keyof AggregateInvoice_line]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateInvoice_line[P]>
      : GetScalarType<T[P], AggregateInvoice_line[P]>
  }




  export type invoice_lineGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: invoice_lineWhereInput
    orderBy?: invoice_lineOrderByWithAggregationInput | invoice_lineOrderByWithAggregationInput[]
    by: Invoice_lineScalarFieldEnum[] | Invoice_lineScalarFieldEnum
    having?: invoice_lineScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: Invoice_lineCountAggregateInputType | true
    _avg?: Invoice_lineAvgAggregateInputType
    _sum?: Invoice_lineSumAggregateInputType
    _min?: Invoice_lineMinAggregateInputType
    _max?: Invoice_lineMaxAggregateInputType
  }

  export type Invoice_lineGroupByOutputType = {
    invoice_line_id: number
    invoice_id: number
    track_id: number
    unit_price: Decimal
    quantity: number
    _count: Invoice_lineCountAggregateOutputType | null
    _avg: Invoice_lineAvgAggregateOutputType | null
    _sum: Invoice_lineSumAggregateOutputType | null
    _min: Invoice_lineMinAggregateOutputType | null
    _max: Invoice_lineMaxAggregateOutputType | null
  }

  type GetInvoice_lineGroupByPayload<T extends invoice_lineGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<Invoice_lineGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof Invoice_lineGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], Invoice_lineGroupByOutputType[P]>
            : GetScalarType<T[P], Invoice_lineGroupByOutputType[P]>
        }
      >
    >


  export type invoice_lineSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    invoice_line_id?: boolean
    invoice_id?: boolean
    track_id?: boolean
    unit_price?: boolean
    quantity?: boolean
    invoice?: boolean | invoiceDefaultArgs<ExtArgs>
    track?: boolean | trackDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["invoice_line"]>

  export type invoice_lineSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    invoice_line_id?: boolean
    invoice_id?: boolean
    track_id?: boolean
    unit_price?: boolean
    quantity?: boolean
    invoice?: boolean | invoiceDefaultArgs<ExtArgs>
    track?: boolean | trackDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["invoice_line"]>

  export type invoice_lineSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    invoice_line_id?: boolean
    invoice_id?: boolean
    track_id?: boolean
    unit_price?: boolean
    quantity?: boolean
    invoice?: boolean | invoiceDefaultArgs<ExtArgs>
    track?: boolean | trackDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["invoice_line"]>

  export type invoice_lineSelectScalar = {
    invoice_line_id?: boolean
    invoice_id?: boolean
    track_id?: boolean
    unit_price?: boolean
    quantity?: boolean
  }

  export type invoice_lineOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"invoice_line_id" | "invoice_id" | "track_id" | "unit_price" | "quantity", ExtArgs["result"]["invoice_line"]>
  export type invoice_lineInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    invoice?: boolean | invoiceDefaultArgs<ExtArgs>
    track?: boolean | trackDefaultArgs<ExtArgs>
  }
  export type invoice_lineIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    invoice?: boolean | invoiceDefaultArgs<ExtArgs>
    track?: boolean | trackDefaultArgs<ExtArgs>
  }
  export type invoice_lineIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    invoice?: boolean | invoiceDefaultArgs<ExtArgs>
    track?: boolean | trackDefaultArgs<ExtArgs>
  }

  export type $invoice_linePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "invoice_line"
    objects: {
      invoice: Prisma.$invoicePayload<ExtArgs>
      track: Prisma.$trackPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      invoice_line_id: number
      invoice_id: number
      track_id: number
      unit_price: Prisma.Decimal
      quantity: number
    }, ExtArgs["result"]["invoice_line"]>
    composites: {}
  }

  type invoice_lineGetPayload<S extends boolean | null | undefined | invoice_lineDefaultArgs> = $Result.GetResult<Prisma.$invoice_linePayload, S>

  type invoice_lineCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<invoice_lineFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: Invoice_lineCountAggregateInputType | true
    }

  export interface invoice_lineDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['invoice_line'], meta: { name: 'invoice_line' } }
    /**
     * Find zero or one Invoice_line that matches the filter.
     * @param {invoice_lineFindUniqueArgs} args - Arguments to find a Invoice_line
     * @example
     * // Get one Invoice_line
     * const invoice_line = await prisma.invoice_line.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends invoice_lineFindUniqueArgs>(args: SelectSubset<T, invoice_lineFindUniqueArgs<ExtArgs>>): Prisma__invoice_lineClient<$Result.GetResult<Prisma.$invoice_linePayload<ExtArgs>, T, "findUnique", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find one Invoice_line that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {invoice_lineFindUniqueOrThrowArgs} args - Arguments to find a Invoice_line
     * @example
     * // Get one Invoice_line
     * const invoice_line = await prisma.invoice_line.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends invoice_lineFindUniqueOrThrowArgs>(args: SelectSubset<T, invoice_lineFindUniqueOrThrowArgs<ExtArgs>>): Prisma__invoice_lineClient<$Result.GetResult<Prisma.$invoice_linePayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find the first Invoice_line that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {invoice_lineFindFirstArgs} args - Arguments to find a Invoice_line
     * @example
     * // Get one Invoice_line
     * const invoice_line = await prisma.invoice_line.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends invoice_lineFindFirstArgs>(args?: SelectSubset<T, invoice_lineFindFirstArgs<ExtArgs>>): Prisma__invoice_lineClient<$Result.GetResult<Prisma.$invoice_linePayload<ExtArgs>, T, "findFirst", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find the first Invoice_line that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {invoice_lineFindFirstOrThrowArgs} args - Arguments to find a Invoice_line
     * @example
     * // Get one Invoice_line
     * const invoice_line = await prisma.invoice_line.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends invoice_lineFindFirstOrThrowArgs>(args?: SelectSubset<T, invoice_lineFindFirstOrThrowArgs<ExtArgs>>): Prisma__invoice_lineClient<$Result.GetResult<Prisma.$invoice_linePayload<ExtArgs>, T, "findFirstOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find zero or more Invoice_lines that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {invoice_lineFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Invoice_lines
     * const invoice_lines = await prisma.invoice_line.findMany()
     * 
     * // Get first 10 Invoice_lines
     * const invoice_lines = await prisma.invoice_line.findMany({ take: 10 })
     * 
     * // Only select the `invoice_line_id`
     * const invoice_lineWithInvoice_line_idOnly = await prisma.invoice_line.findMany({ select: { invoice_line_id: true } })
     * 
     */
    findMany<T extends invoice_lineFindManyArgs>(args?: SelectSubset<T, invoice_lineFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$invoice_linePayload<ExtArgs>, T, "findMany", ClientOptions>>

    /**
     * Create a Invoice_line.
     * @param {invoice_lineCreateArgs} args - Arguments to create a Invoice_line.
     * @example
     * // Create one Invoice_line
     * const Invoice_line = await prisma.invoice_line.create({
     *   data: {
     *     // ... data to create a Invoice_line
     *   }
     * })
     * 
     */
    create<T extends invoice_lineCreateArgs>(args: SelectSubset<T, invoice_lineCreateArgs<ExtArgs>>): Prisma__invoice_lineClient<$Result.GetResult<Prisma.$invoice_linePayload<ExtArgs>, T, "create", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Create many Invoice_lines.
     * @param {invoice_lineCreateManyArgs} args - Arguments to create many Invoice_lines.
     * @example
     * // Create many Invoice_lines
     * const invoice_line = await prisma.invoice_line.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends invoice_lineCreateManyArgs>(args?: SelectSubset<T, invoice_lineCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Invoice_lines and returns the data saved in the database.
     * @param {invoice_lineCreateManyAndReturnArgs} args - Arguments to create many Invoice_lines.
     * @example
     * // Create many Invoice_lines
     * const invoice_line = await prisma.invoice_line.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Invoice_lines and only return the `invoice_line_id`
     * const invoice_lineWithInvoice_line_idOnly = await prisma.invoice_line.createManyAndReturn({
     *   select: { invoice_line_id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends invoice_lineCreateManyAndReturnArgs>(args?: SelectSubset<T, invoice_lineCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$invoice_linePayload<ExtArgs>, T, "createManyAndReturn", ClientOptions>>

    /**
     * Delete a Invoice_line.
     * @param {invoice_lineDeleteArgs} args - Arguments to delete one Invoice_line.
     * @example
     * // Delete one Invoice_line
     * const Invoice_line = await prisma.invoice_line.delete({
     *   where: {
     *     // ... filter to delete one Invoice_line
     *   }
     * })
     * 
     */
    delete<T extends invoice_lineDeleteArgs>(args: SelectSubset<T, invoice_lineDeleteArgs<ExtArgs>>): Prisma__invoice_lineClient<$Result.GetResult<Prisma.$invoice_linePayload<ExtArgs>, T, "delete", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Update one Invoice_line.
     * @param {invoice_lineUpdateArgs} args - Arguments to update one Invoice_line.
     * @example
     * // Update one Invoice_line
     * const invoice_line = await prisma.invoice_line.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends invoice_lineUpdateArgs>(args: SelectSubset<T, invoice_lineUpdateArgs<ExtArgs>>): Prisma__invoice_lineClient<$Result.GetResult<Prisma.$invoice_linePayload<ExtArgs>, T, "update", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Delete zero or more Invoice_lines.
     * @param {invoice_lineDeleteManyArgs} args - Arguments to filter Invoice_lines to delete.
     * @example
     * // Delete a few Invoice_lines
     * const { count } = await prisma.invoice_line.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends invoice_lineDeleteManyArgs>(args?: SelectSubset<T, invoice_lineDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Invoice_lines.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {invoice_lineUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Invoice_lines
     * const invoice_line = await prisma.invoice_line.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends invoice_lineUpdateManyArgs>(args: SelectSubset<T, invoice_lineUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Invoice_lines and returns the data updated in the database.
     * @param {invoice_lineUpdateManyAndReturnArgs} args - Arguments to update many Invoice_lines.
     * @example
     * // Update many Invoice_lines
     * const invoice_line = await prisma.invoice_line.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Invoice_lines and only return the `invoice_line_id`
     * const invoice_lineWithInvoice_line_idOnly = await prisma.invoice_line.updateManyAndReturn({
     *   select: { invoice_line_id: true },
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
    updateManyAndReturn<T extends invoice_lineUpdateManyAndReturnArgs>(args: SelectSubset<T, invoice_lineUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$invoice_linePayload<ExtArgs>, T, "updateManyAndReturn", ClientOptions>>

    /**
     * Create or update one Invoice_line.
     * @param {invoice_lineUpsertArgs} args - Arguments to update or create a Invoice_line.
     * @example
     * // Update or create a Invoice_line
     * const invoice_line = await prisma.invoice_line.upsert({
     *   create: {
     *     // ... data to create a Invoice_line
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Invoice_line we want to update
     *   }
     * })
     */
    upsert<T extends invoice_lineUpsertArgs>(args: SelectSubset<T, invoice_lineUpsertArgs<ExtArgs>>): Prisma__invoice_lineClient<$Result.GetResult<Prisma.$invoice_linePayload<ExtArgs>, T, "upsert", ClientOptions>, never, ExtArgs, ClientOptions>


    /**
     * Count the number of Invoice_lines.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {invoice_lineCountArgs} args - Arguments to filter Invoice_lines to count.
     * @example
     * // Count the number of Invoice_lines
     * const count = await prisma.invoice_line.count({
     *   where: {
     *     // ... the filter for the Invoice_lines we want to count
     *   }
     * })
    **/
    count<T extends invoice_lineCountArgs>(
      args?: Subset<T, invoice_lineCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], Invoice_lineCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Invoice_line.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {Invoice_lineAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends Invoice_lineAggregateArgs>(args: Subset<T, Invoice_lineAggregateArgs>): Prisma.PrismaPromise<GetInvoice_lineAggregateType<T>>

    /**
     * Group by Invoice_line.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {invoice_lineGroupByArgs} args - Group by arguments.
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
      T extends invoice_lineGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: invoice_lineGroupByArgs['orderBy'] }
        : { orderBy?: invoice_lineGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, invoice_lineGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetInvoice_lineGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the invoice_line model
   */
  readonly fields: invoice_lineFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for invoice_line.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__invoice_lineClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    invoice<T extends invoiceDefaultArgs<ExtArgs> = {}>(args?: Subset<T, invoiceDefaultArgs<ExtArgs>>): Prisma__invoiceClient<$Result.GetResult<Prisma.$invoicePayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions> | Null, Null, ExtArgs, ClientOptions>
    track<T extends trackDefaultArgs<ExtArgs> = {}>(args?: Subset<T, trackDefaultArgs<ExtArgs>>): Prisma__trackClient<$Result.GetResult<Prisma.$trackPayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions> | Null, Null, ExtArgs, ClientOptions>
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
   * Fields of the invoice_line model
   */ 
  interface invoice_lineFieldRefs {
    readonly invoice_line_id: FieldRef<"invoice_line", 'Int'>
    readonly invoice_id: FieldRef<"invoice_line", 'Int'>
    readonly track_id: FieldRef<"invoice_line", 'Int'>
    readonly unit_price: FieldRef<"invoice_line", 'Decimal'>
    readonly quantity: FieldRef<"invoice_line", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * invoice_line findUnique
   */
  export type invoice_lineFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice_line
     */
    select?: invoice_lineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice_line
     */
    omit?: invoice_lineOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoice_lineInclude<ExtArgs> | null
    /**
     * Filter, which invoice_line to fetch.
     */
    where: invoice_lineWhereUniqueInput
  }

  /**
   * invoice_line findUniqueOrThrow
   */
  export type invoice_lineFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice_line
     */
    select?: invoice_lineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice_line
     */
    omit?: invoice_lineOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoice_lineInclude<ExtArgs> | null
    /**
     * Filter, which invoice_line to fetch.
     */
    where: invoice_lineWhereUniqueInput
  }

  /**
   * invoice_line findFirst
   */
  export type invoice_lineFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice_line
     */
    select?: invoice_lineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice_line
     */
    omit?: invoice_lineOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoice_lineInclude<ExtArgs> | null
    /**
     * Filter, which invoice_line to fetch.
     */
    where?: invoice_lineWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of invoice_lines to fetch.
     */
    orderBy?: invoice_lineOrderByWithRelationInput | invoice_lineOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for invoice_lines.
     */
    cursor?: invoice_lineWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` invoice_lines from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` invoice_lines.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of invoice_lines.
     */
    distinct?: Invoice_lineScalarFieldEnum | Invoice_lineScalarFieldEnum[]
  }

  /**
   * invoice_line findFirstOrThrow
   */
  export type invoice_lineFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice_line
     */
    select?: invoice_lineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice_line
     */
    omit?: invoice_lineOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoice_lineInclude<ExtArgs> | null
    /**
     * Filter, which invoice_line to fetch.
     */
    where?: invoice_lineWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of invoice_lines to fetch.
     */
    orderBy?: invoice_lineOrderByWithRelationInput | invoice_lineOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for invoice_lines.
     */
    cursor?: invoice_lineWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` invoice_lines from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` invoice_lines.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of invoice_lines.
     */
    distinct?: Invoice_lineScalarFieldEnum | Invoice_lineScalarFieldEnum[]
  }

  /**
   * invoice_line findMany
   */
  export type invoice_lineFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice_line
     */
    select?: invoice_lineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice_line
     */
    omit?: invoice_lineOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoice_lineInclude<ExtArgs> | null
    /**
     * Filter, which invoice_lines to fetch.
     */
    where?: invoice_lineWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of invoice_lines to fetch.
     */
    orderBy?: invoice_lineOrderByWithRelationInput | invoice_lineOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing invoice_lines.
     */
    cursor?: invoice_lineWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` invoice_lines from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` invoice_lines.
     */
    skip?: number
    distinct?: Invoice_lineScalarFieldEnum | Invoice_lineScalarFieldEnum[]
  }

  /**
   * invoice_line create
   */
  export type invoice_lineCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice_line
     */
    select?: invoice_lineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice_line
     */
    omit?: invoice_lineOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoice_lineInclude<ExtArgs> | null
    /**
     * The data needed to create a invoice_line.
     */
    data: XOR<invoice_lineCreateInput, invoice_lineUncheckedCreateInput>
  }

  /**
   * invoice_line createMany
   */
  export type invoice_lineCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many invoice_lines.
     */
    data: invoice_lineCreateManyInput | invoice_lineCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * invoice_line createManyAndReturn
   */
  export type invoice_lineCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice_line
     */
    select?: invoice_lineSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the invoice_line
     */
    omit?: invoice_lineOmit<ExtArgs> | null
    /**
     * The data used to create many invoice_lines.
     */
    data: invoice_lineCreateManyInput | invoice_lineCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoice_lineIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * invoice_line update
   */
  export type invoice_lineUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice_line
     */
    select?: invoice_lineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice_line
     */
    omit?: invoice_lineOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoice_lineInclude<ExtArgs> | null
    /**
     * The data needed to update a invoice_line.
     */
    data: XOR<invoice_lineUpdateInput, invoice_lineUncheckedUpdateInput>
    /**
     * Choose, which invoice_line to update.
     */
    where: invoice_lineWhereUniqueInput
  }

  /**
   * invoice_line updateMany
   */
  export type invoice_lineUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update invoice_lines.
     */
    data: XOR<invoice_lineUpdateManyMutationInput, invoice_lineUncheckedUpdateManyInput>
    /**
     * Filter which invoice_lines to update
     */
    where?: invoice_lineWhereInput
  }

  /**
   * invoice_line updateManyAndReturn
   */
  export type invoice_lineUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice_line
     */
    select?: invoice_lineSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the invoice_line
     */
    omit?: invoice_lineOmit<ExtArgs> | null
    /**
     * The data used to update invoice_lines.
     */
    data: XOR<invoice_lineUpdateManyMutationInput, invoice_lineUncheckedUpdateManyInput>
    /**
     * Filter which invoice_lines to update
     */
    where?: invoice_lineWhereInput
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoice_lineIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * invoice_line upsert
   */
  export type invoice_lineUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice_line
     */
    select?: invoice_lineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice_line
     */
    omit?: invoice_lineOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoice_lineInclude<ExtArgs> | null
    /**
     * The filter to search for the invoice_line to update in case it exists.
     */
    where: invoice_lineWhereUniqueInput
    /**
     * In case the invoice_line found by the `where` argument doesn't exist, create a new invoice_line with this data.
     */
    create: XOR<invoice_lineCreateInput, invoice_lineUncheckedCreateInput>
    /**
     * In case the invoice_line was found with the provided `where` argument, update it with this data.
     */
    update: XOR<invoice_lineUpdateInput, invoice_lineUncheckedUpdateInput>
  }

  /**
   * invoice_line delete
   */
  export type invoice_lineDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice_line
     */
    select?: invoice_lineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice_line
     */
    omit?: invoice_lineOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoice_lineInclude<ExtArgs> | null
    /**
     * Filter which invoice_line to delete.
     */
    where: invoice_lineWhereUniqueInput
  }

  /**
   * invoice_line deleteMany
   */
  export type invoice_lineDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which invoice_lines to delete
     */
    where?: invoice_lineWhereInput
  }

  /**
   * invoice_line without action
   */
  export type invoice_lineDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice_line
     */
    select?: invoice_lineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice_line
     */
    omit?: invoice_lineOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoice_lineInclude<ExtArgs> | null
  }


  /**
   * Model media_type
   */

  export type AggregateMedia_type = {
    _count: Media_typeCountAggregateOutputType | null
    _avg: Media_typeAvgAggregateOutputType | null
    _sum: Media_typeSumAggregateOutputType | null
    _min: Media_typeMinAggregateOutputType | null
    _max: Media_typeMaxAggregateOutputType | null
  }

  export type Media_typeAvgAggregateOutputType = {
    media_type_id: number | null
  }

  export type Media_typeSumAggregateOutputType = {
    media_type_id: number | null
  }

  export type Media_typeMinAggregateOutputType = {
    media_type_id: number | null
    name: string | null
  }

  export type Media_typeMaxAggregateOutputType = {
    media_type_id: number | null
    name: string | null
  }

  export type Media_typeCountAggregateOutputType = {
    media_type_id: number
    name: number
    _all: number
  }


  export type Media_typeAvgAggregateInputType = {
    media_type_id?: true
  }

  export type Media_typeSumAggregateInputType = {
    media_type_id?: true
  }

  export type Media_typeMinAggregateInputType = {
    media_type_id?: true
    name?: true
  }

  export type Media_typeMaxAggregateInputType = {
    media_type_id?: true
    name?: true
  }

  export type Media_typeCountAggregateInputType = {
    media_type_id?: true
    name?: true
    _all?: true
  }

  export type Media_typeAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which media_type to aggregate.
     */
    where?: media_typeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of media_types to fetch.
     */
    orderBy?: media_typeOrderByWithRelationInput | media_typeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: media_typeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` media_types from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` media_types.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned media_types
    **/
    _count?: true | Media_typeCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: Media_typeAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: Media_typeSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: Media_typeMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: Media_typeMaxAggregateInputType
  }

  export type GetMedia_typeAggregateType<T extends Media_typeAggregateArgs> = {
        [P in keyof T & keyof AggregateMedia_type]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMedia_type[P]>
      : GetScalarType<T[P], AggregateMedia_type[P]>
  }




  export type media_typeGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: media_typeWhereInput
    orderBy?: media_typeOrderByWithAggregationInput | media_typeOrderByWithAggregationInput[]
    by: Media_typeScalarFieldEnum[] | Media_typeScalarFieldEnum
    having?: media_typeScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: Media_typeCountAggregateInputType | true
    _avg?: Media_typeAvgAggregateInputType
    _sum?: Media_typeSumAggregateInputType
    _min?: Media_typeMinAggregateInputType
    _max?: Media_typeMaxAggregateInputType
  }

  export type Media_typeGroupByOutputType = {
    media_type_id: number
    name: string | null
    _count: Media_typeCountAggregateOutputType | null
    _avg: Media_typeAvgAggregateOutputType | null
    _sum: Media_typeSumAggregateOutputType | null
    _min: Media_typeMinAggregateOutputType | null
    _max: Media_typeMaxAggregateOutputType | null
  }

  type GetMedia_typeGroupByPayload<T extends media_typeGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<Media_typeGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof Media_typeGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], Media_typeGroupByOutputType[P]>
            : GetScalarType<T[P], Media_typeGroupByOutputType[P]>
        }
      >
    >


  export type media_typeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    media_type_id?: boolean
    name?: boolean
  }, ExtArgs["result"]["media_type"]>

  export type media_typeSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    media_type_id?: boolean
    name?: boolean
  }, ExtArgs["result"]["media_type"]>

  export type media_typeSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    media_type_id?: boolean
    name?: boolean
  }, ExtArgs["result"]["media_type"]>

  export type media_typeSelectScalar = {
    media_type_id?: boolean
    name?: boolean
  }

  export type media_typeOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"media_type_id" | "name", ExtArgs["result"]["media_type"]>

  export type $media_typePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "media_type"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      media_type_id: number
      name: string | null
    }, ExtArgs["result"]["media_type"]>
    composites: {}
  }

  type media_typeGetPayload<S extends boolean | null | undefined | media_typeDefaultArgs> = $Result.GetResult<Prisma.$media_typePayload, S>

  type media_typeCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<media_typeFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: Media_typeCountAggregateInputType | true
    }

  export interface media_typeDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['media_type'], meta: { name: 'media_type' } }
    /**
     * Find zero or one Media_type that matches the filter.
     * @param {media_typeFindUniqueArgs} args - Arguments to find a Media_type
     * @example
     * // Get one Media_type
     * const media_type = await prisma.media_type.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends media_typeFindUniqueArgs>(args: SelectSubset<T, media_typeFindUniqueArgs<ExtArgs>>): Prisma__media_typeClient<$Result.GetResult<Prisma.$media_typePayload<ExtArgs>, T, "findUnique", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find one Media_type that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {media_typeFindUniqueOrThrowArgs} args - Arguments to find a Media_type
     * @example
     * // Get one Media_type
     * const media_type = await prisma.media_type.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends media_typeFindUniqueOrThrowArgs>(args: SelectSubset<T, media_typeFindUniqueOrThrowArgs<ExtArgs>>): Prisma__media_typeClient<$Result.GetResult<Prisma.$media_typePayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find the first Media_type that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {media_typeFindFirstArgs} args - Arguments to find a Media_type
     * @example
     * // Get one Media_type
     * const media_type = await prisma.media_type.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends media_typeFindFirstArgs>(args?: SelectSubset<T, media_typeFindFirstArgs<ExtArgs>>): Prisma__media_typeClient<$Result.GetResult<Prisma.$media_typePayload<ExtArgs>, T, "findFirst", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find the first Media_type that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {media_typeFindFirstOrThrowArgs} args - Arguments to find a Media_type
     * @example
     * // Get one Media_type
     * const media_type = await prisma.media_type.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends media_typeFindFirstOrThrowArgs>(args?: SelectSubset<T, media_typeFindFirstOrThrowArgs<ExtArgs>>): Prisma__media_typeClient<$Result.GetResult<Prisma.$media_typePayload<ExtArgs>, T, "findFirstOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find zero or more Media_types that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {media_typeFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Media_types
     * const media_types = await prisma.media_type.findMany()
     * 
     * // Get first 10 Media_types
     * const media_types = await prisma.media_type.findMany({ take: 10 })
     * 
     * // Only select the `media_type_id`
     * const media_typeWithMedia_type_idOnly = await prisma.media_type.findMany({ select: { media_type_id: true } })
     * 
     */
    findMany<T extends media_typeFindManyArgs>(args?: SelectSubset<T, media_typeFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$media_typePayload<ExtArgs>, T, "findMany", ClientOptions>>

    /**
     * Create a Media_type.
     * @param {media_typeCreateArgs} args - Arguments to create a Media_type.
     * @example
     * // Create one Media_type
     * const Media_type = await prisma.media_type.create({
     *   data: {
     *     // ... data to create a Media_type
     *   }
     * })
     * 
     */
    create<T extends media_typeCreateArgs>(args: SelectSubset<T, media_typeCreateArgs<ExtArgs>>): Prisma__media_typeClient<$Result.GetResult<Prisma.$media_typePayload<ExtArgs>, T, "create", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Create many Media_types.
     * @param {media_typeCreateManyArgs} args - Arguments to create many Media_types.
     * @example
     * // Create many Media_types
     * const media_type = await prisma.media_type.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends media_typeCreateManyArgs>(args?: SelectSubset<T, media_typeCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Media_types and returns the data saved in the database.
     * @param {media_typeCreateManyAndReturnArgs} args - Arguments to create many Media_types.
     * @example
     * // Create many Media_types
     * const media_type = await prisma.media_type.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Media_types and only return the `media_type_id`
     * const media_typeWithMedia_type_idOnly = await prisma.media_type.createManyAndReturn({
     *   select: { media_type_id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends media_typeCreateManyAndReturnArgs>(args?: SelectSubset<T, media_typeCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$media_typePayload<ExtArgs>, T, "createManyAndReturn", ClientOptions>>

    /**
     * Delete a Media_type.
     * @param {media_typeDeleteArgs} args - Arguments to delete one Media_type.
     * @example
     * // Delete one Media_type
     * const Media_type = await prisma.media_type.delete({
     *   where: {
     *     // ... filter to delete one Media_type
     *   }
     * })
     * 
     */
    delete<T extends media_typeDeleteArgs>(args: SelectSubset<T, media_typeDeleteArgs<ExtArgs>>): Prisma__media_typeClient<$Result.GetResult<Prisma.$media_typePayload<ExtArgs>, T, "delete", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Update one Media_type.
     * @param {media_typeUpdateArgs} args - Arguments to update one Media_type.
     * @example
     * // Update one Media_type
     * const media_type = await prisma.media_type.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends media_typeUpdateArgs>(args: SelectSubset<T, media_typeUpdateArgs<ExtArgs>>): Prisma__media_typeClient<$Result.GetResult<Prisma.$media_typePayload<ExtArgs>, T, "update", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Delete zero or more Media_types.
     * @param {media_typeDeleteManyArgs} args - Arguments to filter Media_types to delete.
     * @example
     * // Delete a few Media_types
     * const { count } = await prisma.media_type.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends media_typeDeleteManyArgs>(args?: SelectSubset<T, media_typeDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Media_types.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {media_typeUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Media_types
     * const media_type = await prisma.media_type.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends media_typeUpdateManyArgs>(args: SelectSubset<T, media_typeUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Media_types and returns the data updated in the database.
     * @param {media_typeUpdateManyAndReturnArgs} args - Arguments to update many Media_types.
     * @example
     * // Update many Media_types
     * const media_type = await prisma.media_type.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Media_types and only return the `media_type_id`
     * const media_typeWithMedia_type_idOnly = await prisma.media_type.updateManyAndReturn({
     *   select: { media_type_id: true },
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
    updateManyAndReturn<T extends media_typeUpdateManyAndReturnArgs>(args: SelectSubset<T, media_typeUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$media_typePayload<ExtArgs>, T, "updateManyAndReturn", ClientOptions>>

    /**
     * Create or update one Media_type.
     * @param {media_typeUpsertArgs} args - Arguments to update or create a Media_type.
     * @example
     * // Update or create a Media_type
     * const media_type = await prisma.media_type.upsert({
     *   create: {
     *     // ... data to create a Media_type
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Media_type we want to update
     *   }
     * })
     */
    upsert<T extends media_typeUpsertArgs>(args: SelectSubset<T, media_typeUpsertArgs<ExtArgs>>): Prisma__media_typeClient<$Result.GetResult<Prisma.$media_typePayload<ExtArgs>, T, "upsert", ClientOptions>, never, ExtArgs, ClientOptions>


    /**
     * Count the number of Media_types.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {media_typeCountArgs} args - Arguments to filter Media_types to count.
     * @example
     * // Count the number of Media_types
     * const count = await prisma.media_type.count({
     *   where: {
     *     // ... the filter for the Media_types we want to count
     *   }
     * })
    **/
    count<T extends media_typeCountArgs>(
      args?: Subset<T, media_typeCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], Media_typeCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Media_type.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {Media_typeAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends Media_typeAggregateArgs>(args: Subset<T, Media_typeAggregateArgs>): Prisma.PrismaPromise<GetMedia_typeAggregateType<T>>

    /**
     * Group by Media_type.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {media_typeGroupByArgs} args - Group by arguments.
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
      T extends media_typeGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: media_typeGroupByArgs['orderBy'] }
        : { orderBy?: media_typeGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, media_typeGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMedia_typeGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the media_type model
   */
  readonly fields: media_typeFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for media_type.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__media_typeClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> extends Prisma.PrismaPromise<T> {
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
   * Fields of the media_type model
   */ 
  interface media_typeFieldRefs {
    readonly media_type_id: FieldRef<"media_type", 'Int'>
    readonly name: FieldRef<"media_type", 'String'>
  }
    

  // Custom InputTypes
  /**
   * media_type findUnique
   */
  export type media_typeFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the media_type
     */
    select?: media_typeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the media_type
     */
    omit?: media_typeOmit<ExtArgs> | null
    /**
     * Filter, which media_type to fetch.
     */
    where: media_typeWhereUniqueInput
  }

  /**
   * media_type findUniqueOrThrow
   */
  export type media_typeFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the media_type
     */
    select?: media_typeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the media_type
     */
    omit?: media_typeOmit<ExtArgs> | null
    /**
     * Filter, which media_type to fetch.
     */
    where: media_typeWhereUniqueInput
  }

  /**
   * media_type findFirst
   */
  export type media_typeFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the media_type
     */
    select?: media_typeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the media_type
     */
    omit?: media_typeOmit<ExtArgs> | null
    /**
     * Filter, which media_type to fetch.
     */
    where?: media_typeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of media_types to fetch.
     */
    orderBy?: media_typeOrderByWithRelationInput | media_typeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for media_types.
     */
    cursor?: media_typeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` media_types from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` media_types.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of media_types.
     */
    distinct?: Media_typeScalarFieldEnum | Media_typeScalarFieldEnum[]
  }

  /**
   * media_type findFirstOrThrow
   */
  export type media_typeFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the media_type
     */
    select?: media_typeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the media_type
     */
    omit?: media_typeOmit<ExtArgs> | null
    /**
     * Filter, which media_type to fetch.
     */
    where?: media_typeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of media_types to fetch.
     */
    orderBy?: media_typeOrderByWithRelationInput | media_typeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for media_types.
     */
    cursor?: media_typeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` media_types from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` media_types.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of media_types.
     */
    distinct?: Media_typeScalarFieldEnum | Media_typeScalarFieldEnum[]
  }

  /**
   * media_type findMany
   */
  export type media_typeFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the media_type
     */
    select?: media_typeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the media_type
     */
    omit?: media_typeOmit<ExtArgs> | null
    /**
     * Filter, which media_types to fetch.
     */
    where?: media_typeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of media_types to fetch.
     */
    orderBy?: media_typeOrderByWithRelationInput | media_typeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing media_types.
     */
    cursor?: media_typeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` media_types from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` media_types.
     */
    skip?: number
    distinct?: Media_typeScalarFieldEnum | Media_typeScalarFieldEnum[]
  }

  /**
   * media_type create
   */
  export type media_typeCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the media_type
     */
    select?: media_typeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the media_type
     */
    omit?: media_typeOmit<ExtArgs> | null
    /**
     * The data needed to create a media_type.
     */
    data: XOR<media_typeCreateInput, media_typeUncheckedCreateInput>
  }

  /**
   * media_type createMany
   */
  export type media_typeCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many media_types.
     */
    data: media_typeCreateManyInput | media_typeCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * media_type createManyAndReturn
   */
  export type media_typeCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the media_type
     */
    select?: media_typeSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the media_type
     */
    omit?: media_typeOmit<ExtArgs> | null
    /**
     * The data used to create many media_types.
     */
    data: media_typeCreateManyInput | media_typeCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * media_type update
   */
  export type media_typeUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the media_type
     */
    select?: media_typeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the media_type
     */
    omit?: media_typeOmit<ExtArgs> | null
    /**
     * The data needed to update a media_type.
     */
    data: XOR<media_typeUpdateInput, media_typeUncheckedUpdateInput>
    /**
     * Choose, which media_type to update.
     */
    where: media_typeWhereUniqueInput
  }

  /**
   * media_type updateMany
   */
  export type media_typeUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update media_types.
     */
    data: XOR<media_typeUpdateManyMutationInput, media_typeUncheckedUpdateManyInput>
    /**
     * Filter which media_types to update
     */
    where?: media_typeWhereInput
  }

  /**
   * media_type updateManyAndReturn
   */
  export type media_typeUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the media_type
     */
    select?: media_typeSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the media_type
     */
    omit?: media_typeOmit<ExtArgs> | null
    /**
     * The data used to update media_types.
     */
    data: XOR<media_typeUpdateManyMutationInput, media_typeUncheckedUpdateManyInput>
    /**
     * Filter which media_types to update
     */
    where?: media_typeWhereInput
  }

  /**
   * media_type upsert
   */
  export type media_typeUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the media_type
     */
    select?: media_typeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the media_type
     */
    omit?: media_typeOmit<ExtArgs> | null
    /**
     * The filter to search for the media_type to update in case it exists.
     */
    where: media_typeWhereUniqueInput
    /**
     * In case the media_type found by the `where` argument doesn't exist, create a new media_type with this data.
     */
    create: XOR<media_typeCreateInput, media_typeUncheckedCreateInput>
    /**
     * In case the media_type was found with the provided `where` argument, update it with this data.
     */
    update: XOR<media_typeUpdateInput, media_typeUncheckedUpdateInput>
  }

  /**
   * media_type delete
   */
  export type media_typeDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the media_type
     */
    select?: media_typeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the media_type
     */
    omit?: media_typeOmit<ExtArgs> | null
    /**
     * Filter which media_type to delete.
     */
    where: media_typeWhereUniqueInput
  }

  /**
   * media_type deleteMany
   */
  export type media_typeDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which media_types to delete
     */
    where?: media_typeWhereInput
  }

  /**
   * media_type without action
   */
  export type media_typeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the media_type
     */
    select?: media_typeSelect<ExtArgs> | null
    /**
     * Omit specific fields from the media_type
     */
    omit?: media_typeOmit<ExtArgs> | null
  }


  /**
   * Model playlist
   */

  export type AggregatePlaylist = {
    _count: PlaylistCountAggregateOutputType | null
    _avg: PlaylistAvgAggregateOutputType | null
    _sum: PlaylistSumAggregateOutputType | null
    _min: PlaylistMinAggregateOutputType | null
    _max: PlaylistMaxAggregateOutputType | null
  }

  export type PlaylistAvgAggregateOutputType = {
    playlist_id: number | null
  }

  export type PlaylistSumAggregateOutputType = {
    playlist_id: number | null
  }

  export type PlaylistMinAggregateOutputType = {
    playlist_id: number | null
    name: string | null
  }

  export type PlaylistMaxAggregateOutputType = {
    playlist_id: number | null
    name: string | null
  }

  export type PlaylistCountAggregateOutputType = {
    playlist_id: number
    name: number
    _all: number
  }


  export type PlaylistAvgAggregateInputType = {
    playlist_id?: true
  }

  export type PlaylistSumAggregateInputType = {
    playlist_id?: true
  }

  export type PlaylistMinAggregateInputType = {
    playlist_id?: true
    name?: true
  }

  export type PlaylistMaxAggregateInputType = {
    playlist_id?: true
    name?: true
  }

  export type PlaylistCountAggregateInputType = {
    playlist_id?: true
    name?: true
    _all?: true
  }

  export type PlaylistAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which playlist to aggregate.
     */
    where?: playlistWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of playlists to fetch.
     */
    orderBy?: playlistOrderByWithRelationInput | playlistOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: playlistWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` playlists from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` playlists.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned playlists
    **/
    _count?: true | PlaylistCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: PlaylistAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: PlaylistSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: PlaylistMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: PlaylistMaxAggregateInputType
  }

  export type GetPlaylistAggregateType<T extends PlaylistAggregateArgs> = {
        [P in keyof T & keyof AggregatePlaylist]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePlaylist[P]>
      : GetScalarType<T[P], AggregatePlaylist[P]>
  }




  export type playlistGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: playlistWhereInput
    orderBy?: playlistOrderByWithAggregationInput | playlistOrderByWithAggregationInput[]
    by: PlaylistScalarFieldEnum[] | PlaylistScalarFieldEnum
    having?: playlistScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: PlaylistCountAggregateInputType | true
    _avg?: PlaylistAvgAggregateInputType
    _sum?: PlaylistSumAggregateInputType
    _min?: PlaylistMinAggregateInputType
    _max?: PlaylistMaxAggregateInputType
  }

  export type PlaylistGroupByOutputType = {
    playlist_id: number
    name: string | null
    _count: PlaylistCountAggregateOutputType | null
    _avg: PlaylistAvgAggregateOutputType | null
    _sum: PlaylistSumAggregateOutputType | null
    _min: PlaylistMinAggregateOutputType | null
    _max: PlaylistMaxAggregateOutputType | null
  }

  type GetPlaylistGroupByPayload<T extends playlistGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<PlaylistGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof PlaylistGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], PlaylistGroupByOutputType[P]>
            : GetScalarType<T[P], PlaylistGroupByOutputType[P]>
        }
      >
    >


  export type playlistSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    playlist_id?: boolean
    name?: boolean
    playlist_track?: boolean | playlist$playlist_trackArgs<ExtArgs>
    _count?: boolean | PlaylistCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["playlist"]>

  export type playlistSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    playlist_id?: boolean
    name?: boolean
  }, ExtArgs["result"]["playlist"]>

  export type playlistSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    playlist_id?: boolean
    name?: boolean
  }, ExtArgs["result"]["playlist"]>

  export type playlistSelectScalar = {
    playlist_id?: boolean
    name?: boolean
  }

  export type playlistOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"playlist_id" | "name", ExtArgs["result"]["playlist"]>
  export type playlistInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    playlist_track?: boolean | playlist$playlist_trackArgs<ExtArgs>
    _count?: boolean | PlaylistCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type playlistIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type playlistIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $playlistPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "playlist"
    objects: {
      playlist_track: Prisma.$playlist_trackPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      playlist_id: number
      name: string | null
    }, ExtArgs["result"]["playlist"]>
    composites: {}
  }

  type playlistGetPayload<S extends boolean | null | undefined | playlistDefaultArgs> = $Result.GetResult<Prisma.$playlistPayload, S>

  type playlistCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<playlistFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: PlaylistCountAggregateInputType | true
    }

  export interface playlistDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['playlist'], meta: { name: 'playlist' } }
    /**
     * Find zero or one Playlist that matches the filter.
     * @param {playlistFindUniqueArgs} args - Arguments to find a Playlist
     * @example
     * // Get one Playlist
     * const playlist = await prisma.playlist.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends playlistFindUniqueArgs>(args: SelectSubset<T, playlistFindUniqueArgs<ExtArgs>>): Prisma__playlistClient<$Result.GetResult<Prisma.$playlistPayload<ExtArgs>, T, "findUnique", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find one Playlist that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {playlistFindUniqueOrThrowArgs} args - Arguments to find a Playlist
     * @example
     * // Get one Playlist
     * const playlist = await prisma.playlist.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends playlistFindUniqueOrThrowArgs>(args: SelectSubset<T, playlistFindUniqueOrThrowArgs<ExtArgs>>): Prisma__playlistClient<$Result.GetResult<Prisma.$playlistPayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find the first Playlist that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {playlistFindFirstArgs} args - Arguments to find a Playlist
     * @example
     * // Get one Playlist
     * const playlist = await prisma.playlist.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends playlistFindFirstArgs>(args?: SelectSubset<T, playlistFindFirstArgs<ExtArgs>>): Prisma__playlistClient<$Result.GetResult<Prisma.$playlistPayload<ExtArgs>, T, "findFirst", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find the first Playlist that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {playlistFindFirstOrThrowArgs} args - Arguments to find a Playlist
     * @example
     * // Get one Playlist
     * const playlist = await prisma.playlist.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends playlistFindFirstOrThrowArgs>(args?: SelectSubset<T, playlistFindFirstOrThrowArgs<ExtArgs>>): Prisma__playlistClient<$Result.GetResult<Prisma.$playlistPayload<ExtArgs>, T, "findFirstOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find zero or more Playlists that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {playlistFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Playlists
     * const playlists = await prisma.playlist.findMany()
     * 
     * // Get first 10 Playlists
     * const playlists = await prisma.playlist.findMany({ take: 10 })
     * 
     * // Only select the `playlist_id`
     * const playlistWithPlaylist_idOnly = await prisma.playlist.findMany({ select: { playlist_id: true } })
     * 
     */
    findMany<T extends playlistFindManyArgs>(args?: SelectSubset<T, playlistFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$playlistPayload<ExtArgs>, T, "findMany", ClientOptions>>

    /**
     * Create a Playlist.
     * @param {playlistCreateArgs} args - Arguments to create a Playlist.
     * @example
     * // Create one Playlist
     * const Playlist = await prisma.playlist.create({
     *   data: {
     *     // ... data to create a Playlist
     *   }
     * })
     * 
     */
    create<T extends playlistCreateArgs>(args: SelectSubset<T, playlistCreateArgs<ExtArgs>>): Prisma__playlistClient<$Result.GetResult<Prisma.$playlistPayload<ExtArgs>, T, "create", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Create many Playlists.
     * @param {playlistCreateManyArgs} args - Arguments to create many Playlists.
     * @example
     * // Create many Playlists
     * const playlist = await prisma.playlist.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends playlistCreateManyArgs>(args?: SelectSubset<T, playlistCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Playlists and returns the data saved in the database.
     * @param {playlistCreateManyAndReturnArgs} args - Arguments to create many Playlists.
     * @example
     * // Create many Playlists
     * const playlist = await prisma.playlist.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Playlists and only return the `playlist_id`
     * const playlistWithPlaylist_idOnly = await prisma.playlist.createManyAndReturn({
     *   select: { playlist_id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends playlistCreateManyAndReturnArgs>(args?: SelectSubset<T, playlistCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$playlistPayload<ExtArgs>, T, "createManyAndReturn", ClientOptions>>

    /**
     * Delete a Playlist.
     * @param {playlistDeleteArgs} args - Arguments to delete one Playlist.
     * @example
     * // Delete one Playlist
     * const Playlist = await prisma.playlist.delete({
     *   where: {
     *     // ... filter to delete one Playlist
     *   }
     * })
     * 
     */
    delete<T extends playlistDeleteArgs>(args: SelectSubset<T, playlistDeleteArgs<ExtArgs>>): Prisma__playlistClient<$Result.GetResult<Prisma.$playlistPayload<ExtArgs>, T, "delete", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Update one Playlist.
     * @param {playlistUpdateArgs} args - Arguments to update one Playlist.
     * @example
     * // Update one Playlist
     * const playlist = await prisma.playlist.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends playlistUpdateArgs>(args: SelectSubset<T, playlistUpdateArgs<ExtArgs>>): Prisma__playlistClient<$Result.GetResult<Prisma.$playlistPayload<ExtArgs>, T, "update", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Delete zero or more Playlists.
     * @param {playlistDeleteManyArgs} args - Arguments to filter Playlists to delete.
     * @example
     * // Delete a few Playlists
     * const { count } = await prisma.playlist.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends playlistDeleteManyArgs>(args?: SelectSubset<T, playlistDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Playlists.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {playlistUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Playlists
     * const playlist = await prisma.playlist.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends playlistUpdateManyArgs>(args: SelectSubset<T, playlistUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Playlists and returns the data updated in the database.
     * @param {playlistUpdateManyAndReturnArgs} args - Arguments to update many Playlists.
     * @example
     * // Update many Playlists
     * const playlist = await prisma.playlist.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Playlists and only return the `playlist_id`
     * const playlistWithPlaylist_idOnly = await prisma.playlist.updateManyAndReturn({
     *   select: { playlist_id: true },
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
    updateManyAndReturn<T extends playlistUpdateManyAndReturnArgs>(args: SelectSubset<T, playlistUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$playlistPayload<ExtArgs>, T, "updateManyAndReturn", ClientOptions>>

    /**
     * Create or update one Playlist.
     * @param {playlistUpsertArgs} args - Arguments to update or create a Playlist.
     * @example
     * // Update or create a Playlist
     * const playlist = await prisma.playlist.upsert({
     *   create: {
     *     // ... data to create a Playlist
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Playlist we want to update
     *   }
     * })
     */
    upsert<T extends playlistUpsertArgs>(args: SelectSubset<T, playlistUpsertArgs<ExtArgs>>): Prisma__playlistClient<$Result.GetResult<Prisma.$playlistPayload<ExtArgs>, T, "upsert", ClientOptions>, never, ExtArgs, ClientOptions>


    /**
     * Count the number of Playlists.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {playlistCountArgs} args - Arguments to filter Playlists to count.
     * @example
     * // Count the number of Playlists
     * const count = await prisma.playlist.count({
     *   where: {
     *     // ... the filter for the Playlists we want to count
     *   }
     * })
    **/
    count<T extends playlistCountArgs>(
      args?: Subset<T, playlistCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], PlaylistCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Playlist.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {PlaylistAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends PlaylistAggregateArgs>(args: Subset<T, PlaylistAggregateArgs>): Prisma.PrismaPromise<GetPlaylistAggregateType<T>>

    /**
     * Group by Playlist.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {playlistGroupByArgs} args - Group by arguments.
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
      T extends playlistGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: playlistGroupByArgs['orderBy'] }
        : { orderBy?: playlistGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, playlistGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPlaylistGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the playlist model
   */
  readonly fields: playlistFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for playlist.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__playlistClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    playlist_track<T extends playlist$playlist_trackArgs<ExtArgs> = {}>(args?: Subset<T, playlist$playlist_trackArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$playlist_trackPayload<ExtArgs>, T, "findMany", ClientOptions> | Null>
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
   * Fields of the playlist model
   */ 
  interface playlistFieldRefs {
    readonly playlist_id: FieldRef<"playlist", 'Int'>
    readonly name: FieldRef<"playlist", 'String'>
  }
    

  // Custom InputTypes
  /**
   * playlist findUnique
   */
  export type playlistFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist
     */
    select?: playlistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist
     */
    omit?: playlistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlistInclude<ExtArgs> | null
    /**
     * Filter, which playlist to fetch.
     */
    where: playlistWhereUniqueInput
  }

  /**
   * playlist findUniqueOrThrow
   */
  export type playlistFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist
     */
    select?: playlistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist
     */
    omit?: playlistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlistInclude<ExtArgs> | null
    /**
     * Filter, which playlist to fetch.
     */
    where: playlistWhereUniqueInput
  }

  /**
   * playlist findFirst
   */
  export type playlistFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist
     */
    select?: playlistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist
     */
    omit?: playlistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlistInclude<ExtArgs> | null
    /**
     * Filter, which playlist to fetch.
     */
    where?: playlistWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of playlists to fetch.
     */
    orderBy?: playlistOrderByWithRelationInput | playlistOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for playlists.
     */
    cursor?: playlistWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` playlists from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` playlists.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of playlists.
     */
    distinct?: PlaylistScalarFieldEnum | PlaylistScalarFieldEnum[]
  }

  /**
   * playlist findFirstOrThrow
   */
  export type playlistFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist
     */
    select?: playlistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist
     */
    omit?: playlistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlistInclude<ExtArgs> | null
    /**
     * Filter, which playlist to fetch.
     */
    where?: playlistWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of playlists to fetch.
     */
    orderBy?: playlistOrderByWithRelationInput | playlistOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for playlists.
     */
    cursor?: playlistWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` playlists from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` playlists.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of playlists.
     */
    distinct?: PlaylistScalarFieldEnum | PlaylistScalarFieldEnum[]
  }

  /**
   * playlist findMany
   */
  export type playlistFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist
     */
    select?: playlistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist
     */
    omit?: playlistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlistInclude<ExtArgs> | null
    /**
     * Filter, which playlists to fetch.
     */
    where?: playlistWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of playlists to fetch.
     */
    orderBy?: playlistOrderByWithRelationInput | playlistOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing playlists.
     */
    cursor?: playlistWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` playlists from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` playlists.
     */
    skip?: number
    distinct?: PlaylistScalarFieldEnum | PlaylistScalarFieldEnum[]
  }

  /**
   * playlist create
   */
  export type playlistCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist
     */
    select?: playlistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist
     */
    omit?: playlistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlistInclude<ExtArgs> | null
    /**
     * The data needed to create a playlist.
     */
    data: XOR<playlistCreateInput, playlistUncheckedCreateInput>
  }

  /**
   * playlist createMany
   */
  export type playlistCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many playlists.
     */
    data: playlistCreateManyInput | playlistCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * playlist createManyAndReturn
   */
  export type playlistCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist
     */
    select?: playlistSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the playlist
     */
    omit?: playlistOmit<ExtArgs> | null
    /**
     * The data used to create many playlists.
     */
    data: playlistCreateManyInput | playlistCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * playlist update
   */
  export type playlistUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist
     */
    select?: playlistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist
     */
    omit?: playlistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlistInclude<ExtArgs> | null
    /**
     * The data needed to update a playlist.
     */
    data: XOR<playlistUpdateInput, playlistUncheckedUpdateInput>
    /**
     * Choose, which playlist to update.
     */
    where: playlistWhereUniqueInput
  }

  /**
   * playlist updateMany
   */
  export type playlistUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update playlists.
     */
    data: XOR<playlistUpdateManyMutationInput, playlistUncheckedUpdateManyInput>
    /**
     * Filter which playlists to update
     */
    where?: playlistWhereInput
  }

  /**
   * playlist updateManyAndReturn
   */
  export type playlistUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist
     */
    select?: playlistSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the playlist
     */
    omit?: playlistOmit<ExtArgs> | null
    /**
     * The data used to update playlists.
     */
    data: XOR<playlistUpdateManyMutationInput, playlistUncheckedUpdateManyInput>
    /**
     * Filter which playlists to update
     */
    where?: playlistWhereInput
  }

  /**
   * playlist upsert
   */
  export type playlistUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist
     */
    select?: playlistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist
     */
    omit?: playlistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlistInclude<ExtArgs> | null
    /**
     * The filter to search for the playlist to update in case it exists.
     */
    where: playlistWhereUniqueInput
    /**
     * In case the playlist found by the `where` argument doesn't exist, create a new playlist with this data.
     */
    create: XOR<playlistCreateInput, playlistUncheckedCreateInput>
    /**
     * In case the playlist was found with the provided `where` argument, update it with this data.
     */
    update: XOR<playlistUpdateInput, playlistUncheckedUpdateInput>
  }

  /**
   * playlist delete
   */
  export type playlistDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist
     */
    select?: playlistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist
     */
    omit?: playlistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlistInclude<ExtArgs> | null
    /**
     * Filter which playlist to delete.
     */
    where: playlistWhereUniqueInput
  }

  /**
   * playlist deleteMany
   */
  export type playlistDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which playlists to delete
     */
    where?: playlistWhereInput
  }

  /**
   * playlist.playlist_track
   */
  export type playlist$playlist_trackArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist_track
     */
    select?: playlist_trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist_track
     */
    omit?: playlist_trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlist_trackInclude<ExtArgs> | null
    where?: playlist_trackWhereInput
    orderBy?: playlist_trackOrderByWithRelationInput | playlist_trackOrderByWithRelationInput[]
    cursor?: playlist_trackWhereUniqueInput
    take?: number
    skip?: number
    distinct?: Playlist_trackScalarFieldEnum | Playlist_trackScalarFieldEnum[]
  }

  /**
   * playlist without action
   */
  export type playlistDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist
     */
    select?: playlistSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist
     */
    omit?: playlistOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlistInclude<ExtArgs> | null
  }


  /**
   * Model playlist_track
   */

  export type AggregatePlaylist_track = {
    _count: Playlist_trackCountAggregateOutputType | null
    _avg: Playlist_trackAvgAggregateOutputType | null
    _sum: Playlist_trackSumAggregateOutputType | null
    _min: Playlist_trackMinAggregateOutputType | null
    _max: Playlist_trackMaxAggregateOutputType | null
  }

  export type Playlist_trackAvgAggregateOutputType = {
    playlist_id: number | null
    track_id: number | null
  }

  export type Playlist_trackSumAggregateOutputType = {
    playlist_id: number | null
    track_id: number | null
  }

  export type Playlist_trackMinAggregateOutputType = {
    playlist_id: number | null
    track_id: number | null
  }

  export type Playlist_trackMaxAggregateOutputType = {
    playlist_id: number | null
    track_id: number | null
  }

  export type Playlist_trackCountAggregateOutputType = {
    playlist_id: number
    track_id: number
    _all: number
  }


  export type Playlist_trackAvgAggregateInputType = {
    playlist_id?: true
    track_id?: true
  }

  export type Playlist_trackSumAggregateInputType = {
    playlist_id?: true
    track_id?: true
  }

  export type Playlist_trackMinAggregateInputType = {
    playlist_id?: true
    track_id?: true
  }

  export type Playlist_trackMaxAggregateInputType = {
    playlist_id?: true
    track_id?: true
  }

  export type Playlist_trackCountAggregateInputType = {
    playlist_id?: true
    track_id?: true
    _all?: true
  }

  export type Playlist_trackAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which playlist_track to aggregate.
     */
    where?: playlist_trackWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of playlist_tracks to fetch.
     */
    orderBy?: playlist_trackOrderByWithRelationInput | playlist_trackOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: playlist_trackWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` playlist_tracks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` playlist_tracks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned playlist_tracks
    **/
    _count?: true | Playlist_trackCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: Playlist_trackAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: Playlist_trackSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: Playlist_trackMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: Playlist_trackMaxAggregateInputType
  }

  export type GetPlaylist_trackAggregateType<T extends Playlist_trackAggregateArgs> = {
        [P in keyof T & keyof AggregatePlaylist_track]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregatePlaylist_track[P]>
      : GetScalarType<T[P], AggregatePlaylist_track[P]>
  }




  export type playlist_trackGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: playlist_trackWhereInput
    orderBy?: playlist_trackOrderByWithAggregationInput | playlist_trackOrderByWithAggregationInput[]
    by: Playlist_trackScalarFieldEnum[] | Playlist_trackScalarFieldEnum
    having?: playlist_trackScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: Playlist_trackCountAggregateInputType | true
    _avg?: Playlist_trackAvgAggregateInputType
    _sum?: Playlist_trackSumAggregateInputType
    _min?: Playlist_trackMinAggregateInputType
    _max?: Playlist_trackMaxAggregateInputType
  }

  export type Playlist_trackGroupByOutputType = {
    playlist_id: number
    track_id: number
    _count: Playlist_trackCountAggregateOutputType | null
    _avg: Playlist_trackAvgAggregateOutputType | null
    _sum: Playlist_trackSumAggregateOutputType | null
    _min: Playlist_trackMinAggregateOutputType | null
    _max: Playlist_trackMaxAggregateOutputType | null
  }

  type GetPlaylist_trackGroupByPayload<T extends playlist_trackGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<Playlist_trackGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof Playlist_trackGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], Playlist_trackGroupByOutputType[P]>
            : GetScalarType<T[P], Playlist_trackGroupByOutputType[P]>
        }
      >
    >


  export type playlist_trackSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    playlist_id?: boolean
    track_id?: boolean
    playlist?: boolean | playlistDefaultArgs<ExtArgs>
    track?: boolean | trackDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["playlist_track"]>

  export type playlist_trackSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    playlist_id?: boolean
    track_id?: boolean
    playlist?: boolean | playlistDefaultArgs<ExtArgs>
    track?: boolean | trackDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["playlist_track"]>

  export type playlist_trackSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    playlist_id?: boolean
    track_id?: boolean
    playlist?: boolean | playlistDefaultArgs<ExtArgs>
    track?: boolean | trackDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["playlist_track"]>

  export type playlist_trackSelectScalar = {
    playlist_id?: boolean
    track_id?: boolean
  }

  export type playlist_trackOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"playlist_id" | "track_id", ExtArgs["result"]["playlist_track"]>
  export type playlist_trackInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    playlist?: boolean | playlistDefaultArgs<ExtArgs>
    track?: boolean | trackDefaultArgs<ExtArgs>
  }
  export type playlist_trackIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    playlist?: boolean | playlistDefaultArgs<ExtArgs>
    track?: boolean | trackDefaultArgs<ExtArgs>
  }
  export type playlist_trackIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    playlist?: boolean | playlistDefaultArgs<ExtArgs>
    track?: boolean | trackDefaultArgs<ExtArgs>
  }

  export type $playlist_trackPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "playlist_track"
    objects: {
      playlist: Prisma.$playlistPayload<ExtArgs>
      track: Prisma.$trackPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      playlist_id: number
      track_id: number
    }, ExtArgs["result"]["playlist_track"]>
    composites: {}
  }

  type playlist_trackGetPayload<S extends boolean | null | undefined | playlist_trackDefaultArgs> = $Result.GetResult<Prisma.$playlist_trackPayload, S>

  type playlist_trackCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<playlist_trackFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: Playlist_trackCountAggregateInputType | true
    }

  export interface playlist_trackDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['playlist_track'], meta: { name: 'playlist_track' } }
    /**
     * Find zero or one Playlist_track that matches the filter.
     * @param {playlist_trackFindUniqueArgs} args - Arguments to find a Playlist_track
     * @example
     * // Get one Playlist_track
     * const playlist_track = await prisma.playlist_track.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends playlist_trackFindUniqueArgs>(args: SelectSubset<T, playlist_trackFindUniqueArgs<ExtArgs>>): Prisma__playlist_trackClient<$Result.GetResult<Prisma.$playlist_trackPayload<ExtArgs>, T, "findUnique", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find one Playlist_track that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {playlist_trackFindUniqueOrThrowArgs} args - Arguments to find a Playlist_track
     * @example
     * // Get one Playlist_track
     * const playlist_track = await prisma.playlist_track.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends playlist_trackFindUniqueOrThrowArgs>(args: SelectSubset<T, playlist_trackFindUniqueOrThrowArgs<ExtArgs>>): Prisma__playlist_trackClient<$Result.GetResult<Prisma.$playlist_trackPayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find the first Playlist_track that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {playlist_trackFindFirstArgs} args - Arguments to find a Playlist_track
     * @example
     * // Get one Playlist_track
     * const playlist_track = await prisma.playlist_track.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends playlist_trackFindFirstArgs>(args?: SelectSubset<T, playlist_trackFindFirstArgs<ExtArgs>>): Prisma__playlist_trackClient<$Result.GetResult<Prisma.$playlist_trackPayload<ExtArgs>, T, "findFirst", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find the first Playlist_track that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {playlist_trackFindFirstOrThrowArgs} args - Arguments to find a Playlist_track
     * @example
     * // Get one Playlist_track
     * const playlist_track = await prisma.playlist_track.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends playlist_trackFindFirstOrThrowArgs>(args?: SelectSubset<T, playlist_trackFindFirstOrThrowArgs<ExtArgs>>): Prisma__playlist_trackClient<$Result.GetResult<Prisma.$playlist_trackPayload<ExtArgs>, T, "findFirstOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find zero or more Playlist_tracks that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {playlist_trackFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Playlist_tracks
     * const playlist_tracks = await prisma.playlist_track.findMany()
     * 
     * // Get first 10 Playlist_tracks
     * const playlist_tracks = await prisma.playlist_track.findMany({ take: 10 })
     * 
     * // Only select the `playlist_id`
     * const playlist_trackWithPlaylist_idOnly = await prisma.playlist_track.findMany({ select: { playlist_id: true } })
     * 
     */
    findMany<T extends playlist_trackFindManyArgs>(args?: SelectSubset<T, playlist_trackFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$playlist_trackPayload<ExtArgs>, T, "findMany", ClientOptions>>

    /**
     * Create a Playlist_track.
     * @param {playlist_trackCreateArgs} args - Arguments to create a Playlist_track.
     * @example
     * // Create one Playlist_track
     * const Playlist_track = await prisma.playlist_track.create({
     *   data: {
     *     // ... data to create a Playlist_track
     *   }
     * })
     * 
     */
    create<T extends playlist_trackCreateArgs>(args: SelectSubset<T, playlist_trackCreateArgs<ExtArgs>>): Prisma__playlist_trackClient<$Result.GetResult<Prisma.$playlist_trackPayload<ExtArgs>, T, "create", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Create many Playlist_tracks.
     * @param {playlist_trackCreateManyArgs} args - Arguments to create many Playlist_tracks.
     * @example
     * // Create many Playlist_tracks
     * const playlist_track = await prisma.playlist_track.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends playlist_trackCreateManyArgs>(args?: SelectSubset<T, playlist_trackCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Playlist_tracks and returns the data saved in the database.
     * @param {playlist_trackCreateManyAndReturnArgs} args - Arguments to create many Playlist_tracks.
     * @example
     * // Create many Playlist_tracks
     * const playlist_track = await prisma.playlist_track.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Playlist_tracks and only return the `playlist_id`
     * const playlist_trackWithPlaylist_idOnly = await prisma.playlist_track.createManyAndReturn({
     *   select: { playlist_id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends playlist_trackCreateManyAndReturnArgs>(args?: SelectSubset<T, playlist_trackCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$playlist_trackPayload<ExtArgs>, T, "createManyAndReturn", ClientOptions>>

    /**
     * Delete a Playlist_track.
     * @param {playlist_trackDeleteArgs} args - Arguments to delete one Playlist_track.
     * @example
     * // Delete one Playlist_track
     * const Playlist_track = await prisma.playlist_track.delete({
     *   where: {
     *     // ... filter to delete one Playlist_track
     *   }
     * })
     * 
     */
    delete<T extends playlist_trackDeleteArgs>(args: SelectSubset<T, playlist_trackDeleteArgs<ExtArgs>>): Prisma__playlist_trackClient<$Result.GetResult<Prisma.$playlist_trackPayload<ExtArgs>, T, "delete", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Update one Playlist_track.
     * @param {playlist_trackUpdateArgs} args - Arguments to update one Playlist_track.
     * @example
     * // Update one Playlist_track
     * const playlist_track = await prisma.playlist_track.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends playlist_trackUpdateArgs>(args: SelectSubset<T, playlist_trackUpdateArgs<ExtArgs>>): Prisma__playlist_trackClient<$Result.GetResult<Prisma.$playlist_trackPayload<ExtArgs>, T, "update", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Delete zero or more Playlist_tracks.
     * @param {playlist_trackDeleteManyArgs} args - Arguments to filter Playlist_tracks to delete.
     * @example
     * // Delete a few Playlist_tracks
     * const { count } = await prisma.playlist_track.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends playlist_trackDeleteManyArgs>(args?: SelectSubset<T, playlist_trackDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Playlist_tracks.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {playlist_trackUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Playlist_tracks
     * const playlist_track = await prisma.playlist_track.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends playlist_trackUpdateManyArgs>(args: SelectSubset<T, playlist_trackUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Playlist_tracks and returns the data updated in the database.
     * @param {playlist_trackUpdateManyAndReturnArgs} args - Arguments to update many Playlist_tracks.
     * @example
     * // Update many Playlist_tracks
     * const playlist_track = await prisma.playlist_track.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Playlist_tracks and only return the `playlist_id`
     * const playlist_trackWithPlaylist_idOnly = await prisma.playlist_track.updateManyAndReturn({
     *   select: { playlist_id: true },
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
    updateManyAndReturn<T extends playlist_trackUpdateManyAndReturnArgs>(args: SelectSubset<T, playlist_trackUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$playlist_trackPayload<ExtArgs>, T, "updateManyAndReturn", ClientOptions>>

    /**
     * Create or update one Playlist_track.
     * @param {playlist_trackUpsertArgs} args - Arguments to update or create a Playlist_track.
     * @example
     * // Update or create a Playlist_track
     * const playlist_track = await prisma.playlist_track.upsert({
     *   create: {
     *     // ... data to create a Playlist_track
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Playlist_track we want to update
     *   }
     * })
     */
    upsert<T extends playlist_trackUpsertArgs>(args: SelectSubset<T, playlist_trackUpsertArgs<ExtArgs>>): Prisma__playlist_trackClient<$Result.GetResult<Prisma.$playlist_trackPayload<ExtArgs>, T, "upsert", ClientOptions>, never, ExtArgs, ClientOptions>


    /**
     * Count the number of Playlist_tracks.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {playlist_trackCountArgs} args - Arguments to filter Playlist_tracks to count.
     * @example
     * // Count the number of Playlist_tracks
     * const count = await prisma.playlist_track.count({
     *   where: {
     *     // ... the filter for the Playlist_tracks we want to count
     *   }
     * })
    **/
    count<T extends playlist_trackCountArgs>(
      args?: Subset<T, playlist_trackCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], Playlist_trackCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Playlist_track.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {Playlist_trackAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends Playlist_trackAggregateArgs>(args: Subset<T, Playlist_trackAggregateArgs>): Prisma.PrismaPromise<GetPlaylist_trackAggregateType<T>>

    /**
     * Group by Playlist_track.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {playlist_trackGroupByArgs} args - Group by arguments.
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
      T extends playlist_trackGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: playlist_trackGroupByArgs['orderBy'] }
        : { orderBy?: playlist_trackGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, playlist_trackGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetPlaylist_trackGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the playlist_track model
   */
  readonly fields: playlist_trackFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for playlist_track.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__playlist_trackClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    playlist<T extends playlistDefaultArgs<ExtArgs> = {}>(args?: Subset<T, playlistDefaultArgs<ExtArgs>>): Prisma__playlistClient<$Result.GetResult<Prisma.$playlistPayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions> | Null, Null, ExtArgs, ClientOptions>
    track<T extends trackDefaultArgs<ExtArgs> = {}>(args?: Subset<T, trackDefaultArgs<ExtArgs>>): Prisma__trackClient<$Result.GetResult<Prisma.$trackPayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions> | Null, Null, ExtArgs, ClientOptions>
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
   * Fields of the playlist_track model
   */ 
  interface playlist_trackFieldRefs {
    readonly playlist_id: FieldRef<"playlist_track", 'Int'>
    readonly track_id: FieldRef<"playlist_track", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * playlist_track findUnique
   */
  export type playlist_trackFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist_track
     */
    select?: playlist_trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist_track
     */
    omit?: playlist_trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlist_trackInclude<ExtArgs> | null
    /**
     * Filter, which playlist_track to fetch.
     */
    where: playlist_trackWhereUniqueInput
  }

  /**
   * playlist_track findUniqueOrThrow
   */
  export type playlist_trackFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist_track
     */
    select?: playlist_trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist_track
     */
    omit?: playlist_trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlist_trackInclude<ExtArgs> | null
    /**
     * Filter, which playlist_track to fetch.
     */
    where: playlist_trackWhereUniqueInput
  }

  /**
   * playlist_track findFirst
   */
  export type playlist_trackFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist_track
     */
    select?: playlist_trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist_track
     */
    omit?: playlist_trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlist_trackInclude<ExtArgs> | null
    /**
     * Filter, which playlist_track to fetch.
     */
    where?: playlist_trackWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of playlist_tracks to fetch.
     */
    orderBy?: playlist_trackOrderByWithRelationInput | playlist_trackOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for playlist_tracks.
     */
    cursor?: playlist_trackWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` playlist_tracks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` playlist_tracks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of playlist_tracks.
     */
    distinct?: Playlist_trackScalarFieldEnum | Playlist_trackScalarFieldEnum[]
  }

  /**
   * playlist_track findFirstOrThrow
   */
  export type playlist_trackFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist_track
     */
    select?: playlist_trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist_track
     */
    omit?: playlist_trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlist_trackInclude<ExtArgs> | null
    /**
     * Filter, which playlist_track to fetch.
     */
    where?: playlist_trackWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of playlist_tracks to fetch.
     */
    orderBy?: playlist_trackOrderByWithRelationInput | playlist_trackOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for playlist_tracks.
     */
    cursor?: playlist_trackWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` playlist_tracks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` playlist_tracks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of playlist_tracks.
     */
    distinct?: Playlist_trackScalarFieldEnum | Playlist_trackScalarFieldEnum[]
  }

  /**
   * playlist_track findMany
   */
  export type playlist_trackFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist_track
     */
    select?: playlist_trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist_track
     */
    omit?: playlist_trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlist_trackInclude<ExtArgs> | null
    /**
     * Filter, which playlist_tracks to fetch.
     */
    where?: playlist_trackWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of playlist_tracks to fetch.
     */
    orderBy?: playlist_trackOrderByWithRelationInput | playlist_trackOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing playlist_tracks.
     */
    cursor?: playlist_trackWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` playlist_tracks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` playlist_tracks.
     */
    skip?: number
    distinct?: Playlist_trackScalarFieldEnum | Playlist_trackScalarFieldEnum[]
  }

  /**
   * playlist_track create
   */
  export type playlist_trackCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist_track
     */
    select?: playlist_trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist_track
     */
    omit?: playlist_trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlist_trackInclude<ExtArgs> | null
    /**
     * The data needed to create a playlist_track.
     */
    data: XOR<playlist_trackCreateInput, playlist_trackUncheckedCreateInput>
  }

  /**
   * playlist_track createMany
   */
  export type playlist_trackCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many playlist_tracks.
     */
    data: playlist_trackCreateManyInput | playlist_trackCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * playlist_track createManyAndReturn
   */
  export type playlist_trackCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist_track
     */
    select?: playlist_trackSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the playlist_track
     */
    omit?: playlist_trackOmit<ExtArgs> | null
    /**
     * The data used to create many playlist_tracks.
     */
    data: playlist_trackCreateManyInput | playlist_trackCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlist_trackIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * playlist_track update
   */
  export type playlist_trackUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist_track
     */
    select?: playlist_trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist_track
     */
    omit?: playlist_trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlist_trackInclude<ExtArgs> | null
    /**
     * The data needed to update a playlist_track.
     */
    data: XOR<playlist_trackUpdateInput, playlist_trackUncheckedUpdateInput>
    /**
     * Choose, which playlist_track to update.
     */
    where: playlist_trackWhereUniqueInput
  }

  /**
   * playlist_track updateMany
   */
  export type playlist_trackUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update playlist_tracks.
     */
    data: XOR<playlist_trackUpdateManyMutationInput, playlist_trackUncheckedUpdateManyInput>
    /**
     * Filter which playlist_tracks to update
     */
    where?: playlist_trackWhereInput
  }

  /**
   * playlist_track updateManyAndReturn
   */
  export type playlist_trackUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist_track
     */
    select?: playlist_trackSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the playlist_track
     */
    omit?: playlist_trackOmit<ExtArgs> | null
    /**
     * The data used to update playlist_tracks.
     */
    data: XOR<playlist_trackUpdateManyMutationInput, playlist_trackUncheckedUpdateManyInput>
    /**
     * Filter which playlist_tracks to update
     */
    where?: playlist_trackWhereInput
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlist_trackIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * playlist_track upsert
   */
  export type playlist_trackUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist_track
     */
    select?: playlist_trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist_track
     */
    omit?: playlist_trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlist_trackInclude<ExtArgs> | null
    /**
     * The filter to search for the playlist_track to update in case it exists.
     */
    where: playlist_trackWhereUniqueInput
    /**
     * In case the playlist_track found by the `where` argument doesn't exist, create a new playlist_track with this data.
     */
    create: XOR<playlist_trackCreateInput, playlist_trackUncheckedCreateInput>
    /**
     * In case the playlist_track was found with the provided `where` argument, update it with this data.
     */
    update: XOR<playlist_trackUpdateInput, playlist_trackUncheckedUpdateInput>
  }

  /**
   * playlist_track delete
   */
  export type playlist_trackDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist_track
     */
    select?: playlist_trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist_track
     */
    omit?: playlist_trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlist_trackInclude<ExtArgs> | null
    /**
     * Filter which playlist_track to delete.
     */
    where: playlist_trackWhereUniqueInput
  }

  /**
   * playlist_track deleteMany
   */
  export type playlist_trackDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which playlist_tracks to delete
     */
    where?: playlist_trackWhereInput
  }

  /**
   * playlist_track without action
   */
  export type playlist_trackDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist_track
     */
    select?: playlist_trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist_track
     */
    omit?: playlist_trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlist_trackInclude<ExtArgs> | null
  }


  /**
   * Model track
   */

  export type AggregateTrack = {
    _count: TrackCountAggregateOutputType | null
    _avg: TrackAvgAggregateOutputType | null
    _sum: TrackSumAggregateOutputType | null
    _min: TrackMinAggregateOutputType | null
    _max: TrackMaxAggregateOutputType | null
  }

  export type TrackAvgAggregateOutputType = {
    album_id: number | null
    media_type_id: number | null
    genre_id: number | null
    milliseconds: number | null
    bytes: number | null
    unit_price: Decimal | null
    track_id: number | null
  }

  export type TrackSumAggregateOutputType = {
    album_id: number | null
    media_type_id: number | null
    genre_id: number | null
    milliseconds: number | null
    bytes: number | null
    unit_price: Decimal | null
    track_id: number | null
  }

  export type TrackMinAggregateOutputType = {
    name: string | null
    album_id: number | null
    media_type_id: number | null
    genre_id: number | null
    composer: string | null
    milliseconds: number | null
    bytes: number | null
    unit_price: Decimal | null
    track_id: number | null
  }

  export type TrackMaxAggregateOutputType = {
    name: string | null
    album_id: number | null
    media_type_id: number | null
    genre_id: number | null
    composer: string | null
    milliseconds: number | null
    bytes: number | null
    unit_price: Decimal | null
    track_id: number | null
  }

  export type TrackCountAggregateOutputType = {
    name: number
    album_id: number
    media_type_id: number
    genre_id: number
    composer: number
    milliseconds: number
    bytes: number
    unit_price: number
    track_id: number
    _all: number
  }


  export type TrackAvgAggregateInputType = {
    album_id?: true
    media_type_id?: true
    genre_id?: true
    milliseconds?: true
    bytes?: true
    unit_price?: true
    track_id?: true
  }

  export type TrackSumAggregateInputType = {
    album_id?: true
    media_type_id?: true
    genre_id?: true
    milliseconds?: true
    bytes?: true
    unit_price?: true
    track_id?: true
  }

  export type TrackMinAggregateInputType = {
    name?: true
    album_id?: true
    media_type_id?: true
    genre_id?: true
    composer?: true
    milliseconds?: true
    bytes?: true
    unit_price?: true
    track_id?: true
  }

  export type TrackMaxAggregateInputType = {
    name?: true
    album_id?: true
    media_type_id?: true
    genre_id?: true
    composer?: true
    milliseconds?: true
    bytes?: true
    unit_price?: true
    track_id?: true
  }

  export type TrackCountAggregateInputType = {
    name?: true
    album_id?: true
    media_type_id?: true
    genre_id?: true
    composer?: true
    milliseconds?: true
    bytes?: true
    unit_price?: true
    track_id?: true
    _all?: true
  }

  export type TrackAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which track to aggregate.
     */
    where?: trackWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of tracks to fetch.
     */
    orderBy?: trackOrderByWithRelationInput | trackOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: trackWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` tracks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` tracks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned tracks
    **/
    _count?: true | TrackCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TrackAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TrackSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TrackMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TrackMaxAggregateInputType
  }

  export type GetTrackAggregateType<T extends TrackAggregateArgs> = {
        [P in keyof T & keyof AggregateTrack]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTrack[P]>
      : GetScalarType<T[P], AggregateTrack[P]>
  }




  export type trackGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: trackWhereInput
    orderBy?: trackOrderByWithAggregationInput | trackOrderByWithAggregationInput[]
    by: TrackScalarFieldEnum[] | TrackScalarFieldEnum
    having?: trackScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TrackCountAggregateInputType | true
    _avg?: TrackAvgAggregateInputType
    _sum?: TrackSumAggregateInputType
    _min?: TrackMinAggregateInputType
    _max?: TrackMaxAggregateInputType
  }

  export type TrackGroupByOutputType = {
    name: string
    album_id: number
    media_type_id: number
    genre_id: number | null
    composer: string | null
    milliseconds: number
    bytes: number | null
    unit_price: Decimal
    track_id: number
    _count: TrackCountAggregateOutputType | null
    _avg: TrackAvgAggregateOutputType | null
    _sum: TrackSumAggregateOutputType | null
    _min: TrackMinAggregateOutputType | null
    _max: TrackMaxAggregateOutputType | null
  }

  type GetTrackGroupByPayload<T extends trackGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TrackGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TrackGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TrackGroupByOutputType[P]>
            : GetScalarType<T[P], TrackGroupByOutputType[P]>
        }
      >
    >


  export type trackSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    name?: boolean
    album_id?: boolean
    media_type_id?: boolean
    genre_id?: boolean
    composer?: boolean
    milliseconds?: boolean
    bytes?: boolean
    unit_price?: boolean
    track_id?: boolean
    invoice_line?: boolean | track$invoice_lineArgs<ExtArgs>
    playlist_track?: boolean | track$playlist_trackArgs<ExtArgs>
    album?: boolean | albumDefaultArgs<ExtArgs>
    track_discount?: boolean | track$track_discountArgs<ExtArgs>
    _count?: boolean | TrackCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["track"]>

  export type trackSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    name?: boolean
    album_id?: boolean
    media_type_id?: boolean
    genre_id?: boolean
    composer?: boolean
    milliseconds?: boolean
    bytes?: boolean
    unit_price?: boolean
    track_id?: boolean
    album?: boolean | albumDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["track"]>

  export type trackSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    name?: boolean
    album_id?: boolean
    media_type_id?: boolean
    genre_id?: boolean
    composer?: boolean
    milliseconds?: boolean
    bytes?: boolean
    unit_price?: boolean
    track_id?: boolean
    album?: boolean | albumDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["track"]>

  export type trackSelectScalar = {
    name?: boolean
    album_id?: boolean
    media_type_id?: boolean
    genre_id?: boolean
    composer?: boolean
    milliseconds?: boolean
    bytes?: boolean
    unit_price?: boolean
    track_id?: boolean
  }

  export type trackOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"name" | "album_id" | "media_type_id" | "genre_id" | "composer" | "milliseconds" | "bytes" | "unit_price" | "track_id", ExtArgs["result"]["track"]>
  export type trackInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    invoice_line?: boolean | track$invoice_lineArgs<ExtArgs>
    playlist_track?: boolean | track$playlist_trackArgs<ExtArgs>
    album?: boolean | albumDefaultArgs<ExtArgs>
    track_discount?: boolean | track$track_discountArgs<ExtArgs>
    _count?: boolean | TrackCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type trackIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    album?: boolean | albumDefaultArgs<ExtArgs>
  }
  export type trackIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    album?: boolean | albumDefaultArgs<ExtArgs>
  }

  export type $trackPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "track"
    objects: {
      invoice_line: Prisma.$invoice_linePayload<ExtArgs>[]
      playlist_track: Prisma.$playlist_trackPayload<ExtArgs>[]
      album: Prisma.$albumPayload<ExtArgs>
      track_discount: Prisma.$track_discountPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      name: string
      album_id: number
      media_type_id: number
      genre_id: number | null
      composer: string | null
      milliseconds: number
      bytes: number | null
      unit_price: Prisma.Decimal
      track_id: number
    }, ExtArgs["result"]["track"]>
    composites: {}
  }

  type trackGetPayload<S extends boolean | null | undefined | trackDefaultArgs> = $Result.GetResult<Prisma.$trackPayload, S>

  type trackCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<trackFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TrackCountAggregateInputType | true
    }

  export interface trackDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['track'], meta: { name: 'track' } }
    /**
     * Find zero or one Track that matches the filter.
     * @param {trackFindUniqueArgs} args - Arguments to find a Track
     * @example
     * // Get one Track
     * const track = await prisma.track.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends trackFindUniqueArgs>(args: SelectSubset<T, trackFindUniqueArgs<ExtArgs>>): Prisma__trackClient<$Result.GetResult<Prisma.$trackPayload<ExtArgs>, T, "findUnique", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find one Track that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {trackFindUniqueOrThrowArgs} args - Arguments to find a Track
     * @example
     * // Get one Track
     * const track = await prisma.track.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends trackFindUniqueOrThrowArgs>(args: SelectSubset<T, trackFindUniqueOrThrowArgs<ExtArgs>>): Prisma__trackClient<$Result.GetResult<Prisma.$trackPayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find the first Track that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {trackFindFirstArgs} args - Arguments to find a Track
     * @example
     * // Get one Track
     * const track = await prisma.track.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends trackFindFirstArgs>(args?: SelectSubset<T, trackFindFirstArgs<ExtArgs>>): Prisma__trackClient<$Result.GetResult<Prisma.$trackPayload<ExtArgs>, T, "findFirst", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find the first Track that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {trackFindFirstOrThrowArgs} args - Arguments to find a Track
     * @example
     * // Get one Track
     * const track = await prisma.track.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends trackFindFirstOrThrowArgs>(args?: SelectSubset<T, trackFindFirstOrThrowArgs<ExtArgs>>): Prisma__trackClient<$Result.GetResult<Prisma.$trackPayload<ExtArgs>, T, "findFirstOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find zero or more Tracks that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {trackFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Tracks
     * const tracks = await prisma.track.findMany()
     * 
     * // Get first 10 Tracks
     * const tracks = await prisma.track.findMany({ take: 10 })
     * 
     * // Only select the `name`
     * const trackWithNameOnly = await prisma.track.findMany({ select: { name: true } })
     * 
     */
    findMany<T extends trackFindManyArgs>(args?: SelectSubset<T, trackFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$trackPayload<ExtArgs>, T, "findMany", ClientOptions>>

    /**
     * Create a Track.
     * @param {trackCreateArgs} args - Arguments to create a Track.
     * @example
     * // Create one Track
     * const Track = await prisma.track.create({
     *   data: {
     *     // ... data to create a Track
     *   }
     * })
     * 
     */
    create<T extends trackCreateArgs>(args: SelectSubset<T, trackCreateArgs<ExtArgs>>): Prisma__trackClient<$Result.GetResult<Prisma.$trackPayload<ExtArgs>, T, "create", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Create many Tracks.
     * @param {trackCreateManyArgs} args - Arguments to create many Tracks.
     * @example
     * // Create many Tracks
     * const track = await prisma.track.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends trackCreateManyArgs>(args?: SelectSubset<T, trackCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Tracks and returns the data saved in the database.
     * @param {trackCreateManyAndReturnArgs} args - Arguments to create many Tracks.
     * @example
     * // Create many Tracks
     * const track = await prisma.track.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Tracks and only return the `name`
     * const trackWithNameOnly = await prisma.track.createManyAndReturn({
     *   select: { name: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends trackCreateManyAndReturnArgs>(args?: SelectSubset<T, trackCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$trackPayload<ExtArgs>, T, "createManyAndReturn", ClientOptions>>

    /**
     * Delete a Track.
     * @param {trackDeleteArgs} args - Arguments to delete one Track.
     * @example
     * // Delete one Track
     * const Track = await prisma.track.delete({
     *   where: {
     *     // ... filter to delete one Track
     *   }
     * })
     * 
     */
    delete<T extends trackDeleteArgs>(args: SelectSubset<T, trackDeleteArgs<ExtArgs>>): Prisma__trackClient<$Result.GetResult<Prisma.$trackPayload<ExtArgs>, T, "delete", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Update one Track.
     * @param {trackUpdateArgs} args - Arguments to update one Track.
     * @example
     * // Update one Track
     * const track = await prisma.track.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends trackUpdateArgs>(args: SelectSubset<T, trackUpdateArgs<ExtArgs>>): Prisma__trackClient<$Result.GetResult<Prisma.$trackPayload<ExtArgs>, T, "update", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Delete zero or more Tracks.
     * @param {trackDeleteManyArgs} args - Arguments to filter Tracks to delete.
     * @example
     * // Delete a few Tracks
     * const { count } = await prisma.track.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends trackDeleteManyArgs>(args?: SelectSubset<T, trackDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Tracks.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {trackUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Tracks
     * const track = await prisma.track.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends trackUpdateManyArgs>(args: SelectSubset<T, trackUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Tracks and returns the data updated in the database.
     * @param {trackUpdateManyAndReturnArgs} args - Arguments to update many Tracks.
     * @example
     * // Update many Tracks
     * const track = await prisma.track.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Tracks and only return the `name`
     * const trackWithNameOnly = await prisma.track.updateManyAndReturn({
     *   select: { name: true },
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
    updateManyAndReturn<T extends trackUpdateManyAndReturnArgs>(args: SelectSubset<T, trackUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$trackPayload<ExtArgs>, T, "updateManyAndReturn", ClientOptions>>

    /**
     * Create or update one Track.
     * @param {trackUpsertArgs} args - Arguments to update or create a Track.
     * @example
     * // Update or create a Track
     * const track = await prisma.track.upsert({
     *   create: {
     *     // ... data to create a Track
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Track we want to update
     *   }
     * })
     */
    upsert<T extends trackUpsertArgs>(args: SelectSubset<T, trackUpsertArgs<ExtArgs>>): Prisma__trackClient<$Result.GetResult<Prisma.$trackPayload<ExtArgs>, T, "upsert", ClientOptions>, never, ExtArgs, ClientOptions>


    /**
     * Count the number of Tracks.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {trackCountArgs} args - Arguments to filter Tracks to count.
     * @example
     * // Count the number of Tracks
     * const count = await prisma.track.count({
     *   where: {
     *     // ... the filter for the Tracks we want to count
     *   }
     * })
    **/
    count<T extends trackCountArgs>(
      args?: Subset<T, trackCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TrackCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Track.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TrackAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends TrackAggregateArgs>(args: Subset<T, TrackAggregateArgs>): Prisma.PrismaPromise<GetTrackAggregateType<T>>

    /**
     * Group by Track.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {trackGroupByArgs} args - Group by arguments.
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
      T extends trackGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: trackGroupByArgs['orderBy'] }
        : { orderBy?: trackGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, trackGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTrackGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the track model
   */
  readonly fields: trackFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for track.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__trackClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    invoice_line<T extends track$invoice_lineArgs<ExtArgs> = {}>(args?: Subset<T, track$invoice_lineArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$invoice_linePayload<ExtArgs>, T, "findMany", ClientOptions> | Null>
    playlist_track<T extends track$playlist_trackArgs<ExtArgs> = {}>(args?: Subset<T, track$playlist_trackArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$playlist_trackPayload<ExtArgs>, T, "findMany", ClientOptions> | Null>
    album<T extends albumDefaultArgs<ExtArgs> = {}>(args?: Subset<T, albumDefaultArgs<ExtArgs>>): Prisma__albumClient<$Result.GetResult<Prisma.$albumPayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions> | Null, Null, ExtArgs, ClientOptions>
    track_discount<T extends track$track_discountArgs<ExtArgs> = {}>(args?: Subset<T, track$track_discountArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$track_discountPayload<ExtArgs>, T, "findMany", ClientOptions> | Null>
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
   * Fields of the track model
   */ 
  interface trackFieldRefs {
    readonly name: FieldRef<"track", 'String'>
    readonly album_id: FieldRef<"track", 'Int'>
    readonly media_type_id: FieldRef<"track", 'Int'>
    readonly genre_id: FieldRef<"track", 'Int'>
    readonly composer: FieldRef<"track", 'String'>
    readonly milliseconds: FieldRef<"track", 'Int'>
    readonly bytes: FieldRef<"track", 'Int'>
    readonly unit_price: FieldRef<"track", 'Decimal'>
    readonly track_id: FieldRef<"track", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * track findUnique
   */
  export type trackFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track
     */
    select?: trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track
     */
    omit?: trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: trackInclude<ExtArgs> | null
    /**
     * Filter, which track to fetch.
     */
    where: trackWhereUniqueInput
  }

  /**
   * track findUniqueOrThrow
   */
  export type trackFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track
     */
    select?: trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track
     */
    omit?: trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: trackInclude<ExtArgs> | null
    /**
     * Filter, which track to fetch.
     */
    where: trackWhereUniqueInput
  }

  /**
   * track findFirst
   */
  export type trackFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track
     */
    select?: trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track
     */
    omit?: trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: trackInclude<ExtArgs> | null
    /**
     * Filter, which track to fetch.
     */
    where?: trackWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of tracks to fetch.
     */
    orderBy?: trackOrderByWithRelationInput | trackOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for tracks.
     */
    cursor?: trackWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` tracks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` tracks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of tracks.
     */
    distinct?: TrackScalarFieldEnum | TrackScalarFieldEnum[]
  }

  /**
   * track findFirstOrThrow
   */
  export type trackFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track
     */
    select?: trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track
     */
    omit?: trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: trackInclude<ExtArgs> | null
    /**
     * Filter, which track to fetch.
     */
    where?: trackWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of tracks to fetch.
     */
    orderBy?: trackOrderByWithRelationInput | trackOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for tracks.
     */
    cursor?: trackWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` tracks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` tracks.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of tracks.
     */
    distinct?: TrackScalarFieldEnum | TrackScalarFieldEnum[]
  }

  /**
   * track findMany
   */
  export type trackFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track
     */
    select?: trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track
     */
    omit?: trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: trackInclude<ExtArgs> | null
    /**
     * Filter, which tracks to fetch.
     */
    where?: trackWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of tracks to fetch.
     */
    orderBy?: trackOrderByWithRelationInput | trackOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing tracks.
     */
    cursor?: trackWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` tracks from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` tracks.
     */
    skip?: number
    distinct?: TrackScalarFieldEnum | TrackScalarFieldEnum[]
  }

  /**
   * track create
   */
  export type trackCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track
     */
    select?: trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track
     */
    omit?: trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: trackInclude<ExtArgs> | null
    /**
     * The data needed to create a track.
     */
    data: XOR<trackCreateInput, trackUncheckedCreateInput>
  }

  /**
   * track createMany
   */
  export type trackCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many tracks.
     */
    data: trackCreateManyInput | trackCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * track createManyAndReturn
   */
  export type trackCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track
     */
    select?: trackSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the track
     */
    omit?: trackOmit<ExtArgs> | null
    /**
     * The data used to create many tracks.
     */
    data: trackCreateManyInput | trackCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: trackIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * track update
   */
  export type trackUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track
     */
    select?: trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track
     */
    omit?: trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: trackInclude<ExtArgs> | null
    /**
     * The data needed to update a track.
     */
    data: XOR<trackUpdateInput, trackUncheckedUpdateInput>
    /**
     * Choose, which track to update.
     */
    where: trackWhereUniqueInput
  }

  /**
   * track updateMany
   */
  export type trackUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update tracks.
     */
    data: XOR<trackUpdateManyMutationInput, trackUncheckedUpdateManyInput>
    /**
     * Filter which tracks to update
     */
    where?: trackWhereInput
  }

  /**
   * track updateManyAndReturn
   */
  export type trackUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track
     */
    select?: trackSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the track
     */
    omit?: trackOmit<ExtArgs> | null
    /**
     * The data used to update tracks.
     */
    data: XOR<trackUpdateManyMutationInput, trackUncheckedUpdateManyInput>
    /**
     * Filter which tracks to update
     */
    where?: trackWhereInput
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: trackIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * track upsert
   */
  export type trackUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track
     */
    select?: trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track
     */
    omit?: trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: trackInclude<ExtArgs> | null
    /**
     * The filter to search for the track to update in case it exists.
     */
    where: trackWhereUniqueInput
    /**
     * In case the track found by the `where` argument doesn't exist, create a new track with this data.
     */
    create: XOR<trackCreateInput, trackUncheckedCreateInput>
    /**
     * In case the track was found with the provided `where` argument, update it with this data.
     */
    update: XOR<trackUpdateInput, trackUncheckedUpdateInput>
  }

  /**
   * track delete
   */
  export type trackDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track
     */
    select?: trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track
     */
    omit?: trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: trackInclude<ExtArgs> | null
    /**
     * Filter which track to delete.
     */
    where: trackWhereUniqueInput
  }

  /**
   * track deleteMany
   */
  export type trackDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which tracks to delete
     */
    where?: trackWhereInput
  }

  /**
   * track.invoice_line
   */
  export type track$invoice_lineArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the invoice_line
     */
    select?: invoice_lineSelect<ExtArgs> | null
    /**
     * Omit specific fields from the invoice_line
     */
    omit?: invoice_lineOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: invoice_lineInclude<ExtArgs> | null
    where?: invoice_lineWhereInput
    orderBy?: invoice_lineOrderByWithRelationInput | invoice_lineOrderByWithRelationInput[]
    cursor?: invoice_lineWhereUniqueInput
    take?: number
    skip?: number
    distinct?: Invoice_lineScalarFieldEnum | Invoice_lineScalarFieldEnum[]
  }

  /**
   * track.playlist_track
   */
  export type track$playlist_trackArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the playlist_track
     */
    select?: playlist_trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the playlist_track
     */
    omit?: playlist_trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: playlist_trackInclude<ExtArgs> | null
    where?: playlist_trackWhereInput
    orderBy?: playlist_trackOrderByWithRelationInput | playlist_trackOrderByWithRelationInput[]
    cursor?: playlist_trackWhereUniqueInput
    take?: number
    skip?: number
    distinct?: Playlist_trackScalarFieldEnum | Playlist_trackScalarFieldEnum[]
  }

  /**
   * track.track_discount
   */
  export type track$track_discountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track_discount
     */
    select?: track_discountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track_discount
     */
    omit?: track_discountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: track_discountInclude<ExtArgs> | null
    where?: track_discountWhereInput
    orderBy?: track_discountOrderByWithRelationInput | track_discountOrderByWithRelationInput[]
    cursor?: track_discountWhereUniqueInput
    take?: number
    skip?: number
    distinct?: Track_discountScalarFieldEnum | Track_discountScalarFieldEnum[]
  }

  /**
   * track without action
   */
  export type trackDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track
     */
    select?: trackSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track
     */
    omit?: trackOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: trackInclude<ExtArgs> | null
  }


  /**
   * Model track_discount
   */

  export type AggregateTrack_discount = {
    _count: Track_discountCountAggregateOutputType | null
    _avg: Track_discountAvgAggregateOutputType | null
    _sum: Track_discountSumAggregateOutputType | null
    _min: Track_discountMinAggregateOutputType | null
    _max: Track_discountMaxAggregateOutputType | null
  }

  export type Track_discountAvgAggregateOutputType = {
    track_discount_id: number | null
    track_id: number | null
    discount: Decimal | null
    employee_id: number | null
  }

  export type Track_discountSumAggregateOutputType = {
    track_discount_id: number | null
    track_id: number | null
    discount: Decimal | null
    employee_id: number | null
  }

  export type Track_discountMinAggregateOutputType = {
    track_discount_id: number | null
    track_id: number | null
    discount: Decimal | null
    offer_date: Date | null
    close_date: Date | null
    employee_id: number | null
  }

  export type Track_discountMaxAggregateOutputType = {
    track_discount_id: number | null
    track_id: number | null
    discount: Decimal | null
    offer_date: Date | null
    close_date: Date | null
    employee_id: number | null
  }

  export type Track_discountCountAggregateOutputType = {
    track_discount_id: number
    track_id: number
    discount: number
    offer_date: number
    close_date: number
    employee_id: number
    _all: number
  }


  export type Track_discountAvgAggregateInputType = {
    track_discount_id?: true
    track_id?: true
    discount?: true
    employee_id?: true
  }

  export type Track_discountSumAggregateInputType = {
    track_discount_id?: true
    track_id?: true
    discount?: true
    employee_id?: true
  }

  export type Track_discountMinAggregateInputType = {
    track_discount_id?: true
    track_id?: true
    discount?: true
    offer_date?: true
    close_date?: true
    employee_id?: true
  }

  export type Track_discountMaxAggregateInputType = {
    track_discount_id?: true
    track_id?: true
    discount?: true
    offer_date?: true
    close_date?: true
    employee_id?: true
  }

  export type Track_discountCountAggregateInputType = {
    track_discount_id?: true
    track_id?: true
    discount?: true
    offer_date?: true
    close_date?: true
    employee_id?: true
    _all?: true
  }

  export type Track_discountAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which track_discount to aggregate.
     */
    where?: track_discountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of track_discounts to fetch.
     */
    orderBy?: track_discountOrderByWithRelationInput | track_discountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: track_discountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` track_discounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` track_discounts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned track_discounts
    **/
    _count?: true | Track_discountCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: Track_discountAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: Track_discountSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: Track_discountMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: Track_discountMaxAggregateInputType
  }

  export type GetTrack_discountAggregateType<T extends Track_discountAggregateArgs> = {
        [P in keyof T & keyof AggregateTrack_discount]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTrack_discount[P]>
      : GetScalarType<T[P], AggregateTrack_discount[P]>
  }




  export type track_discountGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: track_discountWhereInput
    orderBy?: track_discountOrderByWithAggregationInput | track_discountOrderByWithAggregationInput[]
    by: Track_discountScalarFieldEnum[] | Track_discountScalarFieldEnum
    having?: track_discountScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: Track_discountCountAggregateInputType | true
    _avg?: Track_discountAvgAggregateInputType
    _sum?: Track_discountSumAggregateInputType
    _min?: Track_discountMinAggregateInputType
    _max?: Track_discountMaxAggregateInputType
  }

  export type Track_discountGroupByOutputType = {
    track_discount_id: number
    track_id: number
    discount: Decimal
    offer_date: Date
    close_date: Date
    employee_id: number
    _count: Track_discountCountAggregateOutputType | null
    _avg: Track_discountAvgAggregateOutputType | null
    _sum: Track_discountSumAggregateOutputType | null
    _min: Track_discountMinAggregateOutputType | null
    _max: Track_discountMaxAggregateOutputType | null
  }

  type GetTrack_discountGroupByPayload<T extends track_discountGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<Track_discountGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof Track_discountGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], Track_discountGroupByOutputType[P]>
            : GetScalarType<T[P], Track_discountGroupByOutputType[P]>
        }
      >
    >


  export type track_discountSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    track_discount_id?: boolean
    track_id?: boolean
    discount?: boolean
    offer_date?: boolean
    close_date?: boolean
    employee_id?: boolean
    employee?: boolean | employeeDefaultArgs<ExtArgs>
    track?: boolean | trackDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["track_discount"]>

  export type track_discountSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    track_discount_id?: boolean
    track_id?: boolean
    discount?: boolean
    offer_date?: boolean
    close_date?: boolean
    employee_id?: boolean
    employee?: boolean | employeeDefaultArgs<ExtArgs>
    track?: boolean | trackDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["track_discount"]>

  export type track_discountSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    track_discount_id?: boolean
    track_id?: boolean
    discount?: boolean
    offer_date?: boolean
    close_date?: boolean
    employee_id?: boolean
    employee?: boolean | employeeDefaultArgs<ExtArgs>
    track?: boolean | trackDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["track_discount"]>

  export type track_discountSelectScalar = {
    track_discount_id?: boolean
    track_id?: boolean
    discount?: boolean
    offer_date?: boolean
    close_date?: boolean
    employee_id?: boolean
  }

  export type track_discountOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"track_discount_id" | "track_id" | "discount" | "offer_date" | "close_date" | "employee_id", ExtArgs["result"]["track_discount"]>
  export type track_discountInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    employee?: boolean | employeeDefaultArgs<ExtArgs>
    track?: boolean | trackDefaultArgs<ExtArgs>
  }
  export type track_discountIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    employee?: boolean | employeeDefaultArgs<ExtArgs>
    track?: boolean | trackDefaultArgs<ExtArgs>
  }
  export type track_discountIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    employee?: boolean | employeeDefaultArgs<ExtArgs>
    track?: boolean | trackDefaultArgs<ExtArgs>
  }

  export type $track_discountPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "track_discount"
    objects: {
      employee: Prisma.$employeePayload<ExtArgs>
      track: Prisma.$trackPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      track_discount_id: number
      track_id: number
      discount: Prisma.Decimal
      offer_date: Date
      close_date: Date
      employee_id: number
    }, ExtArgs["result"]["track_discount"]>
    composites: {}
  }

  type track_discountGetPayload<S extends boolean | null | undefined | track_discountDefaultArgs> = $Result.GetResult<Prisma.$track_discountPayload, S>

  type track_discountCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<track_discountFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: Track_discountCountAggregateInputType | true
    }

  export interface track_discountDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['track_discount'], meta: { name: 'track_discount' } }
    /**
     * Find zero or one Track_discount that matches the filter.
     * @param {track_discountFindUniqueArgs} args - Arguments to find a Track_discount
     * @example
     * // Get one Track_discount
     * const track_discount = await prisma.track_discount.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends track_discountFindUniqueArgs>(args: SelectSubset<T, track_discountFindUniqueArgs<ExtArgs>>): Prisma__track_discountClient<$Result.GetResult<Prisma.$track_discountPayload<ExtArgs>, T, "findUnique", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find one Track_discount that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {track_discountFindUniqueOrThrowArgs} args - Arguments to find a Track_discount
     * @example
     * // Get one Track_discount
     * const track_discount = await prisma.track_discount.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends track_discountFindUniqueOrThrowArgs>(args: SelectSubset<T, track_discountFindUniqueOrThrowArgs<ExtArgs>>): Prisma__track_discountClient<$Result.GetResult<Prisma.$track_discountPayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find the first Track_discount that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {track_discountFindFirstArgs} args - Arguments to find a Track_discount
     * @example
     * // Get one Track_discount
     * const track_discount = await prisma.track_discount.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends track_discountFindFirstArgs>(args?: SelectSubset<T, track_discountFindFirstArgs<ExtArgs>>): Prisma__track_discountClient<$Result.GetResult<Prisma.$track_discountPayload<ExtArgs>, T, "findFirst", ClientOptions> | null, null, ExtArgs, ClientOptions>

    /**
     * Find the first Track_discount that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {track_discountFindFirstOrThrowArgs} args - Arguments to find a Track_discount
     * @example
     * // Get one Track_discount
     * const track_discount = await prisma.track_discount.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends track_discountFindFirstOrThrowArgs>(args?: SelectSubset<T, track_discountFindFirstOrThrowArgs<ExtArgs>>): Prisma__track_discountClient<$Result.GetResult<Prisma.$track_discountPayload<ExtArgs>, T, "findFirstOrThrow", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Find zero or more Track_discounts that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {track_discountFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Track_discounts
     * const track_discounts = await prisma.track_discount.findMany()
     * 
     * // Get first 10 Track_discounts
     * const track_discounts = await prisma.track_discount.findMany({ take: 10 })
     * 
     * // Only select the `track_discount_id`
     * const track_discountWithTrack_discount_idOnly = await prisma.track_discount.findMany({ select: { track_discount_id: true } })
     * 
     */
    findMany<T extends track_discountFindManyArgs>(args?: SelectSubset<T, track_discountFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$track_discountPayload<ExtArgs>, T, "findMany", ClientOptions>>

    /**
     * Create a Track_discount.
     * @param {track_discountCreateArgs} args - Arguments to create a Track_discount.
     * @example
     * // Create one Track_discount
     * const Track_discount = await prisma.track_discount.create({
     *   data: {
     *     // ... data to create a Track_discount
     *   }
     * })
     * 
     */
    create<T extends track_discountCreateArgs>(args: SelectSubset<T, track_discountCreateArgs<ExtArgs>>): Prisma__track_discountClient<$Result.GetResult<Prisma.$track_discountPayload<ExtArgs>, T, "create", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Create many Track_discounts.
     * @param {track_discountCreateManyArgs} args - Arguments to create many Track_discounts.
     * @example
     * // Create many Track_discounts
     * const track_discount = await prisma.track_discount.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends track_discountCreateManyArgs>(args?: SelectSubset<T, track_discountCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Track_discounts and returns the data saved in the database.
     * @param {track_discountCreateManyAndReturnArgs} args - Arguments to create many Track_discounts.
     * @example
     * // Create many Track_discounts
     * const track_discount = await prisma.track_discount.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Track_discounts and only return the `track_discount_id`
     * const track_discountWithTrack_discount_idOnly = await prisma.track_discount.createManyAndReturn({
     *   select: { track_discount_id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends track_discountCreateManyAndReturnArgs>(args?: SelectSubset<T, track_discountCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$track_discountPayload<ExtArgs>, T, "createManyAndReturn", ClientOptions>>

    /**
     * Delete a Track_discount.
     * @param {track_discountDeleteArgs} args - Arguments to delete one Track_discount.
     * @example
     * // Delete one Track_discount
     * const Track_discount = await prisma.track_discount.delete({
     *   where: {
     *     // ... filter to delete one Track_discount
     *   }
     * })
     * 
     */
    delete<T extends track_discountDeleteArgs>(args: SelectSubset<T, track_discountDeleteArgs<ExtArgs>>): Prisma__track_discountClient<$Result.GetResult<Prisma.$track_discountPayload<ExtArgs>, T, "delete", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Update one Track_discount.
     * @param {track_discountUpdateArgs} args - Arguments to update one Track_discount.
     * @example
     * // Update one Track_discount
     * const track_discount = await prisma.track_discount.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends track_discountUpdateArgs>(args: SelectSubset<T, track_discountUpdateArgs<ExtArgs>>): Prisma__track_discountClient<$Result.GetResult<Prisma.$track_discountPayload<ExtArgs>, T, "update", ClientOptions>, never, ExtArgs, ClientOptions>

    /**
     * Delete zero or more Track_discounts.
     * @param {track_discountDeleteManyArgs} args - Arguments to filter Track_discounts to delete.
     * @example
     * // Delete a few Track_discounts
     * const { count } = await prisma.track_discount.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends track_discountDeleteManyArgs>(args?: SelectSubset<T, track_discountDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Track_discounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {track_discountUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Track_discounts
     * const track_discount = await prisma.track_discount.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends track_discountUpdateManyArgs>(args: SelectSubset<T, track_discountUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Track_discounts and returns the data updated in the database.
     * @param {track_discountUpdateManyAndReturnArgs} args - Arguments to update many Track_discounts.
     * @example
     * // Update many Track_discounts
     * const track_discount = await prisma.track_discount.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Track_discounts and only return the `track_discount_id`
     * const track_discountWithTrack_discount_idOnly = await prisma.track_discount.updateManyAndReturn({
     *   select: { track_discount_id: true },
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
    updateManyAndReturn<T extends track_discountUpdateManyAndReturnArgs>(args: SelectSubset<T, track_discountUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$track_discountPayload<ExtArgs>, T, "updateManyAndReturn", ClientOptions>>

    /**
     * Create or update one Track_discount.
     * @param {track_discountUpsertArgs} args - Arguments to update or create a Track_discount.
     * @example
     * // Update or create a Track_discount
     * const track_discount = await prisma.track_discount.upsert({
     *   create: {
     *     // ... data to create a Track_discount
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Track_discount we want to update
     *   }
     * })
     */
    upsert<T extends track_discountUpsertArgs>(args: SelectSubset<T, track_discountUpsertArgs<ExtArgs>>): Prisma__track_discountClient<$Result.GetResult<Prisma.$track_discountPayload<ExtArgs>, T, "upsert", ClientOptions>, never, ExtArgs, ClientOptions>


    /**
     * Count the number of Track_discounts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {track_discountCountArgs} args - Arguments to filter Track_discounts to count.
     * @example
     * // Count the number of Track_discounts
     * const count = await prisma.track_discount.count({
     *   where: {
     *     // ... the filter for the Track_discounts we want to count
     *   }
     * })
    **/
    count<T extends track_discountCountArgs>(
      args?: Subset<T, track_discountCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], Track_discountCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Track_discount.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {Track_discountAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
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
    aggregate<T extends Track_discountAggregateArgs>(args: Subset<T, Track_discountAggregateArgs>): Prisma.PrismaPromise<GetTrack_discountAggregateType<T>>

    /**
     * Group by Track_discount.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {track_discountGroupByArgs} args - Group by arguments.
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
      T extends track_discountGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: track_discountGroupByArgs['orderBy'] }
        : { orderBy?: track_discountGroupByArgs['orderBy'] },
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
    >(args: SubsetIntersection<T, track_discountGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTrack_discountGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the track_discount model
   */
  readonly fields: track_discountFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for track_discount.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__track_discountClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    employee<T extends employeeDefaultArgs<ExtArgs> = {}>(args?: Subset<T, employeeDefaultArgs<ExtArgs>>): Prisma__employeeClient<$Result.GetResult<Prisma.$employeePayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions> | Null, Null, ExtArgs, ClientOptions>
    track<T extends trackDefaultArgs<ExtArgs> = {}>(args?: Subset<T, trackDefaultArgs<ExtArgs>>): Prisma__trackClient<$Result.GetResult<Prisma.$trackPayload<ExtArgs>, T, "findUniqueOrThrow", ClientOptions> | Null, Null, ExtArgs, ClientOptions>
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
   * Fields of the track_discount model
   */ 
  interface track_discountFieldRefs {
    readonly track_discount_id: FieldRef<"track_discount", 'Int'>
    readonly track_id: FieldRef<"track_discount", 'Int'>
    readonly discount: FieldRef<"track_discount", 'Decimal'>
    readonly offer_date: FieldRef<"track_discount", 'DateTime'>
    readonly close_date: FieldRef<"track_discount", 'DateTime'>
    readonly employee_id: FieldRef<"track_discount", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * track_discount findUnique
   */
  export type track_discountFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track_discount
     */
    select?: track_discountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track_discount
     */
    omit?: track_discountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: track_discountInclude<ExtArgs> | null
    /**
     * Filter, which track_discount to fetch.
     */
    where: track_discountWhereUniqueInput
  }

  /**
   * track_discount findUniqueOrThrow
   */
  export type track_discountFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track_discount
     */
    select?: track_discountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track_discount
     */
    omit?: track_discountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: track_discountInclude<ExtArgs> | null
    /**
     * Filter, which track_discount to fetch.
     */
    where: track_discountWhereUniqueInput
  }

  /**
   * track_discount findFirst
   */
  export type track_discountFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track_discount
     */
    select?: track_discountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track_discount
     */
    omit?: track_discountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: track_discountInclude<ExtArgs> | null
    /**
     * Filter, which track_discount to fetch.
     */
    where?: track_discountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of track_discounts to fetch.
     */
    orderBy?: track_discountOrderByWithRelationInput | track_discountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for track_discounts.
     */
    cursor?: track_discountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` track_discounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` track_discounts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of track_discounts.
     */
    distinct?: Track_discountScalarFieldEnum | Track_discountScalarFieldEnum[]
  }

  /**
   * track_discount findFirstOrThrow
   */
  export type track_discountFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track_discount
     */
    select?: track_discountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track_discount
     */
    omit?: track_discountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: track_discountInclude<ExtArgs> | null
    /**
     * Filter, which track_discount to fetch.
     */
    where?: track_discountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of track_discounts to fetch.
     */
    orderBy?: track_discountOrderByWithRelationInput | track_discountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for track_discounts.
     */
    cursor?: track_discountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` track_discounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` track_discounts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of track_discounts.
     */
    distinct?: Track_discountScalarFieldEnum | Track_discountScalarFieldEnum[]
  }

  /**
   * track_discount findMany
   */
  export type track_discountFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track_discount
     */
    select?: track_discountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track_discount
     */
    omit?: track_discountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: track_discountInclude<ExtArgs> | null
    /**
     * Filter, which track_discounts to fetch.
     */
    where?: track_discountWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of track_discounts to fetch.
     */
    orderBy?: track_discountOrderByWithRelationInput | track_discountOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing track_discounts.
     */
    cursor?: track_discountWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` track_discounts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` track_discounts.
     */
    skip?: number
    distinct?: Track_discountScalarFieldEnum | Track_discountScalarFieldEnum[]
  }

  /**
   * track_discount create
   */
  export type track_discountCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track_discount
     */
    select?: track_discountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track_discount
     */
    omit?: track_discountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: track_discountInclude<ExtArgs> | null
    /**
     * The data needed to create a track_discount.
     */
    data: XOR<track_discountCreateInput, track_discountUncheckedCreateInput>
  }

  /**
   * track_discount createMany
   */
  export type track_discountCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many track_discounts.
     */
    data: track_discountCreateManyInput | track_discountCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * track_discount createManyAndReturn
   */
  export type track_discountCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track_discount
     */
    select?: track_discountSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the track_discount
     */
    omit?: track_discountOmit<ExtArgs> | null
    /**
     * The data used to create many track_discounts.
     */
    data: track_discountCreateManyInput | track_discountCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: track_discountIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * track_discount update
   */
  export type track_discountUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track_discount
     */
    select?: track_discountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track_discount
     */
    omit?: track_discountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: track_discountInclude<ExtArgs> | null
    /**
     * The data needed to update a track_discount.
     */
    data: XOR<track_discountUpdateInput, track_discountUncheckedUpdateInput>
    /**
     * Choose, which track_discount to update.
     */
    where: track_discountWhereUniqueInput
  }

  /**
   * track_discount updateMany
   */
  export type track_discountUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update track_discounts.
     */
    data: XOR<track_discountUpdateManyMutationInput, track_discountUncheckedUpdateManyInput>
    /**
     * Filter which track_discounts to update
     */
    where?: track_discountWhereInput
  }

  /**
   * track_discount updateManyAndReturn
   */
  export type track_discountUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track_discount
     */
    select?: track_discountSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the track_discount
     */
    omit?: track_discountOmit<ExtArgs> | null
    /**
     * The data used to update track_discounts.
     */
    data: XOR<track_discountUpdateManyMutationInput, track_discountUncheckedUpdateManyInput>
    /**
     * Filter which track_discounts to update
     */
    where?: track_discountWhereInput
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: track_discountIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * track_discount upsert
   */
  export type track_discountUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track_discount
     */
    select?: track_discountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track_discount
     */
    omit?: track_discountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: track_discountInclude<ExtArgs> | null
    /**
     * The filter to search for the track_discount to update in case it exists.
     */
    where: track_discountWhereUniqueInput
    /**
     * In case the track_discount found by the `where` argument doesn't exist, create a new track_discount with this data.
     */
    create: XOR<track_discountCreateInput, track_discountUncheckedCreateInput>
    /**
     * In case the track_discount was found with the provided `where` argument, update it with this data.
     */
    update: XOR<track_discountUpdateInput, track_discountUncheckedUpdateInput>
  }

  /**
   * track_discount delete
   */
  export type track_discountDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track_discount
     */
    select?: track_discountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track_discount
     */
    omit?: track_discountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: track_discountInclude<ExtArgs> | null
    /**
     * Filter which track_discount to delete.
     */
    where: track_discountWhereUniqueInput
  }

  /**
   * track_discount deleteMany
   */
  export type track_discountDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which track_discounts to delete
     */
    where?: track_discountWhereInput
  }

  /**
   * track_discount without action
   */
  export type track_discountDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the track_discount
     */
    select?: track_discountSelect<ExtArgs> | null
    /**
     * Omit specific fields from the track_discount
     */
    omit?: track_discountOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: track_discountInclude<ExtArgs> | null
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


  export const AlbumScalarFieldEnum: {
    title: 'title',
    artist_id: 'artist_id',
    album_id: 'album_id'
  };

  export type AlbumScalarFieldEnum = (typeof AlbumScalarFieldEnum)[keyof typeof AlbumScalarFieldEnum]


  export const ArtistScalarFieldEnum: {
    name: 'name',
    artist_id: 'artist_id'
  };

  export type ArtistScalarFieldEnum = (typeof ArtistScalarFieldEnum)[keyof typeof ArtistScalarFieldEnum]


  export const CustomerScalarFieldEnum: {
    customer_id: 'customer_id',
    first_name: 'first_name',
    last_name: 'last_name',
    company: 'company',
    address: 'address',
    city: 'city',
    state: 'state',
    country: 'country',
    postal_code: 'postal_code',
    phone: 'phone',
    fax: 'fax',
    email: 'email',
    support_rep_id: 'support_rep_id'
  };

  export type CustomerScalarFieldEnum = (typeof CustomerScalarFieldEnum)[keyof typeof CustomerScalarFieldEnum]


  export const Customer_reviewScalarFieldEnum: {
    review_id: 'review_id',
    customer_id: 'customer_id',
    invoice_id: 'invoice_id',
    track_id: 'track_id',
    rating: 'rating',
    review_comment: 'review_comment'
  };

  export type Customer_reviewScalarFieldEnum = (typeof Customer_reviewScalarFieldEnum)[keyof typeof Customer_reviewScalarFieldEnum]


  export const EmployeeScalarFieldEnum: {
    employee_id: 'employee_id',
    last_name: 'last_name',
    first_name: 'first_name',
    title: 'title',
    reports_to: 'reports_to',
    birth_date: 'birth_date',
    hire_date: 'hire_date',
    address: 'address',
    city: 'city',
    state: 'state',
    country: 'country',
    postal_code: 'postal_code',
    phone: 'phone',
    fax: 'fax',
    email: 'email',
    termination_date: 'termination_date'
  };

  export type EmployeeScalarFieldEnum = (typeof EmployeeScalarFieldEnum)[keyof typeof EmployeeScalarFieldEnum]


  export const GenreScalarFieldEnum: {
    genre_id: 'genre_id',
    name: 'name'
  };

  export type GenreScalarFieldEnum = (typeof GenreScalarFieldEnum)[keyof typeof GenreScalarFieldEnum]


  export const InvoiceScalarFieldEnum: {
    invoice_id: 'invoice_id',
    customer_id: 'customer_id',
    invoice_date: 'invoice_date',
    billing_address: 'billing_address',
    billing_city: 'billing_city',
    billing_state: 'billing_state',
    billing_country: 'billing_country',
    billing_postal_code: 'billing_postal_code',
    total: 'total'
  };

  export type InvoiceScalarFieldEnum = (typeof InvoiceScalarFieldEnum)[keyof typeof InvoiceScalarFieldEnum]


  export const Invoice_lineScalarFieldEnum: {
    invoice_line_id: 'invoice_line_id',
    invoice_id: 'invoice_id',
    track_id: 'track_id',
    unit_price: 'unit_price',
    quantity: 'quantity'
  };

  export type Invoice_lineScalarFieldEnum = (typeof Invoice_lineScalarFieldEnum)[keyof typeof Invoice_lineScalarFieldEnum]


  export const Media_typeScalarFieldEnum: {
    media_type_id: 'media_type_id',
    name: 'name'
  };

  export type Media_typeScalarFieldEnum = (typeof Media_typeScalarFieldEnum)[keyof typeof Media_typeScalarFieldEnum]


  export const PlaylistScalarFieldEnum: {
    playlist_id: 'playlist_id',
    name: 'name'
  };

  export type PlaylistScalarFieldEnum = (typeof PlaylistScalarFieldEnum)[keyof typeof PlaylistScalarFieldEnum]


  export const Playlist_trackScalarFieldEnum: {
    playlist_id: 'playlist_id',
    track_id: 'track_id'
  };

  export type Playlist_trackScalarFieldEnum = (typeof Playlist_trackScalarFieldEnum)[keyof typeof Playlist_trackScalarFieldEnum]


  export const TrackScalarFieldEnum: {
    name: 'name',
    album_id: 'album_id',
    media_type_id: 'media_type_id',
    genre_id: 'genre_id',
    composer: 'composer',
    milliseconds: 'milliseconds',
    bytes: 'bytes',
    unit_price: 'unit_price',
    track_id: 'track_id'
  };

  export type TrackScalarFieldEnum = (typeof TrackScalarFieldEnum)[keyof typeof TrackScalarFieldEnum]


  export const Track_discountScalarFieldEnum: {
    track_discount_id: 'track_discount_id',
    track_id: 'track_id',
    discount: 'discount',
    offer_date: 'offer_date',
    close_date: 'close_date',
    employee_id: 'employee_id'
  };

  export type Track_discountScalarFieldEnum = (typeof Track_discountScalarFieldEnum)[keyof typeof Track_discountScalarFieldEnum]


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
   * Reference to a field of type 'Decimal'
   */
  export type DecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal'>
    


  /**
   * Reference to a field of type 'Decimal[]'
   */
  export type ListDecimalFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Decimal[]'>
    


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


  export type albumWhereInput = {
    AND?: albumWhereInput | albumWhereInput[]
    OR?: albumWhereInput[]
    NOT?: albumWhereInput | albumWhereInput[]
    title?: StringFilter<"album"> | string
    artist_id?: IntFilter<"album"> | number
    album_id?: IntFilter<"album"> | number
    artist?: XOR<ArtistScalarRelationFilter, artistWhereInput>
    track?: TrackListRelationFilter
  }

  export type albumOrderByWithRelationInput = {
    title?: SortOrder
    artist_id?: SortOrder
    album_id?: SortOrder
    artist?: artistOrderByWithRelationInput
    track?: trackOrderByRelationAggregateInput
  }

  export type albumWhereUniqueInput = Prisma.AtLeast<{
    title?: string
    album_id?: number
    AND?: albumWhereInput | albumWhereInput[]
    OR?: albumWhereInput[]
    NOT?: albumWhereInput | albumWhereInput[]
    artist_id?: IntFilter<"album"> | number
    artist?: XOR<ArtistScalarRelationFilter, artistWhereInput>
    track?: TrackListRelationFilter
  }, "album_id" | "title">

  export type albumOrderByWithAggregationInput = {
    title?: SortOrder
    artist_id?: SortOrder
    album_id?: SortOrder
    _count?: albumCountOrderByAggregateInput
    _avg?: albumAvgOrderByAggregateInput
    _max?: albumMaxOrderByAggregateInput
    _min?: albumMinOrderByAggregateInput
    _sum?: albumSumOrderByAggregateInput
  }

  export type albumScalarWhereWithAggregatesInput = {
    AND?: albumScalarWhereWithAggregatesInput | albumScalarWhereWithAggregatesInput[]
    OR?: albumScalarWhereWithAggregatesInput[]
    NOT?: albumScalarWhereWithAggregatesInput | albumScalarWhereWithAggregatesInput[]
    title?: StringWithAggregatesFilter<"album"> | string
    artist_id?: IntWithAggregatesFilter<"album"> | number
    album_id?: IntWithAggregatesFilter<"album"> | number
  }

  export type artistWhereInput = {
    AND?: artistWhereInput | artistWhereInput[]
    OR?: artistWhereInput[]
    NOT?: artistWhereInput | artistWhereInput[]
    name?: StringFilter<"artist"> | string
    artist_id?: IntFilter<"artist"> | number
    album?: AlbumListRelationFilter
  }

  export type artistOrderByWithRelationInput = {
    name?: SortOrder
    artist_id?: SortOrder
    album?: albumOrderByRelationAggregateInput
  }

  export type artistWhereUniqueInput = Prisma.AtLeast<{
    name?: string
    artist_id?: number
    AND?: artistWhereInput | artistWhereInput[]
    OR?: artistWhereInput[]
    NOT?: artistWhereInput | artistWhereInput[]
    album?: AlbumListRelationFilter
  }, "artist_id" | "name">

  export type artistOrderByWithAggregationInput = {
    name?: SortOrder
    artist_id?: SortOrder
    _count?: artistCountOrderByAggregateInput
    _avg?: artistAvgOrderByAggregateInput
    _max?: artistMaxOrderByAggregateInput
    _min?: artistMinOrderByAggregateInput
    _sum?: artistSumOrderByAggregateInput
  }

  export type artistScalarWhereWithAggregatesInput = {
    AND?: artistScalarWhereWithAggregatesInput | artistScalarWhereWithAggregatesInput[]
    OR?: artistScalarWhereWithAggregatesInput[]
    NOT?: artistScalarWhereWithAggregatesInput | artistScalarWhereWithAggregatesInput[]
    name?: StringWithAggregatesFilter<"artist"> | string
    artist_id?: IntWithAggregatesFilter<"artist"> | number
  }

  export type customerWhereInput = {
    AND?: customerWhereInput | customerWhereInput[]
    OR?: customerWhereInput[]
    NOT?: customerWhereInput | customerWhereInput[]
    customer_id?: IntFilter<"customer"> | number
    first_name?: StringFilter<"customer"> | string
    last_name?: StringFilter<"customer"> | string
    company?: StringNullableFilter<"customer"> | string | null
    address?: StringNullableFilter<"customer"> | string | null
    city?: StringNullableFilter<"customer"> | string | null
    state?: StringNullableFilter<"customer"> | string | null
    country?: StringNullableFilter<"customer"> | string | null
    postal_code?: StringNullableFilter<"customer"> | string | null
    phone?: StringNullableFilter<"customer"> | string | null
    fax?: StringNullableFilter<"customer"> | string | null
    email?: StringFilter<"customer"> | string
    support_rep_id?: IntNullableFilter<"customer"> | number | null
    employee?: XOR<EmployeeNullableScalarRelationFilter, employeeWhereInput> | null
    customer_review?: Customer_reviewListRelationFilter
    invoice?: InvoiceListRelationFilter
  }

  export type customerOrderByWithRelationInput = {
    customer_id?: SortOrder
    first_name?: SortOrder
    last_name?: SortOrder
    company?: SortOrderInput | SortOrder
    address?: SortOrderInput | SortOrder
    city?: SortOrderInput | SortOrder
    state?: SortOrderInput | SortOrder
    country?: SortOrderInput | SortOrder
    postal_code?: SortOrderInput | SortOrder
    phone?: SortOrderInput | SortOrder
    fax?: SortOrderInput | SortOrder
    email?: SortOrder
    support_rep_id?: SortOrderInput | SortOrder
    employee?: employeeOrderByWithRelationInput
    customer_review?: customer_reviewOrderByRelationAggregateInput
    invoice?: invoiceOrderByRelationAggregateInput
  }

  export type customerWhereUniqueInput = Prisma.AtLeast<{
    customer_id?: number
    email?: string
    first_name_last_name_email?: customerFirst_nameLast_nameEmailCompoundUniqueInput
    AND?: customerWhereInput | customerWhereInput[]
    OR?: customerWhereInput[]
    NOT?: customerWhereInput | customerWhereInput[]
    first_name?: StringFilter<"customer"> | string
    last_name?: StringFilter<"customer"> | string
    company?: StringNullableFilter<"customer"> | string | null
    address?: StringNullableFilter<"customer"> | string | null
    city?: StringNullableFilter<"customer"> | string | null
    state?: StringNullableFilter<"customer"> | string | null
    country?: StringNullableFilter<"customer"> | string | null
    postal_code?: StringNullableFilter<"customer"> | string | null
    phone?: StringNullableFilter<"customer"> | string | null
    fax?: StringNullableFilter<"customer"> | string | null
    support_rep_id?: IntNullableFilter<"customer"> | number | null
    employee?: XOR<EmployeeNullableScalarRelationFilter, employeeWhereInput> | null
    customer_review?: Customer_reviewListRelationFilter
    invoice?: InvoiceListRelationFilter
  }, "customer_id" | "email" | "first_name_last_name_email">

  export type customerOrderByWithAggregationInput = {
    customer_id?: SortOrder
    first_name?: SortOrder
    last_name?: SortOrder
    company?: SortOrderInput | SortOrder
    address?: SortOrderInput | SortOrder
    city?: SortOrderInput | SortOrder
    state?: SortOrderInput | SortOrder
    country?: SortOrderInput | SortOrder
    postal_code?: SortOrderInput | SortOrder
    phone?: SortOrderInput | SortOrder
    fax?: SortOrderInput | SortOrder
    email?: SortOrder
    support_rep_id?: SortOrderInput | SortOrder
    _count?: customerCountOrderByAggregateInput
    _avg?: customerAvgOrderByAggregateInput
    _max?: customerMaxOrderByAggregateInput
    _min?: customerMinOrderByAggregateInput
    _sum?: customerSumOrderByAggregateInput
  }

  export type customerScalarWhereWithAggregatesInput = {
    AND?: customerScalarWhereWithAggregatesInput | customerScalarWhereWithAggregatesInput[]
    OR?: customerScalarWhereWithAggregatesInput[]
    NOT?: customerScalarWhereWithAggregatesInput | customerScalarWhereWithAggregatesInput[]
    customer_id?: IntWithAggregatesFilter<"customer"> | number
    first_name?: StringWithAggregatesFilter<"customer"> | string
    last_name?: StringWithAggregatesFilter<"customer"> | string
    company?: StringNullableWithAggregatesFilter<"customer"> | string | null
    address?: StringNullableWithAggregatesFilter<"customer"> | string | null
    city?: StringNullableWithAggregatesFilter<"customer"> | string | null
    state?: StringNullableWithAggregatesFilter<"customer"> | string | null
    country?: StringNullableWithAggregatesFilter<"customer"> | string | null
    postal_code?: StringNullableWithAggregatesFilter<"customer"> | string | null
    phone?: StringNullableWithAggregatesFilter<"customer"> | string | null
    fax?: StringNullableWithAggregatesFilter<"customer"> | string | null
    email?: StringWithAggregatesFilter<"customer"> | string
    support_rep_id?: IntNullableWithAggregatesFilter<"customer"> | number | null
  }

  export type customer_reviewWhereInput = {
    AND?: customer_reviewWhereInput | customer_reviewWhereInput[]
    OR?: customer_reviewWhereInput[]
    NOT?: customer_reviewWhereInput | customer_reviewWhereInput[]
    review_id?: IntFilter<"customer_review"> | number
    customer_id?: IntFilter<"customer_review"> | number
    invoice_id?: IntFilter<"customer_review"> | number
    track_id?: IntFilter<"customer_review"> | number
    rating?: IntNullableFilter<"customer_review"> | number | null
    review_comment?: StringNullableFilter<"customer_review"> | string | null
    customer?: XOR<CustomerScalarRelationFilter, customerWhereInput>
    invoice?: XOR<InvoiceScalarRelationFilter, invoiceWhereInput>
  }

  export type customer_reviewOrderByWithRelationInput = {
    review_id?: SortOrder
    customer_id?: SortOrder
    invoice_id?: SortOrder
    track_id?: SortOrder
    rating?: SortOrderInput | SortOrder
    review_comment?: SortOrderInput | SortOrder
    customer?: customerOrderByWithRelationInput
    invoice?: invoiceOrderByWithRelationInput
  }

  export type customer_reviewWhereUniqueInput = Prisma.AtLeast<{
    review_id?: number
    AND?: customer_reviewWhereInput | customer_reviewWhereInput[]
    OR?: customer_reviewWhereInput[]
    NOT?: customer_reviewWhereInput | customer_reviewWhereInput[]
    customer_id?: IntFilter<"customer_review"> | number
    invoice_id?: IntFilter<"customer_review"> | number
    track_id?: IntFilter<"customer_review"> | number
    rating?: IntNullableFilter<"customer_review"> | number | null
    review_comment?: StringNullableFilter<"customer_review"> | string | null
    customer?: XOR<CustomerScalarRelationFilter, customerWhereInput>
    invoice?: XOR<InvoiceScalarRelationFilter, invoiceWhereInput>
  }, "review_id">

  export type customer_reviewOrderByWithAggregationInput = {
    review_id?: SortOrder
    customer_id?: SortOrder
    invoice_id?: SortOrder
    track_id?: SortOrder
    rating?: SortOrderInput | SortOrder
    review_comment?: SortOrderInput | SortOrder
    _count?: customer_reviewCountOrderByAggregateInput
    _avg?: customer_reviewAvgOrderByAggregateInput
    _max?: customer_reviewMaxOrderByAggregateInput
    _min?: customer_reviewMinOrderByAggregateInput
    _sum?: customer_reviewSumOrderByAggregateInput
  }

  export type customer_reviewScalarWhereWithAggregatesInput = {
    AND?: customer_reviewScalarWhereWithAggregatesInput | customer_reviewScalarWhereWithAggregatesInput[]
    OR?: customer_reviewScalarWhereWithAggregatesInput[]
    NOT?: customer_reviewScalarWhereWithAggregatesInput | customer_reviewScalarWhereWithAggregatesInput[]
    review_id?: IntWithAggregatesFilter<"customer_review"> | number
    customer_id?: IntWithAggregatesFilter<"customer_review"> | number
    invoice_id?: IntWithAggregatesFilter<"customer_review"> | number
    track_id?: IntWithAggregatesFilter<"customer_review"> | number
    rating?: IntNullableWithAggregatesFilter<"customer_review"> | number | null
    review_comment?: StringNullableWithAggregatesFilter<"customer_review"> | string | null
  }

  export type employeeWhereInput = {
    AND?: employeeWhereInput | employeeWhereInput[]
    OR?: employeeWhereInput[]
    NOT?: employeeWhereInput | employeeWhereInput[]
    employee_id?: IntFilter<"employee"> | number
    last_name?: StringFilter<"employee"> | string
    first_name?: StringFilter<"employee"> | string
    title?: StringNullableFilter<"employee"> | string | null
    reports_to?: IntNullableFilter<"employee"> | number | null
    birth_date?: DateTimeNullableFilter<"employee"> | Date | string | null
    hire_date?: DateTimeFilter<"employee"> | Date | string
    address?: StringNullableFilter<"employee"> | string | null
    city?: StringNullableFilter<"employee"> | string | null
    state?: StringNullableFilter<"employee"> | string | null
    country?: StringNullableFilter<"employee"> | string | null
    postal_code?: StringNullableFilter<"employee"> | string | null
    phone?: StringNullableFilter<"employee"> | string | null
    fax?: StringNullableFilter<"employee"> | string | null
    email?: StringNullableFilter<"employee"> | string | null
    termination_date?: DateTimeNullableFilter<"employee"> | Date | string | null
    customer?: CustomerListRelationFilter
    employee?: XOR<EmployeeNullableScalarRelationFilter, employeeWhereInput> | null
    other_employee?: EmployeeListRelationFilter
    track_discount?: Track_discountListRelationFilter
  }

  export type employeeOrderByWithRelationInput = {
    employee_id?: SortOrder
    last_name?: SortOrder
    first_name?: SortOrder
    title?: SortOrderInput | SortOrder
    reports_to?: SortOrderInput | SortOrder
    birth_date?: SortOrderInput | SortOrder
    hire_date?: SortOrder
    address?: SortOrderInput | SortOrder
    city?: SortOrderInput | SortOrder
    state?: SortOrderInput | SortOrder
    country?: SortOrderInput | SortOrder
    postal_code?: SortOrderInput | SortOrder
    phone?: SortOrderInput | SortOrder
    fax?: SortOrderInput | SortOrder
    email?: SortOrderInput | SortOrder
    termination_date?: SortOrderInput | SortOrder
    customer?: customerOrderByRelationAggregateInput
    employee?: employeeOrderByWithRelationInput
    other_employee?: employeeOrderByRelationAggregateInput
    track_discount?: track_discountOrderByRelationAggregateInput
  }

  export type employeeWhereUniqueInput = Prisma.AtLeast<{
    employee_id?: number
    AND?: employeeWhereInput | employeeWhereInput[]
    OR?: employeeWhereInput[]
    NOT?: employeeWhereInput | employeeWhereInput[]
    last_name?: StringFilter<"employee"> | string
    first_name?: StringFilter<"employee"> | string
    title?: StringNullableFilter<"employee"> | string | null
    reports_to?: IntNullableFilter<"employee"> | number | null
    birth_date?: DateTimeNullableFilter<"employee"> | Date | string | null
    hire_date?: DateTimeFilter<"employee"> | Date | string
    address?: StringNullableFilter<"employee"> | string | null
    city?: StringNullableFilter<"employee"> | string | null
    state?: StringNullableFilter<"employee"> | string | null
    country?: StringNullableFilter<"employee"> | string | null
    postal_code?: StringNullableFilter<"employee"> | string | null
    phone?: StringNullableFilter<"employee"> | string | null
    fax?: StringNullableFilter<"employee"> | string | null
    email?: StringNullableFilter<"employee"> | string | null
    termination_date?: DateTimeNullableFilter<"employee"> | Date | string | null
    customer?: CustomerListRelationFilter
    employee?: XOR<EmployeeNullableScalarRelationFilter, employeeWhereInput> | null
    other_employee?: EmployeeListRelationFilter
    track_discount?: Track_discountListRelationFilter
  }, "employee_id">

  export type employeeOrderByWithAggregationInput = {
    employee_id?: SortOrder
    last_name?: SortOrder
    first_name?: SortOrder
    title?: SortOrderInput | SortOrder
    reports_to?: SortOrderInput | SortOrder
    birth_date?: SortOrderInput | SortOrder
    hire_date?: SortOrder
    address?: SortOrderInput | SortOrder
    city?: SortOrderInput | SortOrder
    state?: SortOrderInput | SortOrder
    country?: SortOrderInput | SortOrder
    postal_code?: SortOrderInput | SortOrder
    phone?: SortOrderInput | SortOrder
    fax?: SortOrderInput | SortOrder
    email?: SortOrderInput | SortOrder
    termination_date?: SortOrderInput | SortOrder
    _count?: employeeCountOrderByAggregateInput
    _avg?: employeeAvgOrderByAggregateInput
    _max?: employeeMaxOrderByAggregateInput
    _min?: employeeMinOrderByAggregateInput
    _sum?: employeeSumOrderByAggregateInput
  }

  export type employeeScalarWhereWithAggregatesInput = {
    AND?: employeeScalarWhereWithAggregatesInput | employeeScalarWhereWithAggregatesInput[]
    OR?: employeeScalarWhereWithAggregatesInput[]
    NOT?: employeeScalarWhereWithAggregatesInput | employeeScalarWhereWithAggregatesInput[]
    employee_id?: IntWithAggregatesFilter<"employee"> | number
    last_name?: StringWithAggregatesFilter<"employee"> | string
    first_name?: StringWithAggregatesFilter<"employee"> | string
    title?: StringNullableWithAggregatesFilter<"employee"> | string | null
    reports_to?: IntNullableWithAggregatesFilter<"employee"> | number | null
    birth_date?: DateTimeNullableWithAggregatesFilter<"employee"> | Date | string | null
    hire_date?: DateTimeWithAggregatesFilter<"employee"> | Date | string
    address?: StringNullableWithAggregatesFilter<"employee"> | string | null
    city?: StringNullableWithAggregatesFilter<"employee"> | string | null
    state?: StringNullableWithAggregatesFilter<"employee"> | string | null
    country?: StringNullableWithAggregatesFilter<"employee"> | string | null
    postal_code?: StringNullableWithAggregatesFilter<"employee"> | string | null
    phone?: StringNullableWithAggregatesFilter<"employee"> | string | null
    fax?: StringNullableWithAggregatesFilter<"employee"> | string | null
    email?: StringNullableWithAggregatesFilter<"employee"> | string | null
    termination_date?: DateTimeNullableWithAggregatesFilter<"employee"> | Date | string | null
  }

  export type genreWhereInput = {
    AND?: genreWhereInput | genreWhereInput[]
    OR?: genreWhereInput[]
    NOT?: genreWhereInput | genreWhereInput[]
    genre_id?: IntFilter<"genre"> | number
    name?: StringNullableFilter<"genre"> | string | null
  }

  export type genreOrderByWithRelationInput = {
    genre_id?: SortOrder
    name?: SortOrderInput | SortOrder
  }

  export type genreWhereUniqueInput = Prisma.AtLeast<{
    genre_id?: number
    AND?: genreWhereInput | genreWhereInput[]
    OR?: genreWhereInput[]
    NOT?: genreWhereInput | genreWhereInput[]
    name?: StringNullableFilter<"genre"> | string | null
  }, "genre_id">

  export type genreOrderByWithAggregationInput = {
    genre_id?: SortOrder
    name?: SortOrderInput | SortOrder
    _count?: genreCountOrderByAggregateInput
    _avg?: genreAvgOrderByAggregateInput
    _max?: genreMaxOrderByAggregateInput
    _min?: genreMinOrderByAggregateInput
    _sum?: genreSumOrderByAggregateInput
  }

  export type genreScalarWhereWithAggregatesInput = {
    AND?: genreScalarWhereWithAggregatesInput | genreScalarWhereWithAggregatesInput[]
    OR?: genreScalarWhereWithAggregatesInput[]
    NOT?: genreScalarWhereWithAggregatesInput | genreScalarWhereWithAggregatesInput[]
    genre_id?: IntWithAggregatesFilter<"genre"> | number
    name?: StringNullableWithAggregatesFilter<"genre"> | string | null
  }

  export type invoiceWhereInput = {
    AND?: invoiceWhereInput | invoiceWhereInput[]
    OR?: invoiceWhereInput[]
    NOT?: invoiceWhereInput | invoiceWhereInput[]
    invoice_id?: IntFilter<"invoice"> | number
    customer_id?: IntFilter<"invoice"> | number
    invoice_date?: DateTimeFilter<"invoice"> | Date | string
    billing_address?: StringNullableFilter<"invoice"> | string | null
    billing_city?: StringNullableFilter<"invoice"> | string | null
    billing_state?: StringNullableFilter<"invoice"> | string | null
    billing_country?: StringNullableFilter<"invoice"> | string | null
    billing_postal_code?: StringNullableFilter<"invoice"> | string | null
    total?: DecimalFilter<"invoice"> | Decimal | DecimalJsLike | number | string
    customer_review?: Customer_reviewListRelationFilter
    customer?: XOR<CustomerScalarRelationFilter, customerWhereInput>
    invoice_line?: Invoice_lineListRelationFilter
  }

  export type invoiceOrderByWithRelationInput = {
    invoice_id?: SortOrder
    customer_id?: SortOrder
    invoice_date?: SortOrder
    billing_address?: SortOrderInput | SortOrder
    billing_city?: SortOrderInput | SortOrder
    billing_state?: SortOrderInput | SortOrder
    billing_country?: SortOrderInput | SortOrder
    billing_postal_code?: SortOrderInput | SortOrder
    total?: SortOrder
    customer_review?: customer_reviewOrderByRelationAggregateInput
    customer?: customerOrderByWithRelationInput
    invoice_line?: invoice_lineOrderByRelationAggregateInput
  }

  export type invoiceWhereUniqueInput = Prisma.AtLeast<{
    invoice_id?: number
    customer_id_invoice_date?: invoiceCustomer_idInvoice_dateCompoundUniqueInput
    AND?: invoiceWhereInput | invoiceWhereInput[]
    OR?: invoiceWhereInput[]
    NOT?: invoiceWhereInput | invoiceWhereInput[]
    customer_id?: IntFilter<"invoice"> | number
    invoice_date?: DateTimeFilter<"invoice"> | Date | string
    billing_address?: StringNullableFilter<"invoice"> | string | null
    billing_city?: StringNullableFilter<"invoice"> | string | null
    billing_state?: StringNullableFilter<"invoice"> | string | null
    billing_country?: StringNullableFilter<"invoice"> | string | null
    billing_postal_code?: StringNullableFilter<"invoice"> | string | null
    total?: DecimalFilter<"invoice"> | Decimal | DecimalJsLike | number | string
    customer_review?: Customer_reviewListRelationFilter
    customer?: XOR<CustomerScalarRelationFilter, customerWhereInput>
    invoice_line?: Invoice_lineListRelationFilter
  }, "invoice_id" | "customer_id_invoice_date">

  export type invoiceOrderByWithAggregationInput = {
    invoice_id?: SortOrder
    customer_id?: SortOrder
    invoice_date?: SortOrder
    billing_address?: SortOrderInput | SortOrder
    billing_city?: SortOrderInput | SortOrder
    billing_state?: SortOrderInput | SortOrder
    billing_country?: SortOrderInput | SortOrder
    billing_postal_code?: SortOrderInput | SortOrder
    total?: SortOrder
    _count?: invoiceCountOrderByAggregateInput
    _avg?: invoiceAvgOrderByAggregateInput
    _max?: invoiceMaxOrderByAggregateInput
    _min?: invoiceMinOrderByAggregateInput
    _sum?: invoiceSumOrderByAggregateInput
  }

  export type invoiceScalarWhereWithAggregatesInput = {
    AND?: invoiceScalarWhereWithAggregatesInput | invoiceScalarWhereWithAggregatesInput[]
    OR?: invoiceScalarWhereWithAggregatesInput[]
    NOT?: invoiceScalarWhereWithAggregatesInput | invoiceScalarWhereWithAggregatesInput[]
    invoice_id?: IntWithAggregatesFilter<"invoice"> | number
    customer_id?: IntWithAggregatesFilter<"invoice"> | number
    invoice_date?: DateTimeWithAggregatesFilter<"invoice"> | Date | string
    billing_address?: StringNullableWithAggregatesFilter<"invoice"> | string | null
    billing_city?: StringNullableWithAggregatesFilter<"invoice"> | string | null
    billing_state?: StringNullableWithAggregatesFilter<"invoice"> | string | null
    billing_country?: StringNullableWithAggregatesFilter<"invoice"> | string | null
    billing_postal_code?: StringNullableWithAggregatesFilter<"invoice"> | string | null
    total?: DecimalWithAggregatesFilter<"invoice"> | Decimal | DecimalJsLike | number | string
  }

  export type invoice_lineWhereInput = {
    AND?: invoice_lineWhereInput | invoice_lineWhereInput[]
    OR?: invoice_lineWhereInput[]
    NOT?: invoice_lineWhereInput | invoice_lineWhereInput[]
    invoice_line_id?: IntFilter<"invoice_line"> | number
    invoice_id?: IntFilter<"invoice_line"> | number
    track_id?: IntFilter<"invoice_line"> | number
    unit_price?: DecimalFilter<"invoice_line"> | Decimal | DecimalJsLike | number | string
    quantity?: IntFilter<"invoice_line"> | number
    invoice?: XOR<InvoiceScalarRelationFilter, invoiceWhereInput>
    track?: XOR<TrackScalarRelationFilter, trackWhereInput>
  }

  export type invoice_lineOrderByWithRelationInput = {
    invoice_line_id?: SortOrder
    invoice_id?: SortOrder
    track_id?: SortOrder
    unit_price?: SortOrder
    quantity?: SortOrder
    invoice?: invoiceOrderByWithRelationInput
    track?: trackOrderByWithRelationInput
  }

  export type invoice_lineWhereUniqueInput = Prisma.AtLeast<{
    invoice_line_id?: number
    AND?: invoice_lineWhereInput | invoice_lineWhereInput[]
    OR?: invoice_lineWhereInput[]
    NOT?: invoice_lineWhereInput | invoice_lineWhereInput[]
    invoice_id?: IntFilter<"invoice_line"> | number
    track_id?: IntFilter<"invoice_line"> | number
    unit_price?: DecimalFilter<"invoice_line"> | Decimal | DecimalJsLike | number | string
    quantity?: IntFilter<"invoice_line"> | number
    invoice?: XOR<InvoiceScalarRelationFilter, invoiceWhereInput>
    track?: XOR<TrackScalarRelationFilter, trackWhereInput>
  }, "invoice_line_id">

  export type invoice_lineOrderByWithAggregationInput = {
    invoice_line_id?: SortOrder
    invoice_id?: SortOrder
    track_id?: SortOrder
    unit_price?: SortOrder
    quantity?: SortOrder
    _count?: invoice_lineCountOrderByAggregateInput
    _avg?: invoice_lineAvgOrderByAggregateInput
    _max?: invoice_lineMaxOrderByAggregateInput
    _min?: invoice_lineMinOrderByAggregateInput
    _sum?: invoice_lineSumOrderByAggregateInput
  }

  export type invoice_lineScalarWhereWithAggregatesInput = {
    AND?: invoice_lineScalarWhereWithAggregatesInput | invoice_lineScalarWhereWithAggregatesInput[]
    OR?: invoice_lineScalarWhereWithAggregatesInput[]
    NOT?: invoice_lineScalarWhereWithAggregatesInput | invoice_lineScalarWhereWithAggregatesInput[]
    invoice_line_id?: IntWithAggregatesFilter<"invoice_line"> | number
    invoice_id?: IntWithAggregatesFilter<"invoice_line"> | number
    track_id?: IntWithAggregatesFilter<"invoice_line"> | number
    unit_price?: DecimalWithAggregatesFilter<"invoice_line"> | Decimal | DecimalJsLike | number | string
    quantity?: IntWithAggregatesFilter<"invoice_line"> | number
  }

  export type media_typeWhereInput = {
    AND?: media_typeWhereInput | media_typeWhereInput[]
    OR?: media_typeWhereInput[]
    NOT?: media_typeWhereInput | media_typeWhereInput[]
    media_type_id?: IntFilter<"media_type"> | number
    name?: StringNullableFilter<"media_type"> | string | null
  }

  export type media_typeOrderByWithRelationInput = {
    media_type_id?: SortOrder
    name?: SortOrderInput | SortOrder
  }

  export type media_typeWhereUniqueInput = Prisma.AtLeast<{
    media_type_id?: number
    AND?: media_typeWhereInput | media_typeWhereInput[]
    OR?: media_typeWhereInput[]
    NOT?: media_typeWhereInput | media_typeWhereInput[]
    name?: StringNullableFilter<"media_type"> | string | null
  }, "media_type_id">

  export type media_typeOrderByWithAggregationInput = {
    media_type_id?: SortOrder
    name?: SortOrderInput | SortOrder
    _count?: media_typeCountOrderByAggregateInput
    _avg?: media_typeAvgOrderByAggregateInput
    _max?: media_typeMaxOrderByAggregateInput
    _min?: media_typeMinOrderByAggregateInput
    _sum?: media_typeSumOrderByAggregateInput
  }

  export type media_typeScalarWhereWithAggregatesInput = {
    AND?: media_typeScalarWhereWithAggregatesInput | media_typeScalarWhereWithAggregatesInput[]
    OR?: media_typeScalarWhereWithAggregatesInput[]
    NOT?: media_typeScalarWhereWithAggregatesInput | media_typeScalarWhereWithAggregatesInput[]
    media_type_id?: IntWithAggregatesFilter<"media_type"> | number
    name?: StringNullableWithAggregatesFilter<"media_type"> | string | null
  }

  export type playlistWhereInput = {
    AND?: playlistWhereInput | playlistWhereInput[]
    OR?: playlistWhereInput[]
    NOT?: playlistWhereInput | playlistWhereInput[]
    playlist_id?: IntFilter<"playlist"> | number
    name?: StringNullableFilter<"playlist"> | string | null
    playlist_track?: Playlist_trackListRelationFilter
  }

  export type playlistOrderByWithRelationInput = {
    playlist_id?: SortOrder
    name?: SortOrderInput | SortOrder
    playlist_track?: playlist_trackOrderByRelationAggregateInput
  }

  export type playlistWhereUniqueInput = Prisma.AtLeast<{
    playlist_id?: number
    AND?: playlistWhereInput | playlistWhereInput[]
    OR?: playlistWhereInput[]
    NOT?: playlistWhereInput | playlistWhereInput[]
    name?: StringNullableFilter<"playlist"> | string | null
    playlist_track?: Playlist_trackListRelationFilter
  }, "playlist_id">

  export type playlistOrderByWithAggregationInput = {
    playlist_id?: SortOrder
    name?: SortOrderInput | SortOrder
    _count?: playlistCountOrderByAggregateInput
    _avg?: playlistAvgOrderByAggregateInput
    _max?: playlistMaxOrderByAggregateInput
    _min?: playlistMinOrderByAggregateInput
    _sum?: playlistSumOrderByAggregateInput
  }

  export type playlistScalarWhereWithAggregatesInput = {
    AND?: playlistScalarWhereWithAggregatesInput | playlistScalarWhereWithAggregatesInput[]
    OR?: playlistScalarWhereWithAggregatesInput[]
    NOT?: playlistScalarWhereWithAggregatesInput | playlistScalarWhereWithAggregatesInput[]
    playlist_id?: IntWithAggregatesFilter<"playlist"> | number
    name?: StringNullableWithAggregatesFilter<"playlist"> | string | null
  }

  export type playlist_trackWhereInput = {
    AND?: playlist_trackWhereInput | playlist_trackWhereInput[]
    OR?: playlist_trackWhereInput[]
    NOT?: playlist_trackWhereInput | playlist_trackWhereInput[]
    playlist_id?: IntFilter<"playlist_track"> | number
    track_id?: IntFilter<"playlist_track"> | number
    playlist?: XOR<PlaylistScalarRelationFilter, playlistWhereInput>
    track?: XOR<TrackScalarRelationFilter, trackWhereInput>
  }

  export type playlist_trackOrderByWithRelationInput = {
    playlist_id?: SortOrder
    track_id?: SortOrder
    playlist?: playlistOrderByWithRelationInput
    track?: trackOrderByWithRelationInput
  }

  export type playlist_trackWhereUniqueInput = Prisma.AtLeast<{
    playlist_id_track_id?: playlist_trackPlaylist_idTrack_idCompoundUniqueInput
    AND?: playlist_trackWhereInput | playlist_trackWhereInput[]
    OR?: playlist_trackWhereInput[]
    NOT?: playlist_trackWhereInput | playlist_trackWhereInput[]
    playlist_id?: IntFilter<"playlist_track"> | number
    track_id?: IntFilter<"playlist_track"> | number
    playlist?: XOR<PlaylistScalarRelationFilter, playlistWhereInput>
    track?: XOR<TrackScalarRelationFilter, trackWhereInput>
  }, "playlist_id_track_id">

  export type playlist_trackOrderByWithAggregationInput = {
    playlist_id?: SortOrder
    track_id?: SortOrder
    _count?: playlist_trackCountOrderByAggregateInput
    _avg?: playlist_trackAvgOrderByAggregateInput
    _max?: playlist_trackMaxOrderByAggregateInput
    _min?: playlist_trackMinOrderByAggregateInput
    _sum?: playlist_trackSumOrderByAggregateInput
  }

  export type playlist_trackScalarWhereWithAggregatesInput = {
    AND?: playlist_trackScalarWhereWithAggregatesInput | playlist_trackScalarWhereWithAggregatesInput[]
    OR?: playlist_trackScalarWhereWithAggregatesInput[]
    NOT?: playlist_trackScalarWhereWithAggregatesInput | playlist_trackScalarWhereWithAggregatesInput[]
    playlist_id?: IntWithAggregatesFilter<"playlist_track"> | number
    track_id?: IntWithAggregatesFilter<"playlist_track"> | number
  }

  export type trackWhereInput = {
    AND?: trackWhereInput | trackWhereInput[]
    OR?: trackWhereInput[]
    NOT?: trackWhereInput | trackWhereInput[]
    name?: StringFilter<"track"> | string
    album_id?: IntFilter<"track"> | number
    media_type_id?: IntFilter<"track"> | number
    genre_id?: IntNullableFilter<"track"> | number | null
    composer?: StringNullableFilter<"track"> | string | null
    milliseconds?: IntFilter<"track"> | number
    bytes?: IntNullableFilter<"track"> | number | null
    unit_price?: DecimalFilter<"track"> | Decimal | DecimalJsLike | number | string
    track_id?: IntFilter<"track"> | number
    invoice_line?: Invoice_lineListRelationFilter
    playlist_track?: Playlist_trackListRelationFilter
    album?: XOR<AlbumScalarRelationFilter, albumWhereInput>
    track_discount?: Track_discountListRelationFilter
  }

  export type trackOrderByWithRelationInput = {
    name?: SortOrder
    album_id?: SortOrder
    media_type_id?: SortOrder
    genre_id?: SortOrderInput | SortOrder
    composer?: SortOrderInput | SortOrder
    milliseconds?: SortOrder
    bytes?: SortOrderInput | SortOrder
    unit_price?: SortOrder
    track_id?: SortOrder
    invoice_line?: invoice_lineOrderByRelationAggregateInput
    playlist_track?: playlist_trackOrderByRelationAggregateInput
    album?: albumOrderByWithRelationInput
    track_discount?: track_discountOrderByRelationAggregateInput
  }

  export type trackWhereUniqueInput = Prisma.AtLeast<{
    track_id?: number
    AND?: trackWhereInput | trackWhereInput[]
    OR?: trackWhereInput[]
    NOT?: trackWhereInput | trackWhereInput[]
    name?: StringFilter<"track"> | string
    album_id?: IntFilter<"track"> | number
    media_type_id?: IntFilter<"track"> | number
    genre_id?: IntNullableFilter<"track"> | number | null
    composer?: StringNullableFilter<"track"> | string | null
    milliseconds?: IntFilter<"track"> | number
    bytes?: IntNullableFilter<"track"> | number | null
    unit_price?: DecimalFilter<"track"> | Decimal | DecimalJsLike | number | string
    invoice_line?: Invoice_lineListRelationFilter
    playlist_track?: Playlist_trackListRelationFilter
    album?: XOR<AlbumScalarRelationFilter, albumWhereInput>
    track_discount?: Track_discountListRelationFilter
  }, "track_id">

  export type trackOrderByWithAggregationInput = {
    name?: SortOrder
    album_id?: SortOrder
    media_type_id?: SortOrder
    genre_id?: SortOrderInput | SortOrder
    composer?: SortOrderInput | SortOrder
    milliseconds?: SortOrder
    bytes?: SortOrderInput | SortOrder
    unit_price?: SortOrder
    track_id?: SortOrder
    _count?: trackCountOrderByAggregateInput
    _avg?: trackAvgOrderByAggregateInput
    _max?: trackMaxOrderByAggregateInput
    _min?: trackMinOrderByAggregateInput
    _sum?: trackSumOrderByAggregateInput
  }

  export type trackScalarWhereWithAggregatesInput = {
    AND?: trackScalarWhereWithAggregatesInput | trackScalarWhereWithAggregatesInput[]
    OR?: trackScalarWhereWithAggregatesInput[]
    NOT?: trackScalarWhereWithAggregatesInput | trackScalarWhereWithAggregatesInput[]
    name?: StringWithAggregatesFilter<"track"> | string
    album_id?: IntWithAggregatesFilter<"track"> | number
    media_type_id?: IntWithAggregatesFilter<"track"> | number
    genre_id?: IntNullableWithAggregatesFilter<"track"> | number | null
    composer?: StringNullableWithAggregatesFilter<"track"> | string | null
    milliseconds?: IntWithAggregatesFilter<"track"> | number
    bytes?: IntNullableWithAggregatesFilter<"track"> | number | null
    unit_price?: DecimalWithAggregatesFilter<"track"> | Decimal | DecimalJsLike | number | string
    track_id?: IntWithAggregatesFilter<"track"> | number
  }

  export type track_discountWhereInput = {
    AND?: track_discountWhereInput | track_discountWhereInput[]
    OR?: track_discountWhereInput[]
    NOT?: track_discountWhereInput | track_discountWhereInput[]
    track_discount_id?: IntFilter<"track_discount"> | number
    track_id?: IntFilter<"track_discount"> | number
    discount?: DecimalFilter<"track_discount"> | Decimal | DecimalJsLike | number | string
    offer_date?: DateTimeFilter<"track_discount"> | Date | string
    close_date?: DateTimeFilter<"track_discount"> | Date | string
    employee_id?: IntFilter<"track_discount"> | number
    employee?: XOR<EmployeeScalarRelationFilter, employeeWhereInput>
    track?: XOR<TrackScalarRelationFilter, trackWhereInput>
  }

  export type track_discountOrderByWithRelationInput = {
    track_discount_id?: SortOrder
    track_id?: SortOrder
    discount?: SortOrder
    offer_date?: SortOrder
    close_date?: SortOrder
    employee_id?: SortOrder
    employee?: employeeOrderByWithRelationInput
    track?: trackOrderByWithRelationInput
  }

  export type track_discountWhereUniqueInput = Prisma.AtLeast<{
    track_discount_id?: number
    AND?: track_discountWhereInput | track_discountWhereInput[]
    OR?: track_discountWhereInput[]
    NOT?: track_discountWhereInput | track_discountWhereInput[]
    track_id?: IntFilter<"track_discount"> | number
    discount?: DecimalFilter<"track_discount"> | Decimal | DecimalJsLike | number | string
    offer_date?: DateTimeFilter<"track_discount"> | Date | string
    close_date?: DateTimeFilter<"track_discount"> | Date | string
    employee_id?: IntFilter<"track_discount"> | number
    employee?: XOR<EmployeeScalarRelationFilter, employeeWhereInput>
    track?: XOR<TrackScalarRelationFilter, trackWhereInput>
  }, "track_discount_id">

  export type track_discountOrderByWithAggregationInput = {
    track_discount_id?: SortOrder
    track_id?: SortOrder
    discount?: SortOrder
    offer_date?: SortOrder
    close_date?: SortOrder
    employee_id?: SortOrder
    _count?: track_discountCountOrderByAggregateInput
    _avg?: track_discountAvgOrderByAggregateInput
    _max?: track_discountMaxOrderByAggregateInput
    _min?: track_discountMinOrderByAggregateInput
    _sum?: track_discountSumOrderByAggregateInput
  }

  export type track_discountScalarWhereWithAggregatesInput = {
    AND?: track_discountScalarWhereWithAggregatesInput | track_discountScalarWhereWithAggregatesInput[]
    OR?: track_discountScalarWhereWithAggregatesInput[]
    NOT?: track_discountScalarWhereWithAggregatesInput | track_discountScalarWhereWithAggregatesInput[]
    track_discount_id?: IntWithAggregatesFilter<"track_discount"> | number
    track_id?: IntWithAggregatesFilter<"track_discount"> | number
    discount?: DecimalWithAggregatesFilter<"track_discount"> | Decimal | DecimalJsLike | number | string
    offer_date?: DateTimeWithAggregatesFilter<"track_discount"> | Date | string
    close_date?: DateTimeWithAggregatesFilter<"track_discount"> | Date | string
    employee_id?: IntWithAggregatesFilter<"track_discount"> | number
  }

  export type albumCreateInput = {
    title: string
    artist: artistCreateNestedOneWithoutAlbumInput
    track?: trackCreateNestedManyWithoutAlbumInput
  }

  export type albumUncheckedCreateInput = {
    title: string
    artist_id: number
    album_id?: number
    track?: trackUncheckedCreateNestedManyWithoutAlbumInput
  }

  export type albumUpdateInput = {
    title?: StringFieldUpdateOperationsInput | string
    artist?: artistUpdateOneRequiredWithoutAlbumNestedInput
    track?: trackUpdateManyWithoutAlbumNestedInput
  }

  export type albumUncheckedUpdateInput = {
    title?: StringFieldUpdateOperationsInput | string
    artist_id?: IntFieldUpdateOperationsInput | number
    album_id?: IntFieldUpdateOperationsInput | number
    track?: trackUncheckedUpdateManyWithoutAlbumNestedInput
  }

  export type albumCreateManyInput = {
    title: string
    artist_id: number
    album_id?: number
  }

  export type albumUpdateManyMutationInput = {
    title?: StringFieldUpdateOperationsInput | string
  }

  export type albumUncheckedUpdateManyInput = {
    title?: StringFieldUpdateOperationsInput | string
    artist_id?: IntFieldUpdateOperationsInput | number
    album_id?: IntFieldUpdateOperationsInput | number
  }

  export type artistCreateInput = {
    name: string
    album?: albumCreateNestedManyWithoutArtistInput
  }

  export type artistUncheckedCreateInput = {
    name: string
    artist_id?: number
    album?: albumUncheckedCreateNestedManyWithoutArtistInput
  }

  export type artistUpdateInput = {
    name?: StringFieldUpdateOperationsInput | string
    album?: albumUpdateManyWithoutArtistNestedInput
  }

  export type artistUncheckedUpdateInput = {
    name?: StringFieldUpdateOperationsInput | string
    artist_id?: IntFieldUpdateOperationsInput | number
    album?: albumUncheckedUpdateManyWithoutArtistNestedInput
  }

  export type artistCreateManyInput = {
    name: string
    artist_id?: number
  }

  export type artistUpdateManyMutationInput = {
    name?: StringFieldUpdateOperationsInput | string
  }

  export type artistUncheckedUpdateManyInput = {
    name?: StringFieldUpdateOperationsInput | string
    artist_id?: IntFieldUpdateOperationsInput | number
  }

  export type customerCreateInput = {
    customer_id: number
    first_name: string
    last_name: string
    company?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email: string
    employee?: employeeCreateNestedOneWithoutCustomerInput
    customer_review?: customer_reviewCreateNestedManyWithoutCustomerInput
    invoice?: invoiceCreateNestedManyWithoutCustomerInput
  }

  export type customerUncheckedCreateInput = {
    customer_id: number
    first_name: string
    last_name: string
    company?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email: string
    support_rep_id?: number | null
    customer_review?: customer_reviewUncheckedCreateNestedManyWithoutCustomerInput
    invoice?: invoiceUncheckedCreateNestedManyWithoutCustomerInput
  }

  export type customerUpdateInput = {
    customer_id?: IntFieldUpdateOperationsInput | number
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    company?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    employee?: employeeUpdateOneWithoutCustomerNestedInput
    customer_review?: customer_reviewUpdateManyWithoutCustomerNestedInput
    invoice?: invoiceUpdateManyWithoutCustomerNestedInput
  }

  export type customerUncheckedUpdateInput = {
    customer_id?: IntFieldUpdateOperationsInput | number
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    company?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    support_rep_id?: NullableIntFieldUpdateOperationsInput | number | null
    customer_review?: customer_reviewUncheckedUpdateManyWithoutCustomerNestedInput
    invoice?: invoiceUncheckedUpdateManyWithoutCustomerNestedInput
  }

  export type customerCreateManyInput = {
    customer_id: number
    first_name: string
    last_name: string
    company?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email: string
    support_rep_id?: number | null
  }

  export type customerUpdateManyMutationInput = {
    customer_id?: IntFieldUpdateOperationsInput | number
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    company?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
  }

  export type customerUncheckedUpdateManyInput = {
    customer_id?: IntFieldUpdateOperationsInput | number
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    company?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    support_rep_id?: NullableIntFieldUpdateOperationsInput | number | null
  }

  export type customer_reviewCreateInput = {
    track_id: number
    rating?: number | null
    review_comment?: string | null
    customer: customerCreateNestedOneWithoutCustomer_reviewInput
    invoice: invoiceCreateNestedOneWithoutCustomer_reviewInput
  }

  export type customer_reviewUncheckedCreateInput = {
    review_id?: number
    customer_id: number
    invoice_id: number
    track_id: number
    rating?: number | null
    review_comment?: string | null
  }

  export type customer_reviewUpdateInput = {
    track_id?: IntFieldUpdateOperationsInput | number
    rating?: NullableIntFieldUpdateOperationsInput | number | null
    review_comment?: NullableStringFieldUpdateOperationsInput | string | null
    customer?: customerUpdateOneRequiredWithoutCustomer_reviewNestedInput
    invoice?: invoiceUpdateOneRequiredWithoutCustomer_reviewNestedInput
  }

  export type customer_reviewUncheckedUpdateInput = {
    review_id?: IntFieldUpdateOperationsInput | number
    customer_id?: IntFieldUpdateOperationsInput | number
    invoice_id?: IntFieldUpdateOperationsInput | number
    track_id?: IntFieldUpdateOperationsInput | number
    rating?: NullableIntFieldUpdateOperationsInput | number | null
    review_comment?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type customer_reviewCreateManyInput = {
    review_id?: number
    customer_id: number
    invoice_id: number
    track_id: number
    rating?: number | null
    review_comment?: string | null
  }

  export type customer_reviewUpdateManyMutationInput = {
    track_id?: IntFieldUpdateOperationsInput | number
    rating?: NullableIntFieldUpdateOperationsInput | number | null
    review_comment?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type customer_reviewUncheckedUpdateManyInput = {
    review_id?: IntFieldUpdateOperationsInput | number
    customer_id?: IntFieldUpdateOperationsInput | number
    invoice_id?: IntFieldUpdateOperationsInput | number
    track_id?: IntFieldUpdateOperationsInput | number
    rating?: NullableIntFieldUpdateOperationsInput | number | null
    review_comment?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type employeeCreateInput = {
    employee_id: number
    last_name: string
    first_name: string
    title?: string | null
    birth_date?: Date | string | null
    hire_date: Date | string
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email?: string | null
    termination_date?: Date | string | null
    customer?: customerCreateNestedManyWithoutEmployeeInput
    employee?: employeeCreateNestedOneWithoutOther_employeeInput
    other_employee?: employeeCreateNestedManyWithoutEmployeeInput
    track_discount?: track_discountCreateNestedManyWithoutEmployeeInput
  }

  export type employeeUncheckedCreateInput = {
    employee_id: number
    last_name: string
    first_name: string
    title?: string | null
    reports_to?: number | null
    birth_date?: Date | string | null
    hire_date: Date | string
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email?: string | null
    termination_date?: Date | string | null
    customer?: customerUncheckedCreateNestedManyWithoutEmployeeInput
    other_employee?: employeeUncheckedCreateNestedManyWithoutEmployeeInput
    track_discount?: track_discountUncheckedCreateNestedManyWithoutEmployeeInput
  }

  export type employeeUpdateInput = {
    employee_id?: IntFieldUpdateOperationsInput | number
    last_name?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    birth_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hire_date?: DateTimeFieldUpdateOperationsInput | Date | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    termination_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    customer?: customerUpdateManyWithoutEmployeeNestedInput
    employee?: employeeUpdateOneWithoutOther_employeeNestedInput
    other_employee?: employeeUpdateManyWithoutEmployeeNestedInput
    track_discount?: track_discountUpdateManyWithoutEmployeeNestedInput
  }

  export type employeeUncheckedUpdateInput = {
    employee_id?: IntFieldUpdateOperationsInput | number
    last_name?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    reports_to?: NullableIntFieldUpdateOperationsInput | number | null
    birth_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hire_date?: DateTimeFieldUpdateOperationsInput | Date | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    termination_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    customer?: customerUncheckedUpdateManyWithoutEmployeeNestedInput
    other_employee?: employeeUncheckedUpdateManyWithoutEmployeeNestedInput
    track_discount?: track_discountUncheckedUpdateManyWithoutEmployeeNestedInput
  }

  export type employeeCreateManyInput = {
    employee_id: number
    last_name: string
    first_name: string
    title?: string | null
    reports_to?: number | null
    birth_date?: Date | string | null
    hire_date: Date | string
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email?: string | null
    termination_date?: Date | string | null
  }

  export type employeeUpdateManyMutationInput = {
    employee_id?: IntFieldUpdateOperationsInput | number
    last_name?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    birth_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hire_date?: DateTimeFieldUpdateOperationsInput | Date | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    termination_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type employeeUncheckedUpdateManyInput = {
    employee_id?: IntFieldUpdateOperationsInput | number
    last_name?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    reports_to?: NullableIntFieldUpdateOperationsInput | number | null
    birth_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hire_date?: DateTimeFieldUpdateOperationsInput | Date | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    termination_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type genreCreateInput = {
    genre_id: number
    name?: string | null
  }

  export type genreUncheckedCreateInput = {
    genre_id: number
    name?: string | null
  }

  export type genreUpdateInput = {
    genre_id?: IntFieldUpdateOperationsInput | number
    name?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type genreUncheckedUpdateInput = {
    genre_id?: IntFieldUpdateOperationsInput | number
    name?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type genreCreateManyInput = {
    genre_id: number
    name?: string | null
  }

  export type genreUpdateManyMutationInput = {
    genre_id?: IntFieldUpdateOperationsInput | number
    name?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type genreUncheckedUpdateManyInput = {
    genre_id?: IntFieldUpdateOperationsInput | number
    name?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type invoiceCreateInput = {
    invoice_id: number
    invoice_date: Date | string
    billing_address?: string | null
    billing_city?: string | null
    billing_state?: string | null
    billing_country?: string | null
    billing_postal_code?: string | null
    total: Decimal | DecimalJsLike | number | string
    customer_review?: customer_reviewCreateNestedManyWithoutInvoiceInput
    customer: customerCreateNestedOneWithoutInvoiceInput
    invoice_line?: invoice_lineCreateNestedManyWithoutInvoiceInput
  }

  export type invoiceUncheckedCreateInput = {
    invoice_id: number
    customer_id: number
    invoice_date: Date | string
    billing_address?: string | null
    billing_city?: string | null
    billing_state?: string | null
    billing_country?: string | null
    billing_postal_code?: string | null
    total: Decimal | DecimalJsLike | number | string
    customer_review?: customer_reviewUncheckedCreateNestedManyWithoutInvoiceInput
    invoice_line?: invoice_lineUncheckedCreateNestedManyWithoutInvoiceInput
  }

  export type invoiceUpdateInput = {
    invoice_id?: IntFieldUpdateOperationsInput | number
    invoice_date?: DateTimeFieldUpdateOperationsInput | Date | string
    billing_address?: NullableStringFieldUpdateOperationsInput | string | null
    billing_city?: NullableStringFieldUpdateOperationsInput | string | null
    billing_state?: NullableStringFieldUpdateOperationsInput | string | null
    billing_country?: NullableStringFieldUpdateOperationsInput | string | null
    billing_postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    total?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    customer_review?: customer_reviewUpdateManyWithoutInvoiceNestedInput
    customer?: customerUpdateOneRequiredWithoutInvoiceNestedInput
    invoice_line?: invoice_lineUpdateManyWithoutInvoiceNestedInput
  }

  export type invoiceUncheckedUpdateInput = {
    invoice_id?: IntFieldUpdateOperationsInput | number
    customer_id?: IntFieldUpdateOperationsInput | number
    invoice_date?: DateTimeFieldUpdateOperationsInput | Date | string
    billing_address?: NullableStringFieldUpdateOperationsInput | string | null
    billing_city?: NullableStringFieldUpdateOperationsInput | string | null
    billing_state?: NullableStringFieldUpdateOperationsInput | string | null
    billing_country?: NullableStringFieldUpdateOperationsInput | string | null
    billing_postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    total?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    customer_review?: customer_reviewUncheckedUpdateManyWithoutInvoiceNestedInput
    invoice_line?: invoice_lineUncheckedUpdateManyWithoutInvoiceNestedInput
  }

  export type invoiceCreateManyInput = {
    invoice_id: number
    customer_id: number
    invoice_date: Date | string
    billing_address?: string | null
    billing_city?: string | null
    billing_state?: string | null
    billing_country?: string | null
    billing_postal_code?: string | null
    total: Decimal | DecimalJsLike | number | string
  }

  export type invoiceUpdateManyMutationInput = {
    invoice_id?: IntFieldUpdateOperationsInput | number
    invoice_date?: DateTimeFieldUpdateOperationsInput | Date | string
    billing_address?: NullableStringFieldUpdateOperationsInput | string | null
    billing_city?: NullableStringFieldUpdateOperationsInput | string | null
    billing_state?: NullableStringFieldUpdateOperationsInput | string | null
    billing_country?: NullableStringFieldUpdateOperationsInput | string | null
    billing_postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    total?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
  }

  export type invoiceUncheckedUpdateManyInput = {
    invoice_id?: IntFieldUpdateOperationsInput | number
    customer_id?: IntFieldUpdateOperationsInput | number
    invoice_date?: DateTimeFieldUpdateOperationsInput | Date | string
    billing_address?: NullableStringFieldUpdateOperationsInput | string | null
    billing_city?: NullableStringFieldUpdateOperationsInput | string | null
    billing_state?: NullableStringFieldUpdateOperationsInput | string | null
    billing_country?: NullableStringFieldUpdateOperationsInput | string | null
    billing_postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    total?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
  }

  export type invoice_lineCreateInput = {
    invoice_line_id: number
    unit_price: Decimal | DecimalJsLike | number | string
    quantity: number
    invoice: invoiceCreateNestedOneWithoutInvoice_lineInput
    track: trackCreateNestedOneWithoutInvoice_lineInput
  }

  export type invoice_lineUncheckedCreateInput = {
    invoice_line_id: number
    invoice_id: number
    track_id: number
    unit_price: Decimal | DecimalJsLike | number | string
    quantity: number
  }

  export type invoice_lineUpdateInput = {
    invoice_line_id?: IntFieldUpdateOperationsInput | number
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    quantity?: IntFieldUpdateOperationsInput | number
    invoice?: invoiceUpdateOneRequiredWithoutInvoice_lineNestedInput
    track?: trackUpdateOneRequiredWithoutInvoice_lineNestedInput
  }

  export type invoice_lineUncheckedUpdateInput = {
    invoice_line_id?: IntFieldUpdateOperationsInput | number
    invoice_id?: IntFieldUpdateOperationsInput | number
    track_id?: IntFieldUpdateOperationsInput | number
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type invoice_lineCreateManyInput = {
    invoice_line_id: number
    invoice_id: number
    track_id: number
    unit_price: Decimal | DecimalJsLike | number | string
    quantity: number
  }

  export type invoice_lineUpdateManyMutationInput = {
    invoice_line_id?: IntFieldUpdateOperationsInput | number
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type invoice_lineUncheckedUpdateManyInput = {
    invoice_line_id?: IntFieldUpdateOperationsInput | number
    invoice_id?: IntFieldUpdateOperationsInput | number
    track_id?: IntFieldUpdateOperationsInput | number
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type media_typeCreateInput = {
    media_type_id: number
    name?: string | null
  }

  export type media_typeUncheckedCreateInput = {
    media_type_id: number
    name?: string | null
  }

  export type media_typeUpdateInput = {
    media_type_id?: IntFieldUpdateOperationsInput | number
    name?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type media_typeUncheckedUpdateInput = {
    media_type_id?: IntFieldUpdateOperationsInput | number
    name?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type media_typeCreateManyInput = {
    media_type_id: number
    name?: string | null
  }

  export type media_typeUpdateManyMutationInput = {
    media_type_id?: IntFieldUpdateOperationsInput | number
    name?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type media_typeUncheckedUpdateManyInput = {
    media_type_id?: IntFieldUpdateOperationsInput | number
    name?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type playlistCreateInput = {
    playlist_id: number
    name?: string | null
    playlist_track?: playlist_trackCreateNestedManyWithoutPlaylistInput
  }

  export type playlistUncheckedCreateInput = {
    playlist_id: number
    name?: string | null
    playlist_track?: playlist_trackUncheckedCreateNestedManyWithoutPlaylistInput
  }

  export type playlistUpdateInput = {
    playlist_id?: IntFieldUpdateOperationsInput | number
    name?: NullableStringFieldUpdateOperationsInput | string | null
    playlist_track?: playlist_trackUpdateManyWithoutPlaylistNestedInput
  }

  export type playlistUncheckedUpdateInput = {
    playlist_id?: IntFieldUpdateOperationsInput | number
    name?: NullableStringFieldUpdateOperationsInput | string | null
    playlist_track?: playlist_trackUncheckedUpdateManyWithoutPlaylistNestedInput
  }

  export type playlistCreateManyInput = {
    playlist_id: number
    name?: string | null
  }

  export type playlistUpdateManyMutationInput = {
    playlist_id?: IntFieldUpdateOperationsInput | number
    name?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type playlistUncheckedUpdateManyInput = {
    playlist_id?: IntFieldUpdateOperationsInput | number
    name?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type playlist_trackCreateInput = {
    playlist: playlistCreateNestedOneWithoutPlaylist_trackInput
    track: trackCreateNestedOneWithoutPlaylist_trackInput
  }

  export type playlist_trackUncheckedCreateInput = {
    playlist_id: number
    track_id: number
  }

  export type playlist_trackUpdateInput = {
    playlist?: playlistUpdateOneRequiredWithoutPlaylist_trackNestedInput
    track?: trackUpdateOneRequiredWithoutPlaylist_trackNestedInput
  }

  export type playlist_trackUncheckedUpdateInput = {
    playlist_id?: IntFieldUpdateOperationsInput | number
    track_id?: IntFieldUpdateOperationsInput | number
  }

  export type playlist_trackCreateManyInput = {
    playlist_id: number
    track_id: number
  }

  export type playlist_trackUpdateManyMutationInput = {

  }

  export type playlist_trackUncheckedUpdateManyInput = {
    playlist_id?: IntFieldUpdateOperationsInput | number
    track_id?: IntFieldUpdateOperationsInput | number
  }

  export type trackCreateInput = {
    name: string
    media_type_id?: number
    genre_id?: number | null
    composer?: string | null
    milliseconds?: number
    bytes?: number | null
    unit_price?: Decimal | DecimalJsLike | number | string
    invoice_line?: invoice_lineCreateNestedManyWithoutTrackInput
    playlist_track?: playlist_trackCreateNestedManyWithoutTrackInput
    album: albumCreateNestedOneWithoutTrackInput
    track_discount?: track_discountCreateNestedManyWithoutTrackInput
  }

  export type trackUncheckedCreateInput = {
    name: string
    album_id: number
    media_type_id?: number
    genre_id?: number | null
    composer?: string | null
    milliseconds?: number
    bytes?: number | null
    unit_price?: Decimal | DecimalJsLike | number | string
    track_id?: number
    invoice_line?: invoice_lineUncheckedCreateNestedManyWithoutTrackInput
    playlist_track?: playlist_trackUncheckedCreateNestedManyWithoutTrackInput
    track_discount?: track_discountUncheckedCreateNestedManyWithoutTrackInput
  }

  export type trackUpdateInput = {
    name?: StringFieldUpdateOperationsInput | string
    media_type_id?: IntFieldUpdateOperationsInput | number
    genre_id?: NullableIntFieldUpdateOperationsInput | number | null
    composer?: NullableStringFieldUpdateOperationsInput | string | null
    milliseconds?: IntFieldUpdateOperationsInput | number
    bytes?: NullableIntFieldUpdateOperationsInput | number | null
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    invoice_line?: invoice_lineUpdateManyWithoutTrackNestedInput
    playlist_track?: playlist_trackUpdateManyWithoutTrackNestedInput
    album?: albumUpdateOneRequiredWithoutTrackNestedInput
    track_discount?: track_discountUpdateManyWithoutTrackNestedInput
  }

  export type trackUncheckedUpdateInput = {
    name?: StringFieldUpdateOperationsInput | string
    album_id?: IntFieldUpdateOperationsInput | number
    media_type_id?: IntFieldUpdateOperationsInput | number
    genre_id?: NullableIntFieldUpdateOperationsInput | number | null
    composer?: NullableStringFieldUpdateOperationsInput | string | null
    milliseconds?: IntFieldUpdateOperationsInput | number
    bytes?: NullableIntFieldUpdateOperationsInput | number | null
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    track_id?: IntFieldUpdateOperationsInput | number
    invoice_line?: invoice_lineUncheckedUpdateManyWithoutTrackNestedInput
    playlist_track?: playlist_trackUncheckedUpdateManyWithoutTrackNestedInput
    track_discount?: track_discountUncheckedUpdateManyWithoutTrackNestedInput
  }

  export type trackCreateManyInput = {
    name: string
    album_id: number
    media_type_id?: number
    genre_id?: number | null
    composer?: string | null
    milliseconds?: number
    bytes?: number | null
    unit_price?: Decimal | DecimalJsLike | number | string
    track_id?: number
  }

  export type trackUpdateManyMutationInput = {
    name?: StringFieldUpdateOperationsInput | string
    media_type_id?: IntFieldUpdateOperationsInput | number
    genre_id?: NullableIntFieldUpdateOperationsInput | number | null
    composer?: NullableStringFieldUpdateOperationsInput | string | null
    milliseconds?: IntFieldUpdateOperationsInput | number
    bytes?: NullableIntFieldUpdateOperationsInput | number | null
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
  }

  export type trackUncheckedUpdateManyInput = {
    name?: StringFieldUpdateOperationsInput | string
    album_id?: IntFieldUpdateOperationsInput | number
    media_type_id?: IntFieldUpdateOperationsInput | number
    genre_id?: NullableIntFieldUpdateOperationsInput | number | null
    composer?: NullableStringFieldUpdateOperationsInput | string | null
    milliseconds?: IntFieldUpdateOperationsInput | number
    bytes?: NullableIntFieldUpdateOperationsInput | number | null
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    track_id?: IntFieldUpdateOperationsInput | number
  }

  export type track_discountCreateInput = {
    discount: Decimal | DecimalJsLike | number | string
    offer_date: Date | string
    close_date: Date | string
    employee: employeeCreateNestedOneWithoutTrack_discountInput
    track: trackCreateNestedOneWithoutTrack_discountInput
  }

  export type track_discountUncheckedCreateInput = {
    track_discount_id?: number
    track_id: number
    discount: Decimal | DecimalJsLike | number | string
    offer_date: Date | string
    close_date: Date | string
    employee_id: number
  }

  export type track_discountUpdateInput = {
    discount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    offer_date?: DateTimeFieldUpdateOperationsInput | Date | string
    close_date?: DateTimeFieldUpdateOperationsInput | Date | string
    employee?: employeeUpdateOneRequiredWithoutTrack_discountNestedInput
    track?: trackUpdateOneRequiredWithoutTrack_discountNestedInput
  }

  export type track_discountUncheckedUpdateInput = {
    track_discount_id?: IntFieldUpdateOperationsInput | number
    track_id?: IntFieldUpdateOperationsInput | number
    discount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    offer_date?: DateTimeFieldUpdateOperationsInput | Date | string
    close_date?: DateTimeFieldUpdateOperationsInput | Date | string
    employee_id?: IntFieldUpdateOperationsInput | number
  }

  export type track_discountCreateManyInput = {
    track_discount_id?: number
    track_id: number
    discount: Decimal | DecimalJsLike | number | string
    offer_date: Date | string
    close_date: Date | string
    employee_id: number
  }

  export type track_discountUpdateManyMutationInput = {
    discount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    offer_date?: DateTimeFieldUpdateOperationsInput | Date | string
    close_date?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type track_discountUncheckedUpdateManyInput = {
    track_discount_id?: IntFieldUpdateOperationsInput | number
    track_id?: IntFieldUpdateOperationsInput | number
    discount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    offer_date?: DateTimeFieldUpdateOperationsInput | Date | string
    close_date?: DateTimeFieldUpdateOperationsInput | Date | string
    employee_id?: IntFieldUpdateOperationsInput | number
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

  export type ArtistScalarRelationFilter = {
    is?: artistWhereInput
    isNot?: artistWhereInput
  }

  export type TrackListRelationFilter = {
    every?: trackWhereInput
    some?: trackWhereInput
    none?: trackWhereInput
  }

  export type trackOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type albumCountOrderByAggregateInput = {
    title?: SortOrder
    artist_id?: SortOrder
    album_id?: SortOrder
  }

  export type albumAvgOrderByAggregateInput = {
    artist_id?: SortOrder
    album_id?: SortOrder
  }

  export type albumMaxOrderByAggregateInput = {
    title?: SortOrder
    artist_id?: SortOrder
    album_id?: SortOrder
  }

  export type albumMinOrderByAggregateInput = {
    title?: SortOrder
    artist_id?: SortOrder
    album_id?: SortOrder
  }

  export type albumSumOrderByAggregateInput = {
    artist_id?: SortOrder
    album_id?: SortOrder
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

  export type AlbumListRelationFilter = {
    every?: albumWhereInput
    some?: albumWhereInput
    none?: albumWhereInput
  }

  export type albumOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type artistCountOrderByAggregateInput = {
    name?: SortOrder
    artist_id?: SortOrder
  }

  export type artistAvgOrderByAggregateInput = {
    artist_id?: SortOrder
  }

  export type artistMaxOrderByAggregateInput = {
    name?: SortOrder
    artist_id?: SortOrder
  }

  export type artistMinOrderByAggregateInput = {
    name?: SortOrder
    artist_id?: SortOrder
  }

  export type artistSumOrderByAggregateInput = {
    artist_id?: SortOrder
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

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type EmployeeNullableScalarRelationFilter = {
    is?: employeeWhereInput | null
    isNot?: employeeWhereInput | null
  }

  export type Customer_reviewListRelationFilter = {
    every?: customer_reviewWhereInput
    some?: customer_reviewWhereInput
    none?: customer_reviewWhereInput
  }

  export type InvoiceListRelationFilter = {
    every?: invoiceWhereInput
    some?: invoiceWhereInput
    none?: invoiceWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type customer_reviewOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type invoiceOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type customerFirst_nameLast_nameEmailCompoundUniqueInput = {
    first_name: string
    last_name: string
    email: string
  }

  export type customerCountOrderByAggregateInput = {
    customer_id?: SortOrder
    first_name?: SortOrder
    last_name?: SortOrder
    company?: SortOrder
    address?: SortOrder
    city?: SortOrder
    state?: SortOrder
    country?: SortOrder
    postal_code?: SortOrder
    phone?: SortOrder
    fax?: SortOrder
    email?: SortOrder
    support_rep_id?: SortOrder
  }

  export type customerAvgOrderByAggregateInput = {
    customer_id?: SortOrder
    support_rep_id?: SortOrder
  }

  export type customerMaxOrderByAggregateInput = {
    customer_id?: SortOrder
    first_name?: SortOrder
    last_name?: SortOrder
    company?: SortOrder
    address?: SortOrder
    city?: SortOrder
    state?: SortOrder
    country?: SortOrder
    postal_code?: SortOrder
    phone?: SortOrder
    fax?: SortOrder
    email?: SortOrder
    support_rep_id?: SortOrder
  }

  export type customerMinOrderByAggregateInput = {
    customer_id?: SortOrder
    first_name?: SortOrder
    last_name?: SortOrder
    company?: SortOrder
    address?: SortOrder
    city?: SortOrder
    state?: SortOrder
    country?: SortOrder
    postal_code?: SortOrder
    phone?: SortOrder
    fax?: SortOrder
    email?: SortOrder
    support_rep_id?: SortOrder
  }

  export type customerSumOrderByAggregateInput = {
    customer_id?: SortOrder
    support_rep_id?: SortOrder
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

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type CustomerScalarRelationFilter = {
    is?: customerWhereInput
    isNot?: customerWhereInput
  }

  export type InvoiceScalarRelationFilter = {
    is?: invoiceWhereInput
    isNot?: invoiceWhereInput
  }

  export type customer_reviewCountOrderByAggregateInput = {
    review_id?: SortOrder
    customer_id?: SortOrder
    invoice_id?: SortOrder
    track_id?: SortOrder
    rating?: SortOrder
    review_comment?: SortOrder
  }

  export type customer_reviewAvgOrderByAggregateInput = {
    review_id?: SortOrder
    customer_id?: SortOrder
    invoice_id?: SortOrder
    track_id?: SortOrder
    rating?: SortOrder
  }

  export type customer_reviewMaxOrderByAggregateInput = {
    review_id?: SortOrder
    customer_id?: SortOrder
    invoice_id?: SortOrder
    track_id?: SortOrder
    rating?: SortOrder
    review_comment?: SortOrder
  }

  export type customer_reviewMinOrderByAggregateInput = {
    review_id?: SortOrder
    customer_id?: SortOrder
    invoice_id?: SortOrder
    track_id?: SortOrder
    rating?: SortOrder
    review_comment?: SortOrder
  }

  export type customer_reviewSumOrderByAggregateInput = {
    review_id?: SortOrder
    customer_id?: SortOrder
    invoice_id?: SortOrder
    track_id?: SortOrder
    rating?: SortOrder
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
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

  export type CustomerListRelationFilter = {
    every?: customerWhereInput
    some?: customerWhereInput
    none?: customerWhereInput
  }

  export type EmployeeListRelationFilter = {
    every?: employeeWhereInput
    some?: employeeWhereInput
    none?: employeeWhereInput
  }

  export type Track_discountListRelationFilter = {
    every?: track_discountWhereInput
    some?: track_discountWhereInput
    none?: track_discountWhereInput
  }

  export type customerOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type employeeOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type track_discountOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type employeeCountOrderByAggregateInput = {
    employee_id?: SortOrder
    last_name?: SortOrder
    first_name?: SortOrder
    title?: SortOrder
    reports_to?: SortOrder
    birth_date?: SortOrder
    hire_date?: SortOrder
    address?: SortOrder
    city?: SortOrder
    state?: SortOrder
    country?: SortOrder
    postal_code?: SortOrder
    phone?: SortOrder
    fax?: SortOrder
    email?: SortOrder
    termination_date?: SortOrder
  }

  export type employeeAvgOrderByAggregateInput = {
    employee_id?: SortOrder
    reports_to?: SortOrder
  }

  export type employeeMaxOrderByAggregateInput = {
    employee_id?: SortOrder
    last_name?: SortOrder
    first_name?: SortOrder
    title?: SortOrder
    reports_to?: SortOrder
    birth_date?: SortOrder
    hire_date?: SortOrder
    address?: SortOrder
    city?: SortOrder
    state?: SortOrder
    country?: SortOrder
    postal_code?: SortOrder
    phone?: SortOrder
    fax?: SortOrder
    email?: SortOrder
    termination_date?: SortOrder
  }

  export type employeeMinOrderByAggregateInput = {
    employee_id?: SortOrder
    last_name?: SortOrder
    first_name?: SortOrder
    title?: SortOrder
    reports_to?: SortOrder
    birth_date?: SortOrder
    hire_date?: SortOrder
    address?: SortOrder
    city?: SortOrder
    state?: SortOrder
    country?: SortOrder
    postal_code?: SortOrder
    phone?: SortOrder
    fax?: SortOrder
    email?: SortOrder
    termination_date?: SortOrder
  }

  export type employeeSumOrderByAggregateInput = {
    employee_id?: SortOrder
    reports_to?: SortOrder
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
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

  export type genreCountOrderByAggregateInput = {
    genre_id?: SortOrder
    name?: SortOrder
  }

  export type genreAvgOrderByAggregateInput = {
    genre_id?: SortOrder
  }

  export type genreMaxOrderByAggregateInput = {
    genre_id?: SortOrder
    name?: SortOrder
  }

  export type genreMinOrderByAggregateInput = {
    genre_id?: SortOrder
    name?: SortOrder
  }

  export type genreSumOrderByAggregateInput = {
    genre_id?: SortOrder
  }

  export type DecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type Invoice_lineListRelationFilter = {
    every?: invoice_lineWhereInput
    some?: invoice_lineWhereInput
    none?: invoice_lineWhereInput
  }

  export type invoice_lineOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type invoiceCustomer_idInvoice_dateCompoundUniqueInput = {
    customer_id: number
    invoice_date: Date | string
  }

  export type invoiceCountOrderByAggregateInput = {
    invoice_id?: SortOrder
    customer_id?: SortOrder
    invoice_date?: SortOrder
    billing_address?: SortOrder
    billing_city?: SortOrder
    billing_state?: SortOrder
    billing_country?: SortOrder
    billing_postal_code?: SortOrder
    total?: SortOrder
  }

  export type invoiceAvgOrderByAggregateInput = {
    invoice_id?: SortOrder
    customer_id?: SortOrder
    total?: SortOrder
  }

  export type invoiceMaxOrderByAggregateInput = {
    invoice_id?: SortOrder
    customer_id?: SortOrder
    invoice_date?: SortOrder
    billing_address?: SortOrder
    billing_city?: SortOrder
    billing_state?: SortOrder
    billing_country?: SortOrder
    billing_postal_code?: SortOrder
    total?: SortOrder
  }

  export type invoiceMinOrderByAggregateInput = {
    invoice_id?: SortOrder
    customer_id?: SortOrder
    invoice_date?: SortOrder
    billing_address?: SortOrder
    billing_city?: SortOrder
    billing_state?: SortOrder
    billing_country?: SortOrder
    billing_postal_code?: SortOrder
    total?: SortOrder
  }

  export type invoiceSumOrderByAggregateInput = {
    invoice_id?: SortOrder
    customer_id?: SortOrder
    total?: SortOrder
  }

  export type DecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }

  export type TrackScalarRelationFilter = {
    is?: trackWhereInput
    isNot?: trackWhereInput
  }

  export type invoice_lineCountOrderByAggregateInput = {
    invoice_line_id?: SortOrder
    invoice_id?: SortOrder
    track_id?: SortOrder
    unit_price?: SortOrder
    quantity?: SortOrder
  }

  export type invoice_lineAvgOrderByAggregateInput = {
    invoice_line_id?: SortOrder
    invoice_id?: SortOrder
    track_id?: SortOrder
    unit_price?: SortOrder
    quantity?: SortOrder
  }

  export type invoice_lineMaxOrderByAggregateInput = {
    invoice_line_id?: SortOrder
    invoice_id?: SortOrder
    track_id?: SortOrder
    unit_price?: SortOrder
    quantity?: SortOrder
  }

  export type invoice_lineMinOrderByAggregateInput = {
    invoice_line_id?: SortOrder
    invoice_id?: SortOrder
    track_id?: SortOrder
    unit_price?: SortOrder
    quantity?: SortOrder
  }

  export type invoice_lineSumOrderByAggregateInput = {
    invoice_line_id?: SortOrder
    invoice_id?: SortOrder
    track_id?: SortOrder
    unit_price?: SortOrder
    quantity?: SortOrder
  }

  export type media_typeCountOrderByAggregateInput = {
    media_type_id?: SortOrder
    name?: SortOrder
  }

  export type media_typeAvgOrderByAggregateInput = {
    media_type_id?: SortOrder
  }

  export type media_typeMaxOrderByAggregateInput = {
    media_type_id?: SortOrder
    name?: SortOrder
  }

  export type media_typeMinOrderByAggregateInput = {
    media_type_id?: SortOrder
    name?: SortOrder
  }

  export type media_typeSumOrderByAggregateInput = {
    media_type_id?: SortOrder
  }

  export type Playlist_trackListRelationFilter = {
    every?: playlist_trackWhereInput
    some?: playlist_trackWhereInput
    none?: playlist_trackWhereInput
  }

  export type playlist_trackOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type playlistCountOrderByAggregateInput = {
    playlist_id?: SortOrder
    name?: SortOrder
  }

  export type playlistAvgOrderByAggregateInput = {
    playlist_id?: SortOrder
  }

  export type playlistMaxOrderByAggregateInput = {
    playlist_id?: SortOrder
    name?: SortOrder
  }

  export type playlistMinOrderByAggregateInput = {
    playlist_id?: SortOrder
    name?: SortOrder
  }

  export type playlistSumOrderByAggregateInput = {
    playlist_id?: SortOrder
  }

  export type PlaylistScalarRelationFilter = {
    is?: playlistWhereInput
    isNot?: playlistWhereInput
  }

  export type playlist_trackPlaylist_idTrack_idCompoundUniqueInput = {
    playlist_id: number
    track_id: number
  }

  export type playlist_trackCountOrderByAggregateInput = {
    playlist_id?: SortOrder
    track_id?: SortOrder
  }

  export type playlist_trackAvgOrderByAggregateInput = {
    playlist_id?: SortOrder
    track_id?: SortOrder
  }

  export type playlist_trackMaxOrderByAggregateInput = {
    playlist_id?: SortOrder
    track_id?: SortOrder
  }

  export type playlist_trackMinOrderByAggregateInput = {
    playlist_id?: SortOrder
    track_id?: SortOrder
  }

  export type playlist_trackSumOrderByAggregateInput = {
    playlist_id?: SortOrder
    track_id?: SortOrder
  }

  export type AlbumScalarRelationFilter = {
    is?: albumWhereInput
    isNot?: albumWhereInput
  }

  export type trackCountOrderByAggregateInput = {
    name?: SortOrder
    album_id?: SortOrder
    media_type_id?: SortOrder
    genre_id?: SortOrder
    composer?: SortOrder
    milliseconds?: SortOrder
    bytes?: SortOrder
    unit_price?: SortOrder
    track_id?: SortOrder
  }

  export type trackAvgOrderByAggregateInput = {
    album_id?: SortOrder
    media_type_id?: SortOrder
    genre_id?: SortOrder
    milliseconds?: SortOrder
    bytes?: SortOrder
    unit_price?: SortOrder
    track_id?: SortOrder
  }

  export type trackMaxOrderByAggregateInput = {
    name?: SortOrder
    album_id?: SortOrder
    media_type_id?: SortOrder
    genre_id?: SortOrder
    composer?: SortOrder
    milliseconds?: SortOrder
    bytes?: SortOrder
    unit_price?: SortOrder
    track_id?: SortOrder
  }

  export type trackMinOrderByAggregateInput = {
    name?: SortOrder
    album_id?: SortOrder
    media_type_id?: SortOrder
    genre_id?: SortOrder
    composer?: SortOrder
    milliseconds?: SortOrder
    bytes?: SortOrder
    unit_price?: SortOrder
    track_id?: SortOrder
  }

  export type trackSumOrderByAggregateInput = {
    album_id?: SortOrder
    media_type_id?: SortOrder
    genre_id?: SortOrder
    milliseconds?: SortOrder
    bytes?: SortOrder
    unit_price?: SortOrder
    track_id?: SortOrder
  }

  export type EmployeeScalarRelationFilter = {
    is?: employeeWhereInput
    isNot?: employeeWhereInput
  }

  export type track_discountCountOrderByAggregateInput = {
    track_discount_id?: SortOrder
    track_id?: SortOrder
    discount?: SortOrder
    offer_date?: SortOrder
    close_date?: SortOrder
    employee_id?: SortOrder
  }

  export type track_discountAvgOrderByAggregateInput = {
    track_discount_id?: SortOrder
    track_id?: SortOrder
    discount?: SortOrder
    employee_id?: SortOrder
  }

  export type track_discountMaxOrderByAggregateInput = {
    track_discount_id?: SortOrder
    track_id?: SortOrder
    discount?: SortOrder
    offer_date?: SortOrder
    close_date?: SortOrder
    employee_id?: SortOrder
  }

  export type track_discountMinOrderByAggregateInput = {
    track_discount_id?: SortOrder
    track_id?: SortOrder
    discount?: SortOrder
    offer_date?: SortOrder
    close_date?: SortOrder
    employee_id?: SortOrder
  }

  export type track_discountSumOrderByAggregateInput = {
    track_discount_id?: SortOrder
    track_id?: SortOrder
    discount?: SortOrder
    employee_id?: SortOrder
  }

  export type artistCreateNestedOneWithoutAlbumInput = {
    create?: XOR<artistCreateWithoutAlbumInput, artistUncheckedCreateWithoutAlbumInput>
    connectOrCreate?: artistCreateOrConnectWithoutAlbumInput
    connect?: artistWhereUniqueInput
  }

  export type trackCreateNestedManyWithoutAlbumInput = {
    create?: XOR<trackCreateWithoutAlbumInput, trackUncheckedCreateWithoutAlbumInput> | trackCreateWithoutAlbumInput[] | trackUncheckedCreateWithoutAlbumInput[]
    connectOrCreate?: trackCreateOrConnectWithoutAlbumInput | trackCreateOrConnectWithoutAlbumInput[]
    createMany?: trackCreateManyAlbumInputEnvelope
    connect?: trackWhereUniqueInput | trackWhereUniqueInput[]
  }

  export type trackUncheckedCreateNestedManyWithoutAlbumInput = {
    create?: XOR<trackCreateWithoutAlbumInput, trackUncheckedCreateWithoutAlbumInput> | trackCreateWithoutAlbumInput[] | trackUncheckedCreateWithoutAlbumInput[]
    connectOrCreate?: trackCreateOrConnectWithoutAlbumInput | trackCreateOrConnectWithoutAlbumInput[]
    createMany?: trackCreateManyAlbumInputEnvelope
    connect?: trackWhereUniqueInput | trackWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type artistUpdateOneRequiredWithoutAlbumNestedInput = {
    create?: XOR<artistCreateWithoutAlbumInput, artistUncheckedCreateWithoutAlbumInput>
    connectOrCreate?: artistCreateOrConnectWithoutAlbumInput
    upsert?: artistUpsertWithoutAlbumInput
    connect?: artistWhereUniqueInput
    update?: XOR<XOR<artistUpdateToOneWithWhereWithoutAlbumInput, artistUpdateWithoutAlbumInput>, artistUncheckedUpdateWithoutAlbumInput>
  }

  export type trackUpdateManyWithoutAlbumNestedInput = {
    create?: XOR<trackCreateWithoutAlbumInput, trackUncheckedCreateWithoutAlbumInput> | trackCreateWithoutAlbumInput[] | trackUncheckedCreateWithoutAlbumInput[]
    connectOrCreate?: trackCreateOrConnectWithoutAlbumInput | trackCreateOrConnectWithoutAlbumInput[]
    upsert?: trackUpsertWithWhereUniqueWithoutAlbumInput | trackUpsertWithWhereUniqueWithoutAlbumInput[]
    createMany?: trackCreateManyAlbumInputEnvelope
    set?: trackWhereUniqueInput | trackWhereUniqueInput[]
    disconnect?: trackWhereUniqueInput | trackWhereUniqueInput[]
    delete?: trackWhereUniqueInput | trackWhereUniqueInput[]
    connect?: trackWhereUniqueInput | trackWhereUniqueInput[]
    update?: trackUpdateWithWhereUniqueWithoutAlbumInput | trackUpdateWithWhereUniqueWithoutAlbumInput[]
    updateMany?: trackUpdateManyWithWhereWithoutAlbumInput | trackUpdateManyWithWhereWithoutAlbumInput[]
    deleteMany?: trackScalarWhereInput | trackScalarWhereInput[]
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type trackUncheckedUpdateManyWithoutAlbumNestedInput = {
    create?: XOR<trackCreateWithoutAlbumInput, trackUncheckedCreateWithoutAlbumInput> | trackCreateWithoutAlbumInput[] | trackUncheckedCreateWithoutAlbumInput[]
    connectOrCreate?: trackCreateOrConnectWithoutAlbumInput | trackCreateOrConnectWithoutAlbumInput[]
    upsert?: trackUpsertWithWhereUniqueWithoutAlbumInput | trackUpsertWithWhereUniqueWithoutAlbumInput[]
    createMany?: trackCreateManyAlbumInputEnvelope
    set?: trackWhereUniqueInput | trackWhereUniqueInput[]
    disconnect?: trackWhereUniqueInput | trackWhereUniqueInput[]
    delete?: trackWhereUniqueInput | trackWhereUniqueInput[]
    connect?: trackWhereUniqueInput | trackWhereUniqueInput[]
    update?: trackUpdateWithWhereUniqueWithoutAlbumInput | trackUpdateWithWhereUniqueWithoutAlbumInput[]
    updateMany?: trackUpdateManyWithWhereWithoutAlbumInput | trackUpdateManyWithWhereWithoutAlbumInput[]
    deleteMany?: trackScalarWhereInput | trackScalarWhereInput[]
  }

  export type albumCreateNestedManyWithoutArtistInput = {
    create?: XOR<albumCreateWithoutArtistInput, albumUncheckedCreateWithoutArtistInput> | albumCreateWithoutArtistInput[] | albumUncheckedCreateWithoutArtistInput[]
    connectOrCreate?: albumCreateOrConnectWithoutArtistInput | albumCreateOrConnectWithoutArtistInput[]
    createMany?: albumCreateManyArtistInputEnvelope
    connect?: albumWhereUniqueInput | albumWhereUniqueInput[]
  }

  export type albumUncheckedCreateNestedManyWithoutArtistInput = {
    create?: XOR<albumCreateWithoutArtistInput, albumUncheckedCreateWithoutArtistInput> | albumCreateWithoutArtistInput[] | albumUncheckedCreateWithoutArtistInput[]
    connectOrCreate?: albumCreateOrConnectWithoutArtistInput | albumCreateOrConnectWithoutArtistInput[]
    createMany?: albumCreateManyArtistInputEnvelope
    connect?: albumWhereUniqueInput | albumWhereUniqueInput[]
  }

  export type albumUpdateManyWithoutArtistNestedInput = {
    create?: XOR<albumCreateWithoutArtistInput, albumUncheckedCreateWithoutArtistInput> | albumCreateWithoutArtistInput[] | albumUncheckedCreateWithoutArtistInput[]
    connectOrCreate?: albumCreateOrConnectWithoutArtistInput | albumCreateOrConnectWithoutArtistInput[]
    upsert?: albumUpsertWithWhereUniqueWithoutArtistInput | albumUpsertWithWhereUniqueWithoutArtistInput[]
    createMany?: albumCreateManyArtistInputEnvelope
    set?: albumWhereUniqueInput | albumWhereUniqueInput[]
    disconnect?: albumWhereUniqueInput | albumWhereUniqueInput[]
    delete?: albumWhereUniqueInput | albumWhereUniqueInput[]
    connect?: albumWhereUniqueInput | albumWhereUniqueInput[]
    update?: albumUpdateWithWhereUniqueWithoutArtistInput | albumUpdateWithWhereUniqueWithoutArtistInput[]
    updateMany?: albumUpdateManyWithWhereWithoutArtistInput | albumUpdateManyWithWhereWithoutArtistInput[]
    deleteMany?: albumScalarWhereInput | albumScalarWhereInput[]
  }

  export type albumUncheckedUpdateManyWithoutArtistNestedInput = {
    create?: XOR<albumCreateWithoutArtistInput, albumUncheckedCreateWithoutArtistInput> | albumCreateWithoutArtistInput[] | albumUncheckedCreateWithoutArtistInput[]
    connectOrCreate?: albumCreateOrConnectWithoutArtistInput | albumCreateOrConnectWithoutArtistInput[]
    upsert?: albumUpsertWithWhereUniqueWithoutArtistInput | albumUpsertWithWhereUniqueWithoutArtistInput[]
    createMany?: albumCreateManyArtistInputEnvelope
    set?: albumWhereUniqueInput | albumWhereUniqueInput[]
    disconnect?: albumWhereUniqueInput | albumWhereUniqueInput[]
    delete?: albumWhereUniqueInput | albumWhereUniqueInput[]
    connect?: albumWhereUniqueInput | albumWhereUniqueInput[]
    update?: albumUpdateWithWhereUniqueWithoutArtistInput | albumUpdateWithWhereUniqueWithoutArtistInput[]
    updateMany?: albumUpdateManyWithWhereWithoutArtistInput | albumUpdateManyWithWhereWithoutArtistInput[]
    deleteMany?: albumScalarWhereInput | albumScalarWhereInput[]
  }

  export type employeeCreateNestedOneWithoutCustomerInput = {
    create?: XOR<employeeCreateWithoutCustomerInput, employeeUncheckedCreateWithoutCustomerInput>
    connectOrCreate?: employeeCreateOrConnectWithoutCustomerInput
    connect?: employeeWhereUniqueInput
  }

  export type customer_reviewCreateNestedManyWithoutCustomerInput = {
    create?: XOR<customer_reviewCreateWithoutCustomerInput, customer_reviewUncheckedCreateWithoutCustomerInput> | customer_reviewCreateWithoutCustomerInput[] | customer_reviewUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: customer_reviewCreateOrConnectWithoutCustomerInput | customer_reviewCreateOrConnectWithoutCustomerInput[]
    createMany?: customer_reviewCreateManyCustomerInputEnvelope
    connect?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
  }

  export type invoiceCreateNestedManyWithoutCustomerInput = {
    create?: XOR<invoiceCreateWithoutCustomerInput, invoiceUncheckedCreateWithoutCustomerInput> | invoiceCreateWithoutCustomerInput[] | invoiceUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: invoiceCreateOrConnectWithoutCustomerInput | invoiceCreateOrConnectWithoutCustomerInput[]
    createMany?: invoiceCreateManyCustomerInputEnvelope
    connect?: invoiceWhereUniqueInput | invoiceWhereUniqueInput[]
  }

  export type customer_reviewUncheckedCreateNestedManyWithoutCustomerInput = {
    create?: XOR<customer_reviewCreateWithoutCustomerInput, customer_reviewUncheckedCreateWithoutCustomerInput> | customer_reviewCreateWithoutCustomerInput[] | customer_reviewUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: customer_reviewCreateOrConnectWithoutCustomerInput | customer_reviewCreateOrConnectWithoutCustomerInput[]
    createMany?: customer_reviewCreateManyCustomerInputEnvelope
    connect?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
  }

  export type invoiceUncheckedCreateNestedManyWithoutCustomerInput = {
    create?: XOR<invoiceCreateWithoutCustomerInput, invoiceUncheckedCreateWithoutCustomerInput> | invoiceCreateWithoutCustomerInput[] | invoiceUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: invoiceCreateOrConnectWithoutCustomerInput | invoiceCreateOrConnectWithoutCustomerInput[]
    createMany?: invoiceCreateManyCustomerInputEnvelope
    connect?: invoiceWhereUniqueInput | invoiceWhereUniqueInput[]
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type employeeUpdateOneWithoutCustomerNestedInput = {
    create?: XOR<employeeCreateWithoutCustomerInput, employeeUncheckedCreateWithoutCustomerInput>
    connectOrCreate?: employeeCreateOrConnectWithoutCustomerInput
    upsert?: employeeUpsertWithoutCustomerInput
    disconnect?: employeeWhereInput | boolean
    delete?: employeeWhereInput | boolean
    connect?: employeeWhereUniqueInput
    update?: XOR<XOR<employeeUpdateToOneWithWhereWithoutCustomerInput, employeeUpdateWithoutCustomerInput>, employeeUncheckedUpdateWithoutCustomerInput>
  }

  export type customer_reviewUpdateManyWithoutCustomerNestedInput = {
    create?: XOR<customer_reviewCreateWithoutCustomerInput, customer_reviewUncheckedCreateWithoutCustomerInput> | customer_reviewCreateWithoutCustomerInput[] | customer_reviewUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: customer_reviewCreateOrConnectWithoutCustomerInput | customer_reviewCreateOrConnectWithoutCustomerInput[]
    upsert?: customer_reviewUpsertWithWhereUniqueWithoutCustomerInput | customer_reviewUpsertWithWhereUniqueWithoutCustomerInput[]
    createMany?: customer_reviewCreateManyCustomerInputEnvelope
    set?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
    disconnect?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
    delete?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
    connect?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
    update?: customer_reviewUpdateWithWhereUniqueWithoutCustomerInput | customer_reviewUpdateWithWhereUniqueWithoutCustomerInput[]
    updateMany?: customer_reviewUpdateManyWithWhereWithoutCustomerInput | customer_reviewUpdateManyWithWhereWithoutCustomerInput[]
    deleteMany?: customer_reviewScalarWhereInput | customer_reviewScalarWhereInput[]
  }

  export type invoiceUpdateManyWithoutCustomerNestedInput = {
    create?: XOR<invoiceCreateWithoutCustomerInput, invoiceUncheckedCreateWithoutCustomerInput> | invoiceCreateWithoutCustomerInput[] | invoiceUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: invoiceCreateOrConnectWithoutCustomerInput | invoiceCreateOrConnectWithoutCustomerInput[]
    upsert?: invoiceUpsertWithWhereUniqueWithoutCustomerInput | invoiceUpsertWithWhereUniqueWithoutCustomerInput[]
    createMany?: invoiceCreateManyCustomerInputEnvelope
    set?: invoiceWhereUniqueInput | invoiceWhereUniqueInput[]
    disconnect?: invoiceWhereUniqueInput | invoiceWhereUniqueInput[]
    delete?: invoiceWhereUniqueInput | invoiceWhereUniqueInput[]
    connect?: invoiceWhereUniqueInput | invoiceWhereUniqueInput[]
    update?: invoiceUpdateWithWhereUniqueWithoutCustomerInput | invoiceUpdateWithWhereUniqueWithoutCustomerInput[]
    updateMany?: invoiceUpdateManyWithWhereWithoutCustomerInput | invoiceUpdateManyWithWhereWithoutCustomerInput[]
    deleteMany?: invoiceScalarWhereInput | invoiceScalarWhereInput[]
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type customer_reviewUncheckedUpdateManyWithoutCustomerNestedInput = {
    create?: XOR<customer_reviewCreateWithoutCustomerInput, customer_reviewUncheckedCreateWithoutCustomerInput> | customer_reviewCreateWithoutCustomerInput[] | customer_reviewUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: customer_reviewCreateOrConnectWithoutCustomerInput | customer_reviewCreateOrConnectWithoutCustomerInput[]
    upsert?: customer_reviewUpsertWithWhereUniqueWithoutCustomerInput | customer_reviewUpsertWithWhereUniqueWithoutCustomerInput[]
    createMany?: customer_reviewCreateManyCustomerInputEnvelope
    set?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
    disconnect?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
    delete?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
    connect?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
    update?: customer_reviewUpdateWithWhereUniqueWithoutCustomerInput | customer_reviewUpdateWithWhereUniqueWithoutCustomerInput[]
    updateMany?: customer_reviewUpdateManyWithWhereWithoutCustomerInput | customer_reviewUpdateManyWithWhereWithoutCustomerInput[]
    deleteMany?: customer_reviewScalarWhereInput | customer_reviewScalarWhereInput[]
  }

  export type invoiceUncheckedUpdateManyWithoutCustomerNestedInput = {
    create?: XOR<invoiceCreateWithoutCustomerInput, invoiceUncheckedCreateWithoutCustomerInput> | invoiceCreateWithoutCustomerInput[] | invoiceUncheckedCreateWithoutCustomerInput[]
    connectOrCreate?: invoiceCreateOrConnectWithoutCustomerInput | invoiceCreateOrConnectWithoutCustomerInput[]
    upsert?: invoiceUpsertWithWhereUniqueWithoutCustomerInput | invoiceUpsertWithWhereUniqueWithoutCustomerInput[]
    createMany?: invoiceCreateManyCustomerInputEnvelope
    set?: invoiceWhereUniqueInput | invoiceWhereUniqueInput[]
    disconnect?: invoiceWhereUniqueInput | invoiceWhereUniqueInput[]
    delete?: invoiceWhereUniqueInput | invoiceWhereUniqueInput[]
    connect?: invoiceWhereUniqueInput | invoiceWhereUniqueInput[]
    update?: invoiceUpdateWithWhereUniqueWithoutCustomerInput | invoiceUpdateWithWhereUniqueWithoutCustomerInput[]
    updateMany?: invoiceUpdateManyWithWhereWithoutCustomerInput | invoiceUpdateManyWithWhereWithoutCustomerInput[]
    deleteMany?: invoiceScalarWhereInput | invoiceScalarWhereInput[]
  }

  export type customerCreateNestedOneWithoutCustomer_reviewInput = {
    create?: XOR<customerCreateWithoutCustomer_reviewInput, customerUncheckedCreateWithoutCustomer_reviewInput>
    connectOrCreate?: customerCreateOrConnectWithoutCustomer_reviewInput
    connect?: customerWhereUniqueInput
  }

  export type invoiceCreateNestedOneWithoutCustomer_reviewInput = {
    create?: XOR<invoiceCreateWithoutCustomer_reviewInput, invoiceUncheckedCreateWithoutCustomer_reviewInput>
    connectOrCreate?: invoiceCreateOrConnectWithoutCustomer_reviewInput
    connect?: invoiceWhereUniqueInput
  }

  export type customerUpdateOneRequiredWithoutCustomer_reviewNestedInput = {
    create?: XOR<customerCreateWithoutCustomer_reviewInput, customerUncheckedCreateWithoutCustomer_reviewInput>
    connectOrCreate?: customerCreateOrConnectWithoutCustomer_reviewInput
    upsert?: customerUpsertWithoutCustomer_reviewInput
    connect?: customerWhereUniqueInput
    update?: XOR<XOR<customerUpdateToOneWithWhereWithoutCustomer_reviewInput, customerUpdateWithoutCustomer_reviewInput>, customerUncheckedUpdateWithoutCustomer_reviewInput>
  }

  export type invoiceUpdateOneRequiredWithoutCustomer_reviewNestedInput = {
    create?: XOR<invoiceCreateWithoutCustomer_reviewInput, invoiceUncheckedCreateWithoutCustomer_reviewInput>
    connectOrCreate?: invoiceCreateOrConnectWithoutCustomer_reviewInput
    upsert?: invoiceUpsertWithoutCustomer_reviewInput
    connect?: invoiceWhereUniqueInput
    update?: XOR<XOR<invoiceUpdateToOneWithWhereWithoutCustomer_reviewInput, invoiceUpdateWithoutCustomer_reviewInput>, invoiceUncheckedUpdateWithoutCustomer_reviewInput>
  }

  export type customerCreateNestedManyWithoutEmployeeInput = {
    create?: XOR<customerCreateWithoutEmployeeInput, customerUncheckedCreateWithoutEmployeeInput> | customerCreateWithoutEmployeeInput[] | customerUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: customerCreateOrConnectWithoutEmployeeInput | customerCreateOrConnectWithoutEmployeeInput[]
    createMany?: customerCreateManyEmployeeInputEnvelope
    connect?: customerWhereUniqueInput | customerWhereUniqueInput[]
  }

  export type employeeCreateNestedOneWithoutOther_employeeInput = {
    create?: XOR<employeeCreateWithoutOther_employeeInput, employeeUncheckedCreateWithoutOther_employeeInput>
    connectOrCreate?: employeeCreateOrConnectWithoutOther_employeeInput
    connect?: employeeWhereUniqueInput
  }

  export type employeeCreateNestedManyWithoutEmployeeInput = {
    create?: XOR<employeeCreateWithoutEmployeeInput, employeeUncheckedCreateWithoutEmployeeInput> | employeeCreateWithoutEmployeeInput[] | employeeUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: employeeCreateOrConnectWithoutEmployeeInput | employeeCreateOrConnectWithoutEmployeeInput[]
    createMany?: employeeCreateManyEmployeeInputEnvelope
    connect?: employeeWhereUniqueInput | employeeWhereUniqueInput[]
  }

  export type track_discountCreateNestedManyWithoutEmployeeInput = {
    create?: XOR<track_discountCreateWithoutEmployeeInput, track_discountUncheckedCreateWithoutEmployeeInput> | track_discountCreateWithoutEmployeeInput[] | track_discountUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: track_discountCreateOrConnectWithoutEmployeeInput | track_discountCreateOrConnectWithoutEmployeeInput[]
    createMany?: track_discountCreateManyEmployeeInputEnvelope
    connect?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
  }

  export type customerUncheckedCreateNestedManyWithoutEmployeeInput = {
    create?: XOR<customerCreateWithoutEmployeeInput, customerUncheckedCreateWithoutEmployeeInput> | customerCreateWithoutEmployeeInput[] | customerUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: customerCreateOrConnectWithoutEmployeeInput | customerCreateOrConnectWithoutEmployeeInput[]
    createMany?: customerCreateManyEmployeeInputEnvelope
    connect?: customerWhereUniqueInput | customerWhereUniqueInput[]
  }

  export type employeeUncheckedCreateNestedManyWithoutEmployeeInput = {
    create?: XOR<employeeCreateWithoutEmployeeInput, employeeUncheckedCreateWithoutEmployeeInput> | employeeCreateWithoutEmployeeInput[] | employeeUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: employeeCreateOrConnectWithoutEmployeeInput | employeeCreateOrConnectWithoutEmployeeInput[]
    createMany?: employeeCreateManyEmployeeInputEnvelope
    connect?: employeeWhereUniqueInput | employeeWhereUniqueInput[]
  }

  export type track_discountUncheckedCreateNestedManyWithoutEmployeeInput = {
    create?: XOR<track_discountCreateWithoutEmployeeInput, track_discountUncheckedCreateWithoutEmployeeInput> | track_discountCreateWithoutEmployeeInput[] | track_discountUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: track_discountCreateOrConnectWithoutEmployeeInput | track_discountCreateOrConnectWithoutEmployeeInput[]
    createMany?: track_discountCreateManyEmployeeInputEnvelope
    connect?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type customerUpdateManyWithoutEmployeeNestedInput = {
    create?: XOR<customerCreateWithoutEmployeeInput, customerUncheckedCreateWithoutEmployeeInput> | customerCreateWithoutEmployeeInput[] | customerUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: customerCreateOrConnectWithoutEmployeeInput | customerCreateOrConnectWithoutEmployeeInput[]
    upsert?: customerUpsertWithWhereUniqueWithoutEmployeeInput | customerUpsertWithWhereUniqueWithoutEmployeeInput[]
    createMany?: customerCreateManyEmployeeInputEnvelope
    set?: customerWhereUniqueInput | customerWhereUniqueInput[]
    disconnect?: customerWhereUniqueInput | customerWhereUniqueInput[]
    delete?: customerWhereUniqueInput | customerWhereUniqueInput[]
    connect?: customerWhereUniqueInput | customerWhereUniqueInput[]
    update?: customerUpdateWithWhereUniqueWithoutEmployeeInput | customerUpdateWithWhereUniqueWithoutEmployeeInput[]
    updateMany?: customerUpdateManyWithWhereWithoutEmployeeInput | customerUpdateManyWithWhereWithoutEmployeeInput[]
    deleteMany?: customerScalarWhereInput | customerScalarWhereInput[]
  }

  export type employeeUpdateOneWithoutOther_employeeNestedInput = {
    create?: XOR<employeeCreateWithoutOther_employeeInput, employeeUncheckedCreateWithoutOther_employeeInput>
    connectOrCreate?: employeeCreateOrConnectWithoutOther_employeeInput
    upsert?: employeeUpsertWithoutOther_employeeInput
    disconnect?: employeeWhereInput | boolean
    delete?: employeeWhereInput | boolean
    connect?: employeeWhereUniqueInput
    update?: XOR<XOR<employeeUpdateToOneWithWhereWithoutOther_employeeInput, employeeUpdateWithoutOther_employeeInput>, employeeUncheckedUpdateWithoutOther_employeeInput>
  }

  export type employeeUpdateManyWithoutEmployeeNestedInput = {
    create?: XOR<employeeCreateWithoutEmployeeInput, employeeUncheckedCreateWithoutEmployeeInput> | employeeCreateWithoutEmployeeInput[] | employeeUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: employeeCreateOrConnectWithoutEmployeeInput | employeeCreateOrConnectWithoutEmployeeInput[]
    upsert?: employeeUpsertWithWhereUniqueWithoutEmployeeInput | employeeUpsertWithWhereUniqueWithoutEmployeeInput[]
    createMany?: employeeCreateManyEmployeeInputEnvelope
    set?: employeeWhereUniqueInput | employeeWhereUniqueInput[]
    disconnect?: employeeWhereUniqueInput | employeeWhereUniqueInput[]
    delete?: employeeWhereUniqueInput | employeeWhereUniqueInput[]
    connect?: employeeWhereUniqueInput | employeeWhereUniqueInput[]
    update?: employeeUpdateWithWhereUniqueWithoutEmployeeInput | employeeUpdateWithWhereUniqueWithoutEmployeeInput[]
    updateMany?: employeeUpdateManyWithWhereWithoutEmployeeInput | employeeUpdateManyWithWhereWithoutEmployeeInput[]
    deleteMany?: employeeScalarWhereInput | employeeScalarWhereInput[]
  }

  export type track_discountUpdateManyWithoutEmployeeNestedInput = {
    create?: XOR<track_discountCreateWithoutEmployeeInput, track_discountUncheckedCreateWithoutEmployeeInput> | track_discountCreateWithoutEmployeeInput[] | track_discountUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: track_discountCreateOrConnectWithoutEmployeeInput | track_discountCreateOrConnectWithoutEmployeeInput[]
    upsert?: track_discountUpsertWithWhereUniqueWithoutEmployeeInput | track_discountUpsertWithWhereUniqueWithoutEmployeeInput[]
    createMany?: track_discountCreateManyEmployeeInputEnvelope
    set?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
    disconnect?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
    delete?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
    connect?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
    update?: track_discountUpdateWithWhereUniqueWithoutEmployeeInput | track_discountUpdateWithWhereUniqueWithoutEmployeeInput[]
    updateMany?: track_discountUpdateManyWithWhereWithoutEmployeeInput | track_discountUpdateManyWithWhereWithoutEmployeeInput[]
    deleteMany?: track_discountScalarWhereInput | track_discountScalarWhereInput[]
  }

  export type customerUncheckedUpdateManyWithoutEmployeeNestedInput = {
    create?: XOR<customerCreateWithoutEmployeeInput, customerUncheckedCreateWithoutEmployeeInput> | customerCreateWithoutEmployeeInput[] | customerUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: customerCreateOrConnectWithoutEmployeeInput | customerCreateOrConnectWithoutEmployeeInput[]
    upsert?: customerUpsertWithWhereUniqueWithoutEmployeeInput | customerUpsertWithWhereUniqueWithoutEmployeeInput[]
    createMany?: customerCreateManyEmployeeInputEnvelope
    set?: customerWhereUniqueInput | customerWhereUniqueInput[]
    disconnect?: customerWhereUniqueInput | customerWhereUniqueInput[]
    delete?: customerWhereUniqueInput | customerWhereUniqueInput[]
    connect?: customerWhereUniqueInput | customerWhereUniqueInput[]
    update?: customerUpdateWithWhereUniqueWithoutEmployeeInput | customerUpdateWithWhereUniqueWithoutEmployeeInput[]
    updateMany?: customerUpdateManyWithWhereWithoutEmployeeInput | customerUpdateManyWithWhereWithoutEmployeeInput[]
    deleteMany?: customerScalarWhereInput | customerScalarWhereInput[]
  }

  export type employeeUncheckedUpdateManyWithoutEmployeeNestedInput = {
    create?: XOR<employeeCreateWithoutEmployeeInput, employeeUncheckedCreateWithoutEmployeeInput> | employeeCreateWithoutEmployeeInput[] | employeeUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: employeeCreateOrConnectWithoutEmployeeInput | employeeCreateOrConnectWithoutEmployeeInput[]
    upsert?: employeeUpsertWithWhereUniqueWithoutEmployeeInput | employeeUpsertWithWhereUniqueWithoutEmployeeInput[]
    createMany?: employeeCreateManyEmployeeInputEnvelope
    set?: employeeWhereUniqueInput | employeeWhereUniqueInput[]
    disconnect?: employeeWhereUniqueInput | employeeWhereUniqueInput[]
    delete?: employeeWhereUniqueInput | employeeWhereUniqueInput[]
    connect?: employeeWhereUniqueInput | employeeWhereUniqueInput[]
    update?: employeeUpdateWithWhereUniqueWithoutEmployeeInput | employeeUpdateWithWhereUniqueWithoutEmployeeInput[]
    updateMany?: employeeUpdateManyWithWhereWithoutEmployeeInput | employeeUpdateManyWithWhereWithoutEmployeeInput[]
    deleteMany?: employeeScalarWhereInput | employeeScalarWhereInput[]
  }

  export type track_discountUncheckedUpdateManyWithoutEmployeeNestedInput = {
    create?: XOR<track_discountCreateWithoutEmployeeInput, track_discountUncheckedCreateWithoutEmployeeInput> | track_discountCreateWithoutEmployeeInput[] | track_discountUncheckedCreateWithoutEmployeeInput[]
    connectOrCreate?: track_discountCreateOrConnectWithoutEmployeeInput | track_discountCreateOrConnectWithoutEmployeeInput[]
    upsert?: track_discountUpsertWithWhereUniqueWithoutEmployeeInput | track_discountUpsertWithWhereUniqueWithoutEmployeeInput[]
    createMany?: track_discountCreateManyEmployeeInputEnvelope
    set?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
    disconnect?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
    delete?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
    connect?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
    update?: track_discountUpdateWithWhereUniqueWithoutEmployeeInput | track_discountUpdateWithWhereUniqueWithoutEmployeeInput[]
    updateMany?: track_discountUpdateManyWithWhereWithoutEmployeeInput | track_discountUpdateManyWithWhereWithoutEmployeeInput[]
    deleteMany?: track_discountScalarWhereInput | track_discountScalarWhereInput[]
  }

  export type customer_reviewCreateNestedManyWithoutInvoiceInput = {
    create?: XOR<customer_reviewCreateWithoutInvoiceInput, customer_reviewUncheckedCreateWithoutInvoiceInput> | customer_reviewCreateWithoutInvoiceInput[] | customer_reviewUncheckedCreateWithoutInvoiceInput[]
    connectOrCreate?: customer_reviewCreateOrConnectWithoutInvoiceInput | customer_reviewCreateOrConnectWithoutInvoiceInput[]
    createMany?: customer_reviewCreateManyInvoiceInputEnvelope
    connect?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
  }

  export type customerCreateNestedOneWithoutInvoiceInput = {
    create?: XOR<customerCreateWithoutInvoiceInput, customerUncheckedCreateWithoutInvoiceInput>
    connectOrCreate?: customerCreateOrConnectWithoutInvoiceInput
    connect?: customerWhereUniqueInput
  }

  export type invoice_lineCreateNestedManyWithoutInvoiceInput = {
    create?: XOR<invoice_lineCreateWithoutInvoiceInput, invoice_lineUncheckedCreateWithoutInvoiceInput> | invoice_lineCreateWithoutInvoiceInput[] | invoice_lineUncheckedCreateWithoutInvoiceInput[]
    connectOrCreate?: invoice_lineCreateOrConnectWithoutInvoiceInput | invoice_lineCreateOrConnectWithoutInvoiceInput[]
    createMany?: invoice_lineCreateManyInvoiceInputEnvelope
    connect?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
  }

  export type customer_reviewUncheckedCreateNestedManyWithoutInvoiceInput = {
    create?: XOR<customer_reviewCreateWithoutInvoiceInput, customer_reviewUncheckedCreateWithoutInvoiceInput> | customer_reviewCreateWithoutInvoiceInput[] | customer_reviewUncheckedCreateWithoutInvoiceInput[]
    connectOrCreate?: customer_reviewCreateOrConnectWithoutInvoiceInput | customer_reviewCreateOrConnectWithoutInvoiceInput[]
    createMany?: customer_reviewCreateManyInvoiceInputEnvelope
    connect?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
  }

  export type invoice_lineUncheckedCreateNestedManyWithoutInvoiceInput = {
    create?: XOR<invoice_lineCreateWithoutInvoiceInput, invoice_lineUncheckedCreateWithoutInvoiceInput> | invoice_lineCreateWithoutInvoiceInput[] | invoice_lineUncheckedCreateWithoutInvoiceInput[]
    connectOrCreate?: invoice_lineCreateOrConnectWithoutInvoiceInput | invoice_lineCreateOrConnectWithoutInvoiceInput[]
    createMany?: invoice_lineCreateManyInvoiceInputEnvelope
    connect?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
  }

  export type DecimalFieldUpdateOperationsInput = {
    set?: Decimal | DecimalJsLike | number | string
    increment?: Decimal | DecimalJsLike | number | string
    decrement?: Decimal | DecimalJsLike | number | string
    multiply?: Decimal | DecimalJsLike | number | string
    divide?: Decimal | DecimalJsLike | number | string
  }

  export type customer_reviewUpdateManyWithoutInvoiceNestedInput = {
    create?: XOR<customer_reviewCreateWithoutInvoiceInput, customer_reviewUncheckedCreateWithoutInvoiceInput> | customer_reviewCreateWithoutInvoiceInput[] | customer_reviewUncheckedCreateWithoutInvoiceInput[]
    connectOrCreate?: customer_reviewCreateOrConnectWithoutInvoiceInput | customer_reviewCreateOrConnectWithoutInvoiceInput[]
    upsert?: customer_reviewUpsertWithWhereUniqueWithoutInvoiceInput | customer_reviewUpsertWithWhereUniqueWithoutInvoiceInput[]
    createMany?: customer_reviewCreateManyInvoiceInputEnvelope
    set?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
    disconnect?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
    delete?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
    connect?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
    update?: customer_reviewUpdateWithWhereUniqueWithoutInvoiceInput | customer_reviewUpdateWithWhereUniqueWithoutInvoiceInput[]
    updateMany?: customer_reviewUpdateManyWithWhereWithoutInvoiceInput | customer_reviewUpdateManyWithWhereWithoutInvoiceInput[]
    deleteMany?: customer_reviewScalarWhereInput | customer_reviewScalarWhereInput[]
  }

  export type customerUpdateOneRequiredWithoutInvoiceNestedInput = {
    create?: XOR<customerCreateWithoutInvoiceInput, customerUncheckedCreateWithoutInvoiceInput>
    connectOrCreate?: customerCreateOrConnectWithoutInvoiceInput
    upsert?: customerUpsertWithoutInvoiceInput
    connect?: customerWhereUniqueInput
    update?: XOR<XOR<customerUpdateToOneWithWhereWithoutInvoiceInput, customerUpdateWithoutInvoiceInput>, customerUncheckedUpdateWithoutInvoiceInput>
  }

  export type invoice_lineUpdateManyWithoutInvoiceNestedInput = {
    create?: XOR<invoice_lineCreateWithoutInvoiceInput, invoice_lineUncheckedCreateWithoutInvoiceInput> | invoice_lineCreateWithoutInvoiceInput[] | invoice_lineUncheckedCreateWithoutInvoiceInput[]
    connectOrCreate?: invoice_lineCreateOrConnectWithoutInvoiceInput | invoice_lineCreateOrConnectWithoutInvoiceInput[]
    upsert?: invoice_lineUpsertWithWhereUniqueWithoutInvoiceInput | invoice_lineUpsertWithWhereUniqueWithoutInvoiceInput[]
    createMany?: invoice_lineCreateManyInvoiceInputEnvelope
    set?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
    disconnect?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
    delete?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
    connect?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
    update?: invoice_lineUpdateWithWhereUniqueWithoutInvoiceInput | invoice_lineUpdateWithWhereUniqueWithoutInvoiceInput[]
    updateMany?: invoice_lineUpdateManyWithWhereWithoutInvoiceInput | invoice_lineUpdateManyWithWhereWithoutInvoiceInput[]
    deleteMany?: invoice_lineScalarWhereInput | invoice_lineScalarWhereInput[]
  }

  export type customer_reviewUncheckedUpdateManyWithoutInvoiceNestedInput = {
    create?: XOR<customer_reviewCreateWithoutInvoiceInput, customer_reviewUncheckedCreateWithoutInvoiceInput> | customer_reviewCreateWithoutInvoiceInput[] | customer_reviewUncheckedCreateWithoutInvoiceInput[]
    connectOrCreate?: customer_reviewCreateOrConnectWithoutInvoiceInput | customer_reviewCreateOrConnectWithoutInvoiceInput[]
    upsert?: customer_reviewUpsertWithWhereUniqueWithoutInvoiceInput | customer_reviewUpsertWithWhereUniqueWithoutInvoiceInput[]
    createMany?: customer_reviewCreateManyInvoiceInputEnvelope
    set?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
    disconnect?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
    delete?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
    connect?: customer_reviewWhereUniqueInput | customer_reviewWhereUniqueInput[]
    update?: customer_reviewUpdateWithWhereUniqueWithoutInvoiceInput | customer_reviewUpdateWithWhereUniqueWithoutInvoiceInput[]
    updateMany?: customer_reviewUpdateManyWithWhereWithoutInvoiceInput | customer_reviewUpdateManyWithWhereWithoutInvoiceInput[]
    deleteMany?: customer_reviewScalarWhereInput | customer_reviewScalarWhereInput[]
  }

  export type invoice_lineUncheckedUpdateManyWithoutInvoiceNestedInput = {
    create?: XOR<invoice_lineCreateWithoutInvoiceInput, invoice_lineUncheckedCreateWithoutInvoiceInput> | invoice_lineCreateWithoutInvoiceInput[] | invoice_lineUncheckedCreateWithoutInvoiceInput[]
    connectOrCreate?: invoice_lineCreateOrConnectWithoutInvoiceInput | invoice_lineCreateOrConnectWithoutInvoiceInput[]
    upsert?: invoice_lineUpsertWithWhereUniqueWithoutInvoiceInput | invoice_lineUpsertWithWhereUniqueWithoutInvoiceInput[]
    createMany?: invoice_lineCreateManyInvoiceInputEnvelope
    set?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
    disconnect?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
    delete?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
    connect?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
    update?: invoice_lineUpdateWithWhereUniqueWithoutInvoiceInput | invoice_lineUpdateWithWhereUniqueWithoutInvoiceInput[]
    updateMany?: invoice_lineUpdateManyWithWhereWithoutInvoiceInput | invoice_lineUpdateManyWithWhereWithoutInvoiceInput[]
    deleteMany?: invoice_lineScalarWhereInput | invoice_lineScalarWhereInput[]
  }

  export type invoiceCreateNestedOneWithoutInvoice_lineInput = {
    create?: XOR<invoiceCreateWithoutInvoice_lineInput, invoiceUncheckedCreateWithoutInvoice_lineInput>
    connectOrCreate?: invoiceCreateOrConnectWithoutInvoice_lineInput
    connect?: invoiceWhereUniqueInput
  }

  export type trackCreateNestedOneWithoutInvoice_lineInput = {
    create?: XOR<trackCreateWithoutInvoice_lineInput, trackUncheckedCreateWithoutInvoice_lineInput>
    connectOrCreate?: trackCreateOrConnectWithoutInvoice_lineInput
    connect?: trackWhereUniqueInput
  }

  export type invoiceUpdateOneRequiredWithoutInvoice_lineNestedInput = {
    create?: XOR<invoiceCreateWithoutInvoice_lineInput, invoiceUncheckedCreateWithoutInvoice_lineInput>
    connectOrCreate?: invoiceCreateOrConnectWithoutInvoice_lineInput
    upsert?: invoiceUpsertWithoutInvoice_lineInput
    connect?: invoiceWhereUniqueInput
    update?: XOR<XOR<invoiceUpdateToOneWithWhereWithoutInvoice_lineInput, invoiceUpdateWithoutInvoice_lineInput>, invoiceUncheckedUpdateWithoutInvoice_lineInput>
  }

  export type trackUpdateOneRequiredWithoutInvoice_lineNestedInput = {
    create?: XOR<trackCreateWithoutInvoice_lineInput, trackUncheckedCreateWithoutInvoice_lineInput>
    connectOrCreate?: trackCreateOrConnectWithoutInvoice_lineInput
    upsert?: trackUpsertWithoutInvoice_lineInput
    connect?: trackWhereUniqueInput
    update?: XOR<XOR<trackUpdateToOneWithWhereWithoutInvoice_lineInput, trackUpdateWithoutInvoice_lineInput>, trackUncheckedUpdateWithoutInvoice_lineInput>
  }

  export type playlist_trackCreateNestedManyWithoutPlaylistInput = {
    create?: XOR<playlist_trackCreateWithoutPlaylistInput, playlist_trackUncheckedCreateWithoutPlaylistInput> | playlist_trackCreateWithoutPlaylistInput[] | playlist_trackUncheckedCreateWithoutPlaylistInput[]
    connectOrCreate?: playlist_trackCreateOrConnectWithoutPlaylistInput | playlist_trackCreateOrConnectWithoutPlaylistInput[]
    createMany?: playlist_trackCreateManyPlaylistInputEnvelope
    connect?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
  }

  export type playlist_trackUncheckedCreateNestedManyWithoutPlaylistInput = {
    create?: XOR<playlist_trackCreateWithoutPlaylistInput, playlist_trackUncheckedCreateWithoutPlaylistInput> | playlist_trackCreateWithoutPlaylistInput[] | playlist_trackUncheckedCreateWithoutPlaylistInput[]
    connectOrCreate?: playlist_trackCreateOrConnectWithoutPlaylistInput | playlist_trackCreateOrConnectWithoutPlaylistInput[]
    createMany?: playlist_trackCreateManyPlaylistInputEnvelope
    connect?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
  }

  export type playlist_trackUpdateManyWithoutPlaylistNestedInput = {
    create?: XOR<playlist_trackCreateWithoutPlaylistInput, playlist_trackUncheckedCreateWithoutPlaylistInput> | playlist_trackCreateWithoutPlaylistInput[] | playlist_trackUncheckedCreateWithoutPlaylistInput[]
    connectOrCreate?: playlist_trackCreateOrConnectWithoutPlaylistInput | playlist_trackCreateOrConnectWithoutPlaylistInput[]
    upsert?: playlist_trackUpsertWithWhereUniqueWithoutPlaylistInput | playlist_trackUpsertWithWhereUniqueWithoutPlaylistInput[]
    createMany?: playlist_trackCreateManyPlaylistInputEnvelope
    set?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
    disconnect?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
    delete?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
    connect?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
    update?: playlist_trackUpdateWithWhereUniqueWithoutPlaylistInput | playlist_trackUpdateWithWhereUniqueWithoutPlaylistInput[]
    updateMany?: playlist_trackUpdateManyWithWhereWithoutPlaylistInput | playlist_trackUpdateManyWithWhereWithoutPlaylistInput[]
    deleteMany?: playlist_trackScalarWhereInput | playlist_trackScalarWhereInput[]
  }

  export type playlist_trackUncheckedUpdateManyWithoutPlaylistNestedInput = {
    create?: XOR<playlist_trackCreateWithoutPlaylistInput, playlist_trackUncheckedCreateWithoutPlaylistInput> | playlist_trackCreateWithoutPlaylistInput[] | playlist_trackUncheckedCreateWithoutPlaylistInput[]
    connectOrCreate?: playlist_trackCreateOrConnectWithoutPlaylistInput | playlist_trackCreateOrConnectWithoutPlaylistInput[]
    upsert?: playlist_trackUpsertWithWhereUniqueWithoutPlaylistInput | playlist_trackUpsertWithWhereUniqueWithoutPlaylistInput[]
    createMany?: playlist_trackCreateManyPlaylistInputEnvelope
    set?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
    disconnect?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
    delete?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
    connect?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
    update?: playlist_trackUpdateWithWhereUniqueWithoutPlaylistInput | playlist_trackUpdateWithWhereUniqueWithoutPlaylistInput[]
    updateMany?: playlist_trackUpdateManyWithWhereWithoutPlaylistInput | playlist_trackUpdateManyWithWhereWithoutPlaylistInput[]
    deleteMany?: playlist_trackScalarWhereInput | playlist_trackScalarWhereInput[]
  }

  export type playlistCreateNestedOneWithoutPlaylist_trackInput = {
    create?: XOR<playlistCreateWithoutPlaylist_trackInput, playlistUncheckedCreateWithoutPlaylist_trackInput>
    connectOrCreate?: playlistCreateOrConnectWithoutPlaylist_trackInput
    connect?: playlistWhereUniqueInput
  }

  export type trackCreateNestedOneWithoutPlaylist_trackInput = {
    create?: XOR<trackCreateWithoutPlaylist_trackInput, trackUncheckedCreateWithoutPlaylist_trackInput>
    connectOrCreate?: trackCreateOrConnectWithoutPlaylist_trackInput
    connect?: trackWhereUniqueInput
  }

  export type playlistUpdateOneRequiredWithoutPlaylist_trackNestedInput = {
    create?: XOR<playlistCreateWithoutPlaylist_trackInput, playlistUncheckedCreateWithoutPlaylist_trackInput>
    connectOrCreate?: playlistCreateOrConnectWithoutPlaylist_trackInput
    upsert?: playlistUpsertWithoutPlaylist_trackInput
    connect?: playlistWhereUniqueInput
    update?: XOR<XOR<playlistUpdateToOneWithWhereWithoutPlaylist_trackInput, playlistUpdateWithoutPlaylist_trackInput>, playlistUncheckedUpdateWithoutPlaylist_trackInput>
  }

  export type trackUpdateOneRequiredWithoutPlaylist_trackNestedInput = {
    create?: XOR<trackCreateWithoutPlaylist_trackInput, trackUncheckedCreateWithoutPlaylist_trackInput>
    connectOrCreate?: trackCreateOrConnectWithoutPlaylist_trackInput
    upsert?: trackUpsertWithoutPlaylist_trackInput
    connect?: trackWhereUniqueInput
    update?: XOR<XOR<trackUpdateToOneWithWhereWithoutPlaylist_trackInput, trackUpdateWithoutPlaylist_trackInput>, trackUncheckedUpdateWithoutPlaylist_trackInput>
  }

  export type invoice_lineCreateNestedManyWithoutTrackInput = {
    create?: XOR<invoice_lineCreateWithoutTrackInput, invoice_lineUncheckedCreateWithoutTrackInput> | invoice_lineCreateWithoutTrackInput[] | invoice_lineUncheckedCreateWithoutTrackInput[]
    connectOrCreate?: invoice_lineCreateOrConnectWithoutTrackInput | invoice_lineCreateOrConnectWithoutTrackInput[]
    createMany?: invoice_lineCreateManyTrackInputEnvelope
    connect?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
  }

  export type playlist_trackCreateNestedManyWithoutTrackInput = {
    create?: XOR<playlist_trackCreateWithoutTrackInput, playlist_trackUncheckedCreateWithoutTrackInput> | playlist_trackCreateWithoutTrackInput[] | playlist_trackUncheckedCreateWithoutTrackInput[]
    connectOrCreate?: playlist_trackCreateOrConnectWithoutTrackInput | playlist_trackCreateOrConnectWithoutTrackInput[]
    createMany?: playlist_trackCreateManyTrackInputEnvelope
    connect?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
  }

  export type albumCreateNestedOneWithoutTrackInput = {
    create?: XOR<albumCreateWithoutTrackInput, albumUncheckedCreateWithoutTrackInput>
    connectOrCreate?: albumCreateOrConnectWithoutTrackInput
    connect?: albumWhereUniqueInput
  }

  export type track_discountCreateNestedManyWithoutTrackInput = {
    create?: XOR<track_discountCreateWithoutTrackInput, track_discountUncheckedCreateWithoutTrackInput> | track_discountCreateWithoutTrackInput[] | track_discountUncheckedCreateWithoutTrackInput[]
    connectOrCreate?: track_discountCreateOrConnectWithoutTrackInput | track_discountCreateOrConnectWithoutTrackInput[]
    createMany?: track_discountCreateManyTrackInputEnvelope
    connect?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
  }

  export type invoice_lineUncheckedCreateNestedManyWithoutTrackInput = {
    create?: XOR<invoice_lineCreateWithoutTrackInput, invoice_lineUncheckedCreateWithoutTrackInput> | invoice_lineCreateWithoutTrackInput[] | invoice_lineUncheckedCreateWithoutTrackInput[]
    connectOrCreate?: invoice_lineCreateOrConnectWithoutTrackInput | invoice_lineCreateOrConnectWithoutTrackInput[]
    createMany?: invoice_lineCreateManyTrackInputEnvelope
    connect?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
  }

  export type playlist_trackUncheckedCreateNestedManyWithoutTrackInput = {
    create?: XOR<playlist_trackCreateWithoutTrackInput, playlist_trackUncheckedCreateWithoutTrackInput> | playlist_trackCreateWithoutTrackInput[] | playlist_trackUncheckedCreateWithoutTrackInput[]
    connectOrCreate?: playlist_trackCreateOrConnectWithoutTrackInput | playlist_trackCreateOrConnectWithoutTrackInput[]
    createMany?: playlist_trackCreateManyTrackInputEnvelope
    connect?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
  }

  export type track_discountUncheckedCreateNestedManyWithoutTrackInput = {
    create?: XOR<track_discountCreateWithoutTrackInput, track_discountUncheckedCreateWithoutTrackInput> | track_discountCreateWithoutTrackInput[] | track_discountUncheckedCreateWithoutTrackInput[]
    connectOrCreate?: track_discountCreateOrConnectWithoutTrackInput | track_discountCreateOrConnectWithoutTrackInput[]
    createMany?: track_discountCreateManyTrackInputEnvelope
    connect?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
  }

  export type invoice_lineUpdateManyWithoutTrackNestedInput = {
    create?: XOR<invoice_lineCreateWithoutTrackInput, invoice_lineUncheckedCreateWithoutTrackInput> | invoice_lineCreateWithoutTrackInput[] | invoice_lineUncheckedCreateWithoutTrackInput[]
    connectOrCreate?: invoice_lineCreateOrConnectWithoutTrackInput | invoice_lineCreateOrConnectWithoutTrackInput[]
    upsert?: invoice_lineUpsertWithWhereUniqueWithoutTrackInput | invoice_lineUpsertWithWhereUniqueWithoutTrackInput[]
    createMany?: invoice_lineCreateManyTrackInputEnvelope
    set?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
    disconnect?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
    delete?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
    connect?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
    update?: invoice_lineUpdateWithWhereUniqueWithoutTrackInput | invoice_lineUpdateWithWhereUniqueWithoutTrackInput[]
    updateMany?: invoice_lineUpdateManyWithWhereWithoutTrackInput | invoice_lineUpdateManyWithWhereWithoutTrackInput[]
    deleteMany?: invoice_lineScalarWhereInput | invoice_lineScalarWhereInput[]
  }

  export type playlist_trackUpdateManyWithoutTrackNestedInput = {
    create?: XOR<playlist_trackCreateWithoutTrackInput, playlist_trackUncheckedCreateWithoutTrackInput> | playlist_trackCreateWithoutTrackInput[] | playlist_trackUncheckedCreateWithoutTrackInput[]
    connectOrCreate?: playlist_trackCreateOrConnectWithoutTrackInput | playlist_trackCreateOrConnectWithoutTrackInput[]
    upsert?: playlist_trackUpsertWithWhereUniqueWithoutTrackInput | playlist_trackUpsertWithWhereUniqueWithoutTrackInput[]
    createMany?: playlist_trackCreateManyTrackInputEnvelope
    set?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
    disconnect?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
    delete?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
    connect?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
    update?: playlist_trackUpdateWithWhereUniqueWithoutTrackInput | playlist_trackUpdateWithWhereUniqueWithoutTrackInput[]
    updateMany?: playlist_trackUpdateManyWithWhereWithoutTrackInput | playlist_trackUpdateManyWithWhereWithoutTrackInput[]
    deleteMany?: playlist_trackScalarWhereInput | playlist_trackScalarWhereInput[]
  }

  export type albumUpdateOneRequiredWithoutTrackNestedInput = {
    create?: XOR<albumCreateWithoutTrackInput, albumUncheckedCreateWithoutTrackInput>
    connectOrCreate?: albumCreateOrConnectWithoutTrackInput
    upsert?: albumUpsertWithoutTrackInput
    connect?: albumWhereUniqueInput
    update?: XOR<XOR<albumUpdateToOneWithWhereWithoutTrackInput, albumUpdateWithoutTrackInput>, albumUncheckedUpdateWithoutTrackInput>
  }

  export type track_discountUpdateManyWithoutTrackNestedInput = {
    create?: XOR<track_discountCreateWithoutTrackInput, track_discountUncheckedCreateWithoutTrackInput> | track_discountCreateWithoutTrackInput[] | track_discountUncheckedCreateWithoutTrackInput[]
    connectOrCreate?: track_discountCreateOrConnectWithoutTrackInput | track_discountCreateOrConnectWithoutTrackInput[]
    upsert?: track_discountUpsertWithWhereUniqueWithoutTrackInput | track_discountUpsertWithWhereUniqueWithoutTrackInput[]
    createMany?: track_discountCreateManyTrackInputEnvelope
    set?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
    disconnect?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
    delete?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
    connect?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
    update?: track_discountUpdateWithWhereUniqueWithoutTrackInput | track_discountUpdateWithWhereUniqueWithoutTrackInput[]
    updateMany?: track_discountUpdateManyWithWhereWithoutTrackInput | track_discountUpdateManyWithWhereWithoutTrackInput[]
    deleteMany?: track_discountScalarWhereInput | track_discountScalarWhereInput[]
  }

  export type invoice_lineUncheckedUpdateManyWithoutTrackNestedInput = {
    create?: XOR<invoice_lineCreateWithoutTrackInput, invoice_lineUncheckedCreateWithoutTrackInput> | invoice_lineCreateWithoutTrackInput[] | invoice_lineUncheckedCreateWithoutTrackInput[]
    connectOrCreate?: invoice_lineCreateOrConnectWithoutTrackInput | invoice_lineCreateOrConnectWithoutTrackInput[]
    upsert?: invoice_lineUpsertWithWhereUniqueWithoutTrackInput | invoice_lineUpsertWithWhereUniqueWithoutTrackInput[]
    createMany?: invoice_lineCreateManyTrackInputEnvelope
    set?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
    disconnect?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
    delete?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
    connect?: invoice_lineWhereUniqueInput | invoice_lineWhereUniqueInput[]
    update?: invoice_lineUpdateWithWhereUniqueWithoutTrackInput | invoice_lineUpdateWithWhereUniqueWithoutTrackInput[]
    updateMany?: invoice_lineUpdateManyWithWhereWithoutTrackInput | invoice_lineUpdateManyWithWhereWithoutTrackInput[]
    deleteMany?: invoice_lineScalarWhereInput | invoice_lineScalarWhereInput[]
  }

  export type playlist_trackUncheckedUpdateManyWithoutTrackNestedInput = {
    create?: XOR<playlist_trackCreateWithoutTrackInput, playlist_trackUncheckedCreateWithoutTrackInput> | playlist_trackCreateWithoutTrackInput[] | playlist_trackUncheckedCreateWithoutTrackInput[]
    connectOrCreate?: playlist_trackCreateOrConnectWithoutTrackInput | playlist_trackCreateOrConnectWithoutTrackInput[]
    upsert?: playlist_trackUpsertWithWhereUniqueWithoutTrackInput | playlist_trackUpsertWithWhereUniqueWithoutTrackInput[]
    createMany?: playlist_trackCreateManyTrackInputEnvelope
    set?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
    disconnect?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
    delete?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
    connect?: playlist_trackWhereUniqueInput | playlist_trackWhereUniqueInput[]
    update?: playlist_trackUpdateWithWhereUniqueWithoutTrackInput | playlist_trackUpdateWithWhereUniqueWithoutTrackInput[]
    updateMany?: playlist_trackUpdateManyWithWhereWithoutTrackInput | playlist_trackUpdateManyWithWhereWithoutTrackInput[]
    deleteMany?: playlist_trackScalarWhereInput | playlist_trackScalarWhereInput[]
  }

  export type track_discountUncheckedUpdateManyWithoutTrackNestedInput = {
    create?: XOR<track_discountCreateWithoutTrackInput, track_discountUncheckedCreateWithoutTrackInput> | track_discountCreateWithoutTrackInput[] | track_discountUncheckedCreateWithoutTrackInput[]
    connectOrCreate?: track_discountCreateOrConnectWithoutTrackInput | track_discountCreateOrConnectWithoutTrackInput[]
    upsert?: track_discountUpsertWithWhereUniqueWithoutTrackInput | track_discountUpsertWithWhereUniqueWithoutTrackInput[]
    createMany?: track_discountCreateManyTrackInputEnvelope
    set?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
    disconnect?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
    delete?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
    connect?: track_discountWhereUniqueInput | track_discountWhereUniqueInput[]
    update?: track_discountUpdateWithWhereUniqueWithoutTrackInput | track_discountUpdateWithWhereUniqueWithoutTrackInput[]
    updateMany?: track_discountUpdateManyWithWhereWithoutTrackInput | track_discountUpdateManyWithWhereWithoutTrackInput[]
    deleteMany?: track_discountScalarWhereInput | track_discountScalarWhereInput[]
  }

  export type employeeCreateNestedOneWithoutTrack_discountInput = {
    create?: XOR<employeeCreateWithoutTrack_discountInput, employeeUncheckedCreateWithoutTrack_discountInput>
    connectOrCreate?: employeeCreateOrConnectWithoutTrack_discountInput
    connect?: employeeWhereUniqueInput
  }

  export type trackCreateNestedOneWithoutTrack_discountInput = {
    create?: XOR<trackCreateWithoutTrack_discountInput, trackUncheckedCreateWithoutTrack_discountInput>
    connectOrCreate?: trackCreateOrConnectWithoutTrack_discountInput
    connect?: trackWhereUniqueInput
  }

  export type employeeUpdateOneRequiredWithoutTrack_discountNestedInput = {
    create?: XOR<employeeCreateWithoutTrack_discountInput, employeeUncheckedCreateWithoutTrack_discountInput>
    connectOrCreate?: employeeCreateOrConnectWithoutTrack_discountInput
    upsert?: employeeUpsertWithoutTrack_discountInput
    connect?: employeeWhereUniqueInput
    update?: XOR<XOR<employeeUpdateToOneWithWhereWithoutTrack_discountInput, employeeUpdateWithoutTrack_discountInput>, employeeUncheckedUpdateWithoutTrack_discountInput>
  }

  export type trackUpdateOneRequiredWithoutTrack_discountNestedInput = {
    create?: XOR<trackCreateWithoutTrack_discountInput, trackUncheckedCreateWithoutTrack_discountInput>
    connectOrCreate?: trackCreateOrConnectWithoutTrack_discountInput
    upsert?: trackUpsertWithoutTrack_discountInput
    connect?: trackWhereUniqueInput
    update?: XOR<XOR<trackUpdateToOneWithWhereWithoutTrack_discountInput, trackUpdateWithoutTrack_discountInput>, trackUncheckedUpdateWithoutTrack_discountInput>
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

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
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

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
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

  export type NestedDecimalFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
  }

  export type NestedDecimalWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    in?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    notIn?: Decimal[] | DecimalJsLike[] | number[] | string[] | ListDecimalFieldRefInput<$PrismaModel>
    lt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    lte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gt?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    gte?: Decimal | DecimalJsLike | number | string | DecimalFieldRefInput<$PrismaModel>
    not?: NestedDecimalWithAggregatesFilter<$PrismaModel> | Decimal | DecimalJsLike | number | string
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedDecimalFilter<$PrismaModel>
    _sum?: NestedDecimalFilter<$PrismaModel>
    _min?: NestedDecimalFilter<$PrismaModel>
    _max?: NestedDecimalFilter<$PrismaModel>
  }

  export type artistCreateWithoutAlbumInput = {
    name: string
  }

  export type artistUncheckedCreateWithoutAlbumInput = {
    name: string
    artist_id?: number
  }

  export type artistCreateOrConnectWithoutAlbumInput = {
    where: artistWhereUniqueInput
    create: XOR<artistCreateWithoutAlbumInput, artistUncheckedCreateWithoutAlbumInput>
  }

  export type trackCreateWithoutAlbumInput = {
    name: string
    media_type_id?: number
    genre_id?: number | null
    composer?: string | null
    milliseconds?: number
    bytes?: number | null
    unit_price?: Decimal | DecimalJsLike | number | string
    invoice_line?: invoice_lineCreateNestedManyWithoutTrackInput
    playlist_track?: playlist_trackCreateNestedManyWithoutTrackInput
    track_discount?: track_discountCreateNestedManyWithoutTrackInput
  }

  export type trackUncheckedCreateWithoutAlbumInput = {
    name: string
    media_type_id?: number
    genre_id?: number | null
    composer?: string | null
    milliseconds?: number
    bytes?: number | null
    unit_price?: Decimal | DecimalJsLike | number | string
    track_id?: number
    invoice_line?: invoice_lineUncheckedCreateNestedManyWithoutTrackInput
    playlist_track?: playlist_trackUncheckedCreateNestedManyWithoutTrackInput
    track_discount?: track_discountUncheckedCreateNestedManyWithoutTrackInput
  }

  export type trackCreateOrConnectWithoutAlbumInput = {
    where: trackWhereUniqueInput
    create: XOR<trackCreateWithoutAlbumInput, trackUncheckedCreateWithoutAlbumInput>
  }

  export type trackCreateManyAlbumInputEnvelope = {
    data: trackCreateManyAlbumInput | trackCreateManyAlbumInput[]
    skipDuplicates?: boolean
  }

  export type artistUpsertWithoutAlbumInput = {
    update: XOR<artistUpdateWithoutAlbumInput, artistUncheckedUpdateWithoutAlbumInput>
    create: XOR<artistCreateWithoutAlbumInput, artistUncheckedCreateWithoutAlbumInput>
    where?: artistWhereInput
  }

  export type artistUpdateToOneWithWhereWithoutAlbumInput = {
    where?: artistWhereInput
    data: XOR<artistUpdateWithoutAlbumInput, artistUncheckedUpdateWithoutAlbumInput>
  }

  export type artistUpdateWithoutAlbumInput = {
    name?: StringFieldUpdateOperationsInput | string
  }

  export type artistUncheckedUpdateWithoutAlbumInput = {
    name?: StringFieldUpdateOperationsInput | string
    artist_id?: IntFieldUpdateOperationsInput | number
  }

  export type trackUpsertWithWhereUniqueWithoutAlbumInput = {
    where: trackWhereUniqueInput
    update: XOR<trackUpdateWithoutAlbumInput, trackUncheckedUpdateWithoutAlbumInput>
    create: XOR<trackCreateWithoutAlbumInput, trackUncheckedCreateWithoutAlbumInput>
  }

  export type trackUpdateWithWhereUniqueWithoutAlbumInput = {
    where: trackWhereUniqueInput
    data: XOR<trackUpdateWithoutAlbumInput, trackUncheckedUpdateWithoutAlbumInput>
  }

  export type trackUpdateManyWithWhereWithoutAlbumInput = {
    where: trackScalarWhereInput
    data: XOR<trackUpdateManyMutationInput, trackUncheckedUpdateManyWithoutAlbumInput>
  }

  export type trackScalarWhereInput = {
    AND?: trackScalarWhereInput | trackScalarWhereInput[]
    OR?: trackScalarWhereInput[]
    NOT?: trackScalarWhereInput | trackScalarWhereInput[]
    name?: StringFilter<"track"> | string
    album_id?: IntFilter<"track"> | number
    media_type_id?: IntFilter<"track"> | number
    genre_id?: IntNullableFilter<"track"> | number | null
    composer?: StringNullableFilter<"track"> | string | null
    milliseconds?: IntFilter<"track"> | number
    bytes?: IntNullableFilter<"track"> | number | null
    unit_price?: DecimalFilter<"track"> | Decimal | DecimalJsLike | number | string
    track_id?: IntFilter<"track"> | number
  }

  export type albumCreateWithoutArtistInput = {
    title: string
    track?: trackCreateNestedManyWithoutAlbumInput
  }

  export type albumUncheckedCreateWithoutArtistInput = {
    title: string
    album_id?: number
    track?: trackUncheckedCreateNestedManyWithoutAlbumInput
  }

  export type albumCreateOrConnectWithoutArtistInput = {
    where: albumWhereUniqueInput
    create: XOR<albumCreateWithoutArtistInput, albumUncheckedCreateWithoutArtistInput>
  }

  export type albumCreateManyArtistInputEnvelope = {
    data: albumCreateManyArtistInput | albumCreateManyArtistInput[]
    skipDuplicates?: boolean
  }

  export type albumUpsertWithWhereUniqueWithoutArtistInput = {
    where: albumWhereUniqueInput
    update: XOR<albumUpdateWithoutArtistInput, albumUncheckedUpdateWithoutArtistInput>
    create: XOR<albumCreateWithoutArtistInput, albumUncheckedCreateWithoutArtistInput>
  }

  export type albumUpdateWithWhereUniqueWithoutArtistInput = {
    where: albumWhereUniqueInput
    data: XOR<albumUpdateWithoutArtistInput, albumUncheckedUpdateWithoutArtistInput>
  }

  export type albumUpdateManyWithWhereWithoutArtistInput = {
    where: albumScalarWhereInput
    data: XOR<albumUpdateManyMutationInput, albumUncheckedUpdateManyWithoutArtistInput>
  }

  export type albumScalarWhereInput = {
    AND?: albumScalarWhereInput | albumScalarWhereInput[]
    OR?: albumScalarWhereInput[]
    NOT?: albumScalarWhereInput | albumScalarWhereInput[]
    title?: StringFilter<"album"> | string
    artist_id?: IntFilter<"album"> | number
    album_id?: IntFilter<"album"> | number
  }

  export type employeeCreateWithoutCustomerInput = {
    employee_id: number
    last_name: string
    first_name: string
    title?: string | null
    birth_date?: Date | string | null
    hire_date: Date | string
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email?: string | null
    termination_date?: Date | string | null
    employee?: employeeCreateNestedOneWithoutOther_employeeInput
    other_employee?: employeeCreateNestedManyWithoutEmployeeInput
    track_discount?: track_discountCreateNestedManyWithoutEmployeeInput
  }

  export type employeeUncheckedCreateWithoutCustomerInput = {
    employee_id: number
    last_name: string
    first_name: string
    title?: string | null
    reports_to?: number | null
    birth_date?: Date | string | null
    hire_date: Date | string
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email?: string | null
    termination_date?: Date | string | null
    other_employee?: employeeUncheckedCreateNestedManyWithoutEmployeeInput
    track_discount?: track_discountUncheckedCreateNestedManyWithoutEmployeeInput
  }

  export type employeeCreateOrConnectWithoutCustomerInput = {
    where: employeeWhereUniqueInput
    create: XOR<employeeCreateWithoutCustomerInput, employeeUncheckedCreateWithoutCustomerInput>
  }

  export type customer_reviewCreateWithoutCustomerInput = {
    track_id: number
    rating?: number | null
    review_comment?: string | null
    invoice: invoiceCreateNestedOneWithoutCustomer_reviewInput
  }

  export type customer_reviewUncheckedCreateWithoutCustomerInput = {
    review_id?: number
    invoice_id: number
    track_id: number
    rating?: number | null
    review_comment?: string | null
  }

  export type customer_reviewCreateOrConnectWithoutCustomerInput = {
    where: customer_reviewWhereUniqueInput
    create: XOR<customer_reviewCreateWithoutCustomerInput, customer_reviewUncheckedCreateWithoutCustomerInput>
  }

  export type customer_reviewCreateManyCustomerInputEnvelope = {
    data: customer_reviewCreateManyCustomerInput | customer_reviewCreateManyCustomerInput[]
    skipDuplicates?: boolean
  }

  export type invoiceCreateWithoutCustomerInput = {
    invoice_id: number
    invoice_date: Date | string
    billing_address?: string | null
    billing_city?: string | null
    billing_state?: string | null
    billing_country?: string | null
    billing_postal_code?: string | null
    total: Decimal | DecimalJsLike | number | string
    customer_review?: customer_reviewCreateNestedManyWithoutInvoiceInput
    invoice_line?: invoice_lineCreateNestedManyWithoutInvoiceInput
  }

  export type invoiceUncheckedCreateWithoutCustomerInput = {
    invoice_id: number
    invoice_date: Date | string
    billing_address?: string | null
    billing_city?: string | null
    billing_state?: string | null
    billing_country?: string | null
    billing_postal_code?: string | null
    total: Decimal | DecimalJsLike | number | string
    customer_review?: customer_reviewUncheckedCreateNestedManyWithoutInvoiceInput
    invoice_line?: invoice_lineUncheckedCreateNestedManyWithoutInvoiceInput
  }

  export type invoiceCreateOrConnectWithoutCustomerInput = {
    where: invoiceWhereUniqueInput
    create: XOR<invoiceCreateWithoutCustomerInput, invoiceUncheckedCreateWithoutCustomerInput>
  }

  export type invoiceCreateManyCustomerInputEnvelope = {
    data: invoiceCreateManyCustomerInput | invoiceCreateManyCustomerInput[]
    skipDuplicates?: boolean
  }

  export type employeeUpsertWithoutCustomerInput = {
    update: XOR<employeeUpdateWithoutCustomerInput, employeeUncheckedUpdateWithoutCustomerInput>
    create: XOR<employeeCreateWithoutCustomerInput, employeeUncheckedCreateWithoutCustomerInput>
    where?: employeeWhereInput
  }

  export type employeeUpdateToOneWithWhereWithoutCustomerInput = {
    where?: employeeWhereInput
    data: XOR<employeeUpdateWithoutCustomerInput, employeeUncheckedUpdateWithoutCustomerInput>
  }

  export type employeeUpdateWithoutCustomerInput = {
    employee_id?: IntFieldUpdateOperationsInput | number
    last_name?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    birth_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hire_date?: DateTimeFieldUpdateOperationsInput | Date | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    termination_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    employee?: employeeUpdateOneWithoutOther_employeeNestedInput
    other_employee?: employeeUpdateManyWithoutEmployeeNestedInput
    track_discount?: track_discountUpdateManyWithoutEmployeeNestedInput
  }

  export type employeeUncheckedUpdateWithoutCustomerInput = {
    employee_id?: IntFieldUpdateOperationsInput | number
    last_name?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    reports_to?: NullableIntFieldUpdateOperationsInput | number | null
    birth_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hire_date?: DateTimeFieldUpdateOperationsInput | Date | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    termination_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    other_employee?: employeeUncheckedUpdateManyWithoutEmployeeNestedInput
    track_discount?: track_discountUncheckedUpdateManyWithoutEmployeeNestedInput
  }

  export type customer_reviewUpsertWithWhereUniqueWithoutCustomerInput = {
    where: customer_reviewWhereUniqueInput
    update: XOR<customer_reviewUpdateWithoutCustomerInput, customer_reviewUncheckedUpdateWithoutCustomerInput>
    create: XOR<customer_reviewCreateWithoutCustomerInput, customer_reviewUncheckedCreateWithoutCustomerInput>
  }

  export type customer_reviewUpdateWithWhereUniqueWithoutCustomerInput = {
    where: customer_reviewWhereUniqueInput
    data: XOR<customer_reviewUpdateWithoutCustomerInput, customer_reviewUncheckedUpdateWithoutCustomerInput>
  }

  export type customer_reviewUpdateManyWithWhereWithoutCustomerInput = {
    where: customer_reviewScalarWhereInput
    data: XOR<customer_reviewUpdateManyMutationInput, customer_reviewUncheckedUpdateManyWithoutCustomerInput>
  }

  export type customer_reviewScalarWhereInput = {
    AND?: customer_reviewScalarWhereInput | customer_reviewScalarWhereInput[]
    OR?: customer_reviewScalarWhereInput[]
    NOT?: customer_reviewScalarWhereInput | customer_reviewScalarWhereInput[]
    review_id?: IntFilter<"customer_review"> | number
    customer_id?: IntFilter<"customer_review"> | number
    invoice_id?: IntFilter<"customer_review"> | number
    track_id?: IntFilter<"customer_review"> | number
    rating?: IntNullableFilter<"customer_review"> | number | null
    review_comment?: StringNullableFilter<"customer_review"> | string | null
  }

  export type invoiceUpsertWithWhereUniqueWithoutCustomerInput = {
    where: invoiceWhereUniqueInput
    update: XOR<invoiceUpdateWithoutCustomerInput, invoiceUncheckedUpdateWithoutCustomerInput>
    create: XOR<invoiceCreateWithoutCustomerInput, invoiceUncheckedCreateWithoutCustomerInput>
  }

  export type invoiceUpdateWithWhereUniqueWithoutCustomerInput = {
    where: invoiceWhereUniqueInput
    data: XOR<invoiceUpdateWithoutCustomerInput, invoiceUncheckedUpdateWithoutCustomerInput>
  }

  export type invoiceUpdateManyWithWhereWithoutCustomerInput = {
    where: invoiceScalarWhereInput
    data: XOR<invoiceUpdateManyMutationInput, invoiceUncheckedUpdateManyWithoutCustomerInput>
  }

  export type invoiceScalarWhereInput = {
    AND?: invoiceScalarWhereInput | invoiceScalarWhereInput[]
    OR?: invoiceScalarWhereInput[]
    NOT?: invoiceScalarWhereInput | invoiceScalarWhereInput[]
    invoice_id?: IntFilter<"invoice"> | number
    customer_id?: IntFilter<"invoice"> | number
    invoice_date?: DateTimeFilter<"invoice"> | Date | string
    billing_address?: StringNullableFilter<"invoice"> | string | null
    billing_city?: StringNullableFilter<"invoice"> | string | null
    billing_state?: StringNullableFilter<"invoice"> | string | null
    billing_country?: StringNullableFilter<"invoice"> | string | null
    billing_postal_code?: StringNullableFilter<"invoice"> | string | null
    total?: DecimalFilter<"invoice"> | Decimal | DecimalJsLike | number | string
  }

  export type customerCreateWithoutCustomer_reviewInput = {
    customer_id: number
    first_name: string
    last_name: string
    company?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email: string
    employee?: employeeCreateNestedOneWithoutCustomerInput
    invoice?: invoiceCreateNestedManyWithoutCustomerInput
  }

  export type customerUncheckedCreateWithoutCustomer_reviewInput = {
    customer_id: number
    first_name: string
    last_name: string
    company?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email: string
    support_rep_id?: number | null
    invoice?: invoiceUncheckedCreateNestedManyWithoutCustomerInput
  }

  export type customerCreateOrConnectWithoutCustomer_reviewInput = {
    where: customerWhereUniqueInput
    create: XOR<customerCreateWithoutCustomer_reviewInput, customerUncheckedCreateWithoutCustomer_reviewInput>
  }

  export type invoiceCreateWithoutCustomer_reviewInput = {
    invoice_id: number
    invoice_date: Date | string
    billing_address?: string | null
    billing_city?: string | null
    billing_state?: string | null
    billing_country?: string | null
    billing_postal_code?: string | null
    total: Decimal | DecimalJsLike | number | string
    customer: customerCreateNestedOneWithoutInvoiceInput
    invoice_line?: invoice_lineCreateNestedManyWithoutInvoiceInput
  }

  export type invoiceUncheckedCreateWithoutCustomer_reviewInput = {
    invoice_id: number
    customer_id: number
    invoice_date: Date | string
    billing_address?: string | null
    billing_city?: string | null
    billing_state?: string | null
    billing_country?: string | null
    billing_postal_code?: string | null
    total: Decimal | DecimalJsLike | number | string
    invoice_line?: invoice_lineUncheckedCreateNestedManyWithoutInvoiceInput
  }

  export type invoiceCreateOrConnectWithoutCustomer_reviewInput = {
    where: invoiceWhereUniqueInput
    create: XOR<invoiceCreateWithoutCustomer_reviewInput, invoiceUncheckedCreateWithoutCustomer_reviewInput>
  }

  export type customerUpsertWithoutCustomer_reviewInput = {
    update: XOR<customerUpdateWithoutCustomer_reviewInput, customerUncheckedUpdateWithoutCustomer_reviewInput>
    create: XOR<customerCreateWithoutCustomer_reviewInput, customerUncheckedCreateWithoutCustomer_reviewInput>
    where?: customerWhereInput
  }

  export type customerUpdateToOneWithWhereWithoutCustomer_reviewInput = {
    where?: customerWhereInput
    data: XOR<customerUpdateWithoutCustomer_reviewInput, customerUncheckedUpdateWithoutCustomer_reviewInput>
  }

  export type customerUpdateWithoutCustomer_reviewInput = {
    customer_id?: IntFieldUpdateOperationsInput | number
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    company?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    employee?: employeeUpdateOneWithoutCustomerNestedInput
    invoice?: invoiceUpdateManyWithoutCustomerNestedInput
  }

  export type customerUncheckedUpdateWithoutCustomer_reviewInput = {
    customer_id?: IntFieldUpdateOperationsInput | number
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    company?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    support_rep_id?: NullableIntFieldUpdateOperationsInput | number | null
    invoice?: invoiceUncheckedUpdateManyWithoutCustomerNestedInput
  }

  export type invoiceUpsertWithoutCustomer_reviewInput = {
    update: XOR<invoiceUpdateWithoutCustomer_reviewInput, invoiceUncheckedUpdateWithoutCustomer_reviewInput>
    create: XOR<invoiceCreateWithoutCustomer_reviewInput, invoiceUncheckedCreateWithoutCustomer_reviewInput>
    where?: invoiceWhereInput
  }

  export type invoiceUpdateToOneWithWhereWithoutCustomer_reviewInput = {
    where?: invoiceWhereInput
    data: XOR<invoiceUpdateWithoutCustomer_reviewInput, invoiceUncheckedUpdateWithoutCustomer_reviewInput>
  }

  export type invoiceUpdateWithoutCustomer_reviewInput = {
    invoice_id?: IntFieldUpdateOperationsInput | number
    invoice_date?: DateTimeFieldUpdateOperationsInput | Date | string
    billing_address?: NullableStringFieldUpdateOperationsInput | string | null
    billing_city?: NullableStringFieldUpdateOperationsInput | string | null
    billing_state?: NullableStringFieldUpdateOperationsInput | string | null
    billing_country?: NullableStringFieldUpdateOperationsInput | string | null
    billing_postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    total?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    customer?: customerUpdateOneRequiredWithoutInvoiceNestedInput
    invoice_line?: invoice_lineUpdateManyWithoutInvoiceNestedInput
  }

  export type invoiceUncheckedUpdateWithoutCustomer_reviewInput = {
    invoice_id?: IntFieldUpdateOperationsInput | number
    customer_id?: IntFieldUpdateOperationsInput | number
    invoice_date?: DateTimeFieldUpdateOperationsInput | Date | string
    billing_address?: NullableStringFieldUpdateOperationsInput | string | null
    billing_city?: NullableStringFieldUpdateOperationsInput | string | null
    billing_state?: NullableStringFieldUpdateOperationsInput | string | null
    billing_country?: NullableStringFieldUpdateOperationsInput | string | null
    billing_postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    total?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    invoice_line?: invoice_lineUncheckedUpdateManyWithoutInvoiceNestedInput
  }

  export type customerCreateWithoutEmployeeInput = {
    customer_id: number
    first_name: string
    last_name: string
    company?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email: string
    customer_review?: customer_reviewCreateNestedManyWithoutCustomerInput
    invoice?: invoiceCreateNestedManyWithoutCustomerInput
  }

  export type customerUncheckedCreateWithoutEmployeeInput = {
    customer_id: number
    first_name: string
    last_name: string
    company?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email: string
    customer_review?: customer_reviewUncheckedCreateNestedManyWithoutCustomerInput
    invoice?: invoiceUncheckedCreateNestedManyWithoutCustomerInput
  }

  export type customerCreateOrConnectWithoutEmployeeInput = {
    where: customerWhereUniqueInput
    create: XOR<customerCreateWithoutEmployeeInput, customerUncheckedCreateWithoutEmployeeInput>
  }

  export type customerCreateManyEmployeeInputEnvelope = {
    data: customerCreateManyEmployeeInput | customerCreateManyEmployeeInput[]
    skipDuplicates?: boolean
  }

  export type employeeCreateWithoutOther_employeeInput = {
    employee_id: number
    last_name: string
    first_name: string
    title?: string | null
    birth_date?: Date | string | null
    hire_date: Date | string
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email?: string | null
    termination_date?: Date | string | null
    customer?: customerCreateNestedManyWithoutEmployeeInput
    employee?: employeeCreateNestedOneWithoutOther_employeeInput
    track_discount?: track_discountCreateNestedManyWithoutEmployeeInput
  }

  export type employeeUncheckedCreateWithoutOther_employeeInput = {
    employee_id: number
    last_name: string
    first_name: string
    title?: string | null
    reports_to?: number | null
    birth_date?: Date | string | null
    hire_date: Date | string
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email?: string | null
    termination_date?: Date | string | null
    customer?: customerUncheckedCreateNestedManyWithoutEmployeeInput
    track_discount?: track_discountUncheckedCreateNestedManyWithoutEmployeeInput
  }

  export type employeeCreateOrConnectWithoutOther_employeeInput = {
    where: employeeWhereUniqueInput
    create: XOR<employeeCreateWithoutOther_employeeInput, employeeUncheckedCreateWithoutOther_employeeInput>
  }

  export type employeeCreateWithoutEmployeeInput = {
    employee_id: number
    last_name: string
    first_name: string
    title?: string | null
    birth_date?: Date | string | null
    hire_date: Date | string
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email?: string | null
    termination_date?: Date | string | null
    customer?: customerCreateNestedManyWithoutEmployeeInput
    other_employee?: employeeCreateNestedManyWithoutEmployeeInput
    track_discount?: track_discountCreateNestedManyWithoutEmployeeInput
  }

  export type employeeUncheckedCreateWithoutEmployeeInput = {
    employee_id: number
    last_name: string
    first_name: string
    title?: string | null
    birth_date?: Date | string | null
    hire_date: Date | string
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email?: string | null
    termination_date?: Date | string | null
    customer?: customerUncheckedCreateNestedManyWithoutEmployeeInput
    other_employee?: employeeUncheckedCreateNestedManyWithoutEmployeeInput
    track_discount?: track_discountUncheckedCreateNestedManyWithoutEmployeeInput
  }

  export type employeeCreateOrConnectWithoutEmployeeInput = {
    where: employeeWhereUniqueInput
    create: XOR<employeeCreateWithoutEmployeeInput, employeeUncheckedCreateWithoutEmployeeInput>
  }

  export type employeeCreateManyEmployeeInputEnvelope = {
    data: employeeCreateManyEmployeeInput | employeeCreateManyEmployeeInput[]
    skipDuplicates?: boolean
  }

  export type track_discountCreateWithoutEmployeeInput = {
    discount: Decimal | DecimalJsLike | number | string
    offer_date: Date | string
    close_date: Date | string
    track: trackCreateNestedOneWithoutTrack_discountInput
  }

  export type track_discountUncheckedCreateWithoutEmployeeInput = {
    track_discount_id?: number
    track_id: number
    discount: Decimal | DecimalJsLike | number | string
    offer_date: Date | string
    close_date: Date | string
  }

  export type track_discountCreateOrConnectWithoutEmployeeInput = {
    where: track_discountWhereUniqueInput
    create: XOR<track_discountCreateWithoutEmployeeInput, track_discountUncheckedCreateWithoutEmployeeInput>
  }

  export type track_discountCreateManyEmployeeInputEnvelope = {
    data: track_discountCreateManyEmployeeInput | track_discountCreateManyEmployeeInput[]
    skipDuplicates?: boolean
  }

  export type customerUpsertWithWhereUniqueWithoutEmployeeInput = {
    where: customerWhereUniqueInput
    update: XOR<customerUpdateWithoutEmployeeInput, customerUncheckedUpdateWithoutEmployeeInput>
    create: XOR<customerCreateWithoutEmployeeInput, customerUncheckedCreateWithoutEmployeeInput>
  }

  export type customerUpdateWithWhereUniqueWithoutEmployeeInput = {
    where: customerWhereUniqueInput
    data: XOR<customerUpdateWithoutEmployeeInput, customerUncheckedUpdateWithoutEmployeeInput>
  }

  export type customerUpdateManyWithWhereWithoutEmployeeInput = {
    where: customerScalarWhereInput
    data: XOR<customerUpdateManyMutationInput, customerUncheckedUpdateManyWithoutEmployeeInput>
  }

  export type customerScalarWhereInput = {
    AND?: customerScalarWhereInput | customerScalarWhereInput[]
    OR?: customerScalarWhereInput[]
    NOT?: customerScalarWhereInput | customerScalarWhereInput[]
    customer_id?: IntFilter<"customer"> | number
    first_name?: StringFilter<"customer"> | string
    last_name?: StringFilter<"customer"> | string
    company?: StringNullableFilter<"customer"> | string | null
    address?: StringNullableFilter<"customer"> | string | null
    city?: StringNullableFilter<"customer"> | string | null
    state?: StringNullableFilter<"customer"> | string | null
    country?: StringNullableFilter<"customer"> | string | null
    postal_code?: StringNullableFilter<"customer"> | string | null
    phone?: StringNullableFilter<"customer"> | string | null
    fax?: StringNullableFilter<"customer"> | string | null
    email?: StringFilter<"customer"> | string
    support_rep_id?: IntNullableFilter<"customer"> | number | null
  }

  export type employeeUpsertWithoutOther_employeeInput = {
    update: XOR<employeeUpdateWithoutOther_employeeInput, employeeUncheckedUpdateWithoutOther_employeeInput>
    create: XOR<employeeCreateWithoutOther_employeeInput, employeeUncheckedCreateWithoutOther_employeeInput>
    where?: employeeWhereInput
  }

  export type employeeUpdateToOneWithWhereWithoutOther_employeeInput = {
    where?: employeeWhereInput
    data: XOR<employeeUpdateWithoutOther_employeeInput, employeeUncheckedUpdateWithoutOther_employeeInput>
  }

  export type employeeUpdateWithoutOther_employeeInput = {
    employee_id?: IntFieldUpdateOperationsInput | number
    last_name?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    birth_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hire_date?: DateTimeFieldUpdateOperationsInput | Date | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    termination_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    customer?: customerUpdateManyWithoutEmployeeNestedInput
    employee?: employeeUpdateOneWithoutOther_employeeNestedInput
    track_discount?: track_discountUpdateManyWithoutEmployeeNestedInput
  }

  export type employeeUncheckedUpdateWithoutOther_employeeInput = {
    employee_id?: IntFieldUpdateOperationsInput | number
    last_name?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    reports_to?: NullableIntFieldUpdateOperationsInput | number | null
    birth_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hire_date?: DateTimeFieldUpdateOperationsInput | Date | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    termination_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    customer?: customerUncheckedUpdateManyWithoutEmployeeNestedInput
    track_discount?: track_discountUncheckedUpdateManyWithoutEmployeeNestedInput
  }

  export type employeeUpsertWithWhereUniqueWithoutEmployeeInput = {
    where: employeeWhereUniqueInput
    update: XOR<employeeUpdateWithoutEmployeeInput, employeeUncheckedUpdateWithoutEmployeeInput>
    create: XOR<employeeCreateWithoutEmployeeInput, employeeUncheckedCreateWithoutEmployeeInput>
  }

  export type employeeUpdateWithWhereUniqueWithoutEmployeeInput = {
    where: employeeWhereUniqueInput
    data: XOR<employeeUpdateWithoutEmployeeInput, employeeUncheckedUpdateWithoutEmployeeInput>
  }

  export type employeeUpdateManyWithWhereWithoutEmployeeInput = {
    where: employeeScalarWhereInput
    data: XOR<employeeUpdateManyMutationInput, employeeUncheckedUpdateManyWithoutEmployeeInput>
  }

  export type employeeScalarWhereInput = {
    AND?: employeeScalarWhereInput | employeeScalarWhereInput[]
    OR?: employeeScalarWhereInput[]
    NOT?: employeeScalarWhereInput | employeeScalarWhereInput[]
    employee_id?: IntFilter<"employee"> | number
    last_name?: StringFilter<"employee"> | string
    first_name?: StringFilter<"employee"> | string
    title?: StringNullableFilter<"employee"> | string | null
    reports_to?: IntNullableFilter<"employee"> | number | null
    birth_date?: DateTimeNullableFilter<"employee"> | Date | string | null
    hire_date?: DateTimeFilter<"employee"> | Date | string
    address?: StringNullableFilter<"employee"> | string | null
    city?: StringNullableFilter<"employee"> | string | null
    state?: StringNullableFilter<"employee"> | string | null
    country?: StringNullableFilter<"employee"> | string | null
    postal_code?: StringNullableFilter<"employee"> | string | null
    phone?: StringNullableFilter<"employee"> | string | null
    fax?: StringNullableFilter<"employee"> | string | null
    email?: StringNullableFilter<"employee"> | string | null
    termination_date?: DateTimeNullableFilter<"employee"> | Date | string | null
  }

  export type track_discountUpsertWithWhereUniqueWithoutEmployeeInput = {
    where: track_discountWhereUniqueInput
    update: XOR<track_discountUpdateWithoutEmployeeInput, track_discountUncheckedUpdateWithoutEmployeeInput>
    create: XOR<track_discountCreateWithoutEmployeeInput, track_discountUncheckedCreateWithoutEmployeeInput>
  }

  export type track_discountUpdateWithWhereUniqueWithoutEmployeeInput = {
    where: track_discountWhereUniqueInput
    data: XOR<track_discountUpdateWithoutEmployeeInput, track_discountUncheckedUpdateWithoutEmployeeInput>
  }

  export type track_discountUpdateManyWithWhereWithoutEmployeeInput = {
    where: track_discountScalarWhereInput
    data: XOR<track_discountUpdateManyMutationInput, track_discountUncheckedUpdateManyWithoutEmployeeInput>
  }

  export type track_discountScalarWhereInput = {
    AND?: track_discountScalarWhereInput | track_discountScalarWhereInput[]
    OR?: track_discountScalarWhereInput[]
    NOT?: track_discountScalarWhereInput | track_discountScalarWhereInput[]
    track_discount_id?: IntFilter<"track_discount"> | number
    track_id?: IntFilter<"track_discount"> | number
    discount?: DecimalFilter<"track_discount"> | Decimal | DecimalJsLike | number | string
    offer_date?: DateTimeFilter<"track_discount"> | Date | string
    close_date?: DateTimeFilter<"track_discount"> | Date | string
    employee_id?: IntFilter<"track_discount"> | number
  }

  export type customer_reviewCreateWithoutInvoiceInput = {
    track_id: number
    rating?: number | null
    review_comment?: string | null
    customer: customerCreateNestedOneWithoutCustomer_reviewInput
  }

  export type customer_reviewUncheckedCreateWithoutInvoiceInput = {
    review_id?: number
    customer_id: number
    track_id: number
    rating?: number | null
    review_comment?: string | null
  }

  export type customer_reviewCreateOrConnectWithoutInvoiceInput = {
    where: customer_reviewWhereUniqueInput
    create: XOR<customer_reviewCreateWithoutInvoiceInput, customer_reviewUncheckedCreateWithoutInvoiceInput>
  }

  export type customer_reviewCreateManyInvoiceInputEnvelope = {
    data: customer_reviewCreateManyInvoiceInput | customer_reviewCreateManyInvoiceInput[]
    skipDuplicates?: boolean
  }

  export type customerCreateWithoutInvoiceInput = {
    customer_id: number
    first_name: string
    last_name: string
    company?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email: string
    employee?: employeeCreateNestedOneWithoutCustomerInput
    customer_review?: customer_reviewCreateNestedManyWithoutCustomerInput
  }

  export type customerUncheckedCreateWithoutInvoiceInput = {
    customer_id: number
    first_name: string
    last_name: string
    company?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email: string
    support_rep_id?: number | null
    customer_review?: customer_reviewUncheckedCreateNestedManyWithoutCustomerInput
  }

  export type customerCreateOrConnectWithoutInvoiceInput = {
    where: customerWhereUniqueInput
    create: XOR<customerCreateWithoutInvoiceInput, customerUncheckedCreateWithoutInvoiceInput>
  }

  export type invoice_lineCreateWithoutInvoiceInput = {
    invoice_line_id: number
    unit_price: Decimal | DecimalJsLike | number | string
    quantity: number
    track: trackCreateNestedOneWithoutInvoice_lineInput
  }

  export type invoice_lineUncheckedCreateWithoutInvoiceInput = {
    invoice_line_id: number
    track_id: number
    unit_price: Decimal | DecimalJsLike | number | string
    quantity: number
  }

  export type invoice_lineCreateOrConnectWithoutInvoiceInput = {
    where: invoice_lineWhereUniqueInput
    create: XOR<invoice_lineCreateWithoutInvoiceInput, invoice_lineUncheckedCreateWithoutInvoiceInput>
  }

  export type invoice_lineCreateManyInvoiceInputEnvelope = {
    data: invoice_lineCreateManyInvoiceInput | invoice_lineCreateManyInvoiceInput[]
    skipDuplicates?: boolean
  }

  export type customer_reviewUpsertWithWhereUniqueWithoutInvoiceInput = {
    where: customer_reviewWhereUniqueInput
    update: XOR<customer_reviewUpdateWithoutInvoiceInput, customer_reviewUncheckedUpdateWithoutInvoiceInput>
    create: XOR<customer_reviewCreateWithoutInvoiceInput, customer_reviewUncheckedCreateWithoutInvoiceInput>
  }

  export type customer_reviewUpdateWithWhereUniqueWithoutInvoiceInput = {
    where: customer_reviewWhereUniqueInput
    data: XOR<customer_reviewUpdateWithoutInvoiceInput, customer_reviewUncheckedUpdateWithoutInvoiceInput>
  }

  export type customer_reviewUpdateManyWithWhereWithoutInvoiceInput = {
    where: customer_reviewScalarWhereInput
    data: XOR<customer_reviewUpdateManyMutationInput, customer_reviewUncheckedUpdateManyWithoutInvoiceInput>
  }

  export type customerUpsertWithoutInvoiceInput = {
    update: XOR<customerUpdateWithoutInvoiceInput, customerUncheckedUpdateWithoutInvoiceInput>
    create: XOR<customerCreateWithoutInvoiceInput, customerUncheckedCreateWithoutInvoiceInput>
    where?: customerWhereInput
  }

  export type customerUpdateToOneWithWhereWithoutInvoiceInput = {
    where?: customerWhereInput
    data: XOR<customerUpdateWithoutInvoiceInput, customerUncheckedUpdateWithoutInvoiceInput>
  }

  export type customerUpdateWithoutInvoiceInput = {
    customer_id?: IntFieldUpdateOperationsInput | number
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    company?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    employee?: employeeUpdateOneWithoutCustomerNestedInput
    customer_review?: customer_reviewUpdateManyWithoutCustomerNestedInput
  }

  export type customerUncheckedUpdateWithoutInvoiceInput = {
    customer_id?: IntFieldUpdateOperationsInput | number
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    company?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    support_rep_id?: NullableIntFieldUpdateOperationsInput | number | null
    customer_review?: customer_reviewUncheckedUpdateManyWithoutCustomerNestedInput
  }

  export type invoice_lineUpsertWithWhereUniqueWithoutInvoiceInput = {
    where: invoice_lineWhereUniqueInput
    update: XOR<invoice_lineUpdateWithoutInvoiceInput, invoice_lineUncheckedUpdateWithoutInvoiceInput>
    create: XOR<invoice_lineCreateWithoutInvoiceInput, invoice_lineUncheckedCreateWithoutInvoiceInput>
  }

  export type invoice_lineUpdateWithWhereUniqueWithoutInvoiceInput = {
    where: invoice_lineWhereUniqueInput
    data: XOR<invoice_lineUpdateWithoutInvoiceInput, invoice_lineUncheckedUpdateWithoutInvoiceInput>
  }

  export type invoice_lineUpdateManyWithWhereWithoutInvoiceInput = {
    where: invoice_lineScalarWhereInput
    data: XOR<invoice_lineUpdateManyMutationInput, invoice_lineUncheckedUpdateManyWithoutInvoiceInput>
  }

  export type invoice_lineScalarWhereInput = {
    AND?: invoice_lineScalarWhereInput | invoice_lineScalarWhereInput[]
    OR?: invoice_lineScalarWhereInput[]
    NOT?: invoice_lineScalarWhereInput | invoice_lineScalarWhereInput[]
    invoice_line_id?: IntFilter<"invoice_line"> | number
    invoice_id?: IntFilter<"invoice_line"> | number
    track_id?: IntFilter<"invoice_line"> | number
    unit_price?: DecimalFilter<"invoice_line"> | Decimal | DecimalJsLike | number | string
    quantity?: IntFilter<"invoice_line"> | number
  }

  export type invoiceCreateWithoutInvoice_lineInput = {
    invoice_id: number
    invoice_date: Date | string
    billing_address?: string | null
    billing_city?: string | null
    billing_state?: string | null
    billing_country?: string | null
    billing_postal_code?: string | null
    total: Decimal | DecimalJsLike | number | string
    customer_review?: customer_reviewCreateNestedManyWithoutInvoiceInput
    customer: customerCreateNestedOneWithoutInvoiceInput
  }

  export type invoiceUncheckedCreateWithoutInvoice_lineInput = {
    invoice_id: number
    customer_id: number
    invoice_date: Date | string
    billing_address?: string | null
    billing_city?: string | null
    billing_state?: string | null
    billing_country?: string | null
    billing_postal_code?: string | null
    total: Decimal | DecimalJsLike | number | string
    customer_review?: customer_reviewUncheckedCreateNestedManyWithoutInvoiceInput
  }

  export type invoiceCreateOrConnectWithoutInvoice_lineInput = {
    where: invoiceWhereUniqueInput
    create: XOR<invoiceCreateWithoutInvoice_lineInput, invoiceUncheckedCreateWithoutInvoice_lineInput>
  }

  export type trackCreateWithoutInvoice_lineInput = {
    name: string
    media_type_id?: number
    genre_id?: number | null
    composer?: string | null
    milliseconds?: number
    bytes?: number | null
    unit_price?: Decimal | DecimalJsLike | number | string
    playlist_track?: playlist_trackCreateNestedManyWithoutTrackInput
    album: albumCreateNestedOneWithoutTrackInput
    track_discount?: track_discountCreateNestedManyWithoutTrackInput
  }

  export type trackUncheckedCreateWithoutInvoice_lineInput = {
    name: string
    album_id: number
    media_type_id?: number
    genre_id?: number | null
    composer?: string | null
    milliseconds?: number
    bytes?: number | null
    unit_price?: Decimal | DecimalJsLike | number | string
    track_id?: number
    playlist_track?: playlist_trackUncheckedCreateNestedManyWithoutTrackInput
    track_discount?: track_discountUncheckedCreateNestedManyWithoutTrackInput
  }

  export type trackCreateOrConnectWithoutInvoice_lineInput = {
    where: trackWhereUniqueInput
    create: XOR<trackCreateWithoutInvoice_lineInput, trackUncheckedCreateWithoutInvoice_lineInput>
  }

  export type invoiceUpsertWithoutInvoice_lineInput = {
    update: XOR<invoiceUpdateWithoutInvoice_lineInput, invoiceUncheckedUpdateWithoutInvoice_lineInput>
    create: XOR<invoiceCreateWithoutInvoice_lineInput, invoiceUncheckedCreateWithoutInvoice_lineInput>
    where?: invoiceWhereInput
  }

  export type invoiceUpdateToOneWithWhereWithoutInvoice_lineInput = {
    where?: invoiceWhereInput
    data: XOR<invoiceUpdateWithoutInvoice_lineInput, invoiceUncheckedUpdateWithoutInvoice_lineInput>
  }

  export type invoiceUpdateWithoutInvoice_lineInput = {
    invoice_id?: IntFieldUpdateOperationsInput | number
    invoice_date?: DateTimeFieldUpdateOperationsInput | Date | string
    billing_address?: NullableStringFieldUpdateOperationsInput | string | null
    billing_city?: NullableStringFieldUpdateOperationsInput | string | null
    billing_state?: NullableStringFieldUpdateOperationsInput | string | null
    billing_country?: NullableStringFieldUpdateOperationsInput | string | null
    billing_postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    total?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    customer_review?: customer_reviewUpdateManyWithoutInvoiceNestedInput
    customer?: customerUpdateOneRequiredWithoutInvoiceNestedInput
  }

  export type invoiceUncheckedUpdateWithoutInvoice_lineInput = {
    invoice_id?: IntFieldUpdateOperationsInput | number
    customer_id?: IntFieldUpdateOperationsInput | number
    invoice_date?: DateTimeFieldUpdateOperationsInput | Date | string
    billing_address?: NullableStringFieldUpdateOperationsInput | string | null
    billing_city?: NullableStringFieldUpdateOperationsInput | string | null
    billing_state?: NullableStringFieldUpdateOperationsInput | string | null
    billing_country?: NullableStringFieldUpdateOperationsInput | string | null
    billing_postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    total?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    customer_review?: customer_reviewUncheckedUpdateManyWithoutInvoiceNestedInput
  }

  export type trackUpsertWithoutInvoice_lineInput = {
    update: XOR<trackUpdateWithoutInvoice_lineInput, trackUncheckedUpdateWithoutInvoice_lineInput>
    create: XOR<trackCreateWithoutInvoice_lineInput, trackUncheckedCreateWithoutInvoice_lineInput>
    where?: trackWhereInput
  }

  export type trackUpdateToOneWithWhereWithoutInvoice_lineInput = {
    where?: trackWhereInput
    data: XOR<trackUpdateWithoutInvoice_lineInput, trackUncheckedUpdateWithoutInvoice_lineInput>
  }

  export type trackUpdateWithoutInvoice_lineInput = {
    name?: StringFieldUpdateOperationsInput | string
    media_type_id?: IntFieldUpdateOperationsInput | number
    genre_id?: NullableIntFieldUpdateOperationsInput | number | null
    composer?: NullableStringFieldUpdateOperationsInput | string | null
    milliseconds?: IntFieldUpdateOperationsInput | number
    bytes?: NullableIntFieldUpdateOperationsInput | number | null
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    playlist_track?: playlist_trackUpdateManyWithoutTrackNestedInput
    album?: albumUpdateOneRequiredWithoutTrackNestedInput
    track_discount?: track_discountUpdateManyWithoutTrackNestedInput
  }

  export type trackUncheckedUpdateWithoutInvoice_lineInput = {
    name?: StringFieldUpdateOperationsInput | string
    album_id?: IntFieldUpdateOperationsInput | number
    media_type_id?: IntFieldUpdateOperationsInput | number
    genre_id?: NullableIntFieldUpdateOperationsInput | number | null
    composer?: NullableStringFieldUpdateOperationsInput | string | null
    milliseconds?: IntFieldUpdateOperationsInput | number
    bytes?: NullableIntFieldUpdateOperationsInput | number | null
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    track_id?: IntFieldUpdateOperationsInput | number
    playlist_track?: playlist_trackUncheckedUpdateManyWithoutTrackNestedInput
    track_discount?: track_discountUncheckedUpdateManyWithoutTrackNestedInput
  }

  export type playlist_trackCreateWithoutPlaylistInput = {
    track: trackCreateNestedOneWithoutPlaylist_trackInput
  }

  export type playlist_trackUncheckedCreateWithoutPlaylistInput = {
    track_id: number
  }

  export type playlist_trackCreateOrConnectWithoutPlaylistInput = {
    where: playlist_trackWhereUniqueInput
    create: XOR<playlist_trackCreateWithoutPlaylistInput, playlist_trackUncheckedCreateWithoutPlaylistInput>
  }

  export type playlist_trackCreateManyPlaylistInputEnvelope = {
    data: playlist_trackCreateManyPlaylistInput | playlist_trackCreateManyPlaylistInput[]
    skipDuplicates?: boolean
  }

  export type playlist_trackUpsertWithWhereUniqueWithoutPlaylistInput = {
    where: playlist_trackWhereUniqueInput
    update: XOR<playlist_trackUpdateWithoutPlaylistInput, playlist_trackUncheckedUpdateWithoutPlaylistInput>
    create: XOR<playlist_trackCreateWithoutPlaylistInput, playlist_trackUncheckedCreateWithoutPlaylistInput>
  }

  export type playlist_trackUpdateWithWhereUniqueWithoutPlaylistInput = {
    where: playlist_trackWhereUniqueInput
    data: XOR<playlist_trackUpdateWithoutPlaylistInput, playlist_trackUncheckedUpdateWithoutPlaylistInput>
  }

  export type playlist_trackUpdateManyWithWhereWithoutPlaylistInput = {
    where: playlist_trackScalarWhereInput
    data: XOR<playlist_trackUpdateManyMutationInput, playlist_trackUncheckedUpdateManyWithoutPlaylistInput>
  }

  export type playlist_trackScalarWhereInput = {
    AND?: playlist_trackScalarWhereInput | playlist_trackScalarWhereInput[]
    OR?: playlist_trackScalarWhereInput[]
    NOT?: playlist_trackScalarWhereInput | playlist_trackScalarWhereInput[]
    playlist_id?: IntFilter<"playlist_track"> | number
    track_id?: IntFilter<"playlist_track"> | number
  }

  export type playlistCreateWithoutPlaylist_trackInput = {
    playlist_id: number
    name?: string | null
  }

  export type playlistUncheckedCreateWithoutPlaylist_trackInput = {
    playlist_id: number
    name?: string | null
  }

  export type playlistCreateOrConnectWithoutPlaylist_trackInput = {
    where: playlistWhereUniqueInput
    create: XOR<playlistCreateWithoutPlaylist_trackInput, playlistUncheckedCreateWithoutPlaylist_trackInput>
  }

  export type trackCreateWithoutPlaylist_trackInput = {
    name: string
    media_type_id?: number
    genre_id?: number | null
    composer?: string | null
    milliseconds?: number
    bytes?: number | null
    unit_price?: Decimal | DecimalJsLike | number | string
    invoice_line?: invoice_lineCreateNestedManyWithoutTrackInput
    album: albumCreateNestedOneWithoutTrackInput
    track_discount?: track_discountCreateNestedManyWithoutTrackInput
  }

  export type trackUncheckedCreateWithoutPlaylist_trackInput = {
    name: string
    album_id: number
    media_type_id?: number
    genre_id?: number | null
    composer?: string | null
    milliseconds?: number
    bytes?: number | null
    unit_price?: Decimal | DecimalJsLike | number | string
    track_id?: number
    invoice_line?: invoice_lineUncheckedCreateNestedManyWithoutTrackInput
    track_discount?: track_discountUncheckedCreateNestedManyWithoutTrackInput
  }

  export type trackCreateOrConnectWithoutPlaylist_trackInput = {
    where: trackWhereUniqueInput
    create: XOR<trackCreateWithoutPlaylist_trackInput, trackUncheckedCreateWithoutPlaylist_trackInput>
  }

  export type playlistUpsertWithoutPlaylist_trackInput = {
    update: XOR<playlistUpdateWithoutPlaylist_trackInput, playlistUncheckedUpdateWithoutPlaylist_trackInput>
    create: XOR<playlistCreateWithoutPlaylist_trackInput, playlistUncheckedCreateWithoutPlaylist_trackInput>
    where?: playlistWhereInput
  }

  export type playlistUpdateToOneWithWhereWithoutPlaylist_trackInput = {
    where?: playlistWhereInput
    data: XOR<playlistUpdateWithoutPlaylist_trackInput, playlistUncheckedUpdateWithoutPlaylist_trackInput>
  }

  export type playlistUpdateWithoutPlaylist_trackInput = {
    playlist_id?: IntFieldUpdateOperationsInput | number
    name?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type playlistUncheckedUpdateWithoutPlaylist_trackInput = {
    playlist_id?: IntFieldUpdateOperationsInput | number
    name?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type trackUpsertWithoutPlaylist_trackInput = {
    update: XOR<trackUpdateWithoutPlaylist_trackInput, trackUncheckedUpdateWithoutPlaylist_trackInput>
    create: XOR<trackCreateWithoutPlaylist_trackInput, trackUncheckedCreateWithoutPlaylist_trackInput>
    where?: trackWhereInput
  }

  export type trackUpdateToOneWithWhereWithoutPlaylist_trackInput = {
    where?: trackWhereInput
    data: XOR<trackUpdateWithoutPlaylist_trackInput, trackUncheckedUpdateWithoutPlaylist_trackInput>
  }

  export type trackUpdateWithoutPlaylist_trackInput = {
    name?: StringFieldUpdateOperationsInput | string
    media_type_id?: IntFieldUpdateOperationsInput | number
    genre_id?: NullableIntFieldUpdateOperationsInput | number | null
    composer?: NullableStringFieldUpdateOperationsInput | string | null
    milliseconds?: IntFieldUpdateOperationsInput | number
    bytes?: NullableIntFieldUpdateOperationsInput | number | null
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    invoice_line?: invoice_lineUpdateManyWithoutTrackNestedInput
    album?: albumUpdateOneRequiredWithoutTrackNestedInput
    track_discount?: track_discountUpdateManyWithoutTrackNestedInput
  }

  export type trackUncheckedUpdateWithoutPlaylist_trackInput = {
    name?: StringFieldUpdateOperationsInput | string
    album_id?: IntFieldUpdateOperationsInput | number
    media_type_id?: IntFieldUpdateOperationsInput | number
    genre_id?: NullableIntFieldUpdateOperationsInput | number | null
    composer?: NullableStringFieldUpdateOperationsInput | string | null
    milliseconds?: IntFieldUpdateOperationsInput | number
    bytes?: NullableIntFieldUpdateOperationsInput | number | null
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    track_id?: IntFieldUpdateOperationsInput | number
    invoice_line?: invoice_lineUncheckedUpdateManyWithoutTrackNestedInput
    track_discount?: track_discountUncheckedUpdateManyWithoutTrackNestedInput
  }

  export type invoice_lineCreateWithoutTrackInput = {
    invoice_line_id: number
    unit_price: Decimal | DecimalJsLike | number | string
    quantity: number
    invoice: invoiceCreateNestedOneWithoutInvoice_lineInput
  }

  export type invoice_lineUncheckedCreateWithoutTrackInput = {
    invoice_line_id: number
    invoice_id: number
    unit_price: Decimal | DecimalJsLike | number | string
    quantity: number
  }

  export type invoice_lineCreateOrConnectWithoutTrackInput = {
    where: invoice_lineWhereUniqueInput
    create: XOR<invoice_lineCreateWithoutTrackInput, invoice_lineUncheckedCreateWithoutTrackInput>
  }

  export type invoice_lineCreateManyTrackInputEnvelope = {
    data: invoice_lineCreateManyTrackInput | invoice_lineCreateManyTrackInput[]
    skipDuplicates?: boolean
  }

  export type playlist_trackCreateWithoutTrackInput = {
    playlist: playlistCreateNestedOneWithoutPlaylist_trackInput
  }

  export type playlist_trackUncheckedCreateWithoutTrackInput = {
    playlist_id: number
  }

  export type playlist_trackCreateOrConnectWithoutTrackInput = {
    where: playlist_trackWhereUniqueInput
    create: XOR<playlist_trackCreateWithoutTrackInput, playlist_trackUncheckedCreateWithoutTrackInput>
  }

  export type playlist_trackCreateManyTrackInputEnvelope = {
    data: playlist_trackCreateManyTrackInput | playlist_trackCreateManyTrackInput[]
    skipDuplicates?: boolean
  }

  export type albumCreateWithoutTrackInput = {
    title: string
    artist: artistCreateNestedOneWithoutAlbumInput
  }

  export type albumUncheckedCreateWithoutTrackInput = {
    title: string
    artist_id: number
    album_id?: number
  }

  export type albumCreateOrConnectWithoutTrackInput = {
    where: albumWhereUniqueInput
    create: XOR<albumCreateWithoutTrackInput, albumUncheckedCreateWithoutTrackInput>
  }

  export type track_discountCreateWithoutTrackInput = {
    discount: Decimal | DecimalJsLike | number | string
    offer_date: Date | string
    close_date: Date | string
    employee: employeeCreateNestedOneWithoutTrack_discountInput
  }

  export type track_discountUncheckedCreateWithoutTrackInput = {
    track_discount_id?: number
    discount: Decimal | DecimalJsLike | number | string
    offer_date: Date | string
    close_date: Date | string
    employee_id: number
  }

  export type track_discountCreateOrConnectWithoutTrackInput = {
    where: track_discountWhereUniqueInput
    create: XOR<track_discountCreateWithoutTrackInput, track_discountUncheckedCreateWithoutTrackInput>
  }

  export type track_discountCreateManyTrackInputEnvelope = {
    data: track_discountCreateManyTrackInput | track_discountCreateManyTrackInput[]
    skipDuplicates?: boolean
  }

  export type invoice_lineUpsertWithWhereUniqueWithoutTrackInput = {
    where: invoice_lineWhereUniqueInput
    update: XOR<invoice_lineUpdateWithoutTrackInput, invoice_lineUncheckedUpdateWithoutTrackInput>
    create: XOR<invoice_lineCreateWithoutTrackInput, invoice_lineUncheckedCreateWithoutTrackInput>
  }

  export type invoice_lineUpdateWithWhereUniqueWithoutTrackInput = {
    where: invoice_lineWhereUniqueInput
    data: XOR<invoice_lineUpdateWithoutTrackInput, invoice_lineUncheckedUpdateWithoutTrackInput>
  }

  export type invoice_lineUpdateManyWithWhereWithoutTrackInput = {
    where: invoice_lineScalarWhereInput
    data: XOR<invoice_lineUpdateManyMutationInput, invoice_lineUncheckedUpdateManyWithoutTrackInput>
  }

  export type playlist_trackUpsertWithWhereUniqueWithoutTrackInput = {
    where: playlist_trackWhereUniqueInput
    update: XOR<playlist_trackUpdateWithoutTrackInput, playlist_trackUncheckedUpdateWithoutTrackInput>
    create: XOR<playlist_trackCreateWithoutTrackInput, playlist_trackUncheckedCreateWithoutTrackInput>
  }

  export type playlist_trackUpdateWithWhereUniqueWithoutTrackInput = {
    where: playlist_trackWhereUniqueInput
    data: XOR<playlist_trackUpdateWithoutTrackInput, playlist_trackUncheckedUpdateWithoutTrackInput>
  }

  export type playlist_trackUpdateManyWithWhereWithoutTrackInput = {
    where: playlist_trackScalarWhereInput
    data: XOR<playlist_trackUpdateManyMutationInput, playlist_trackUncheckedUpdateManyWithoutTrackInput>
  }

  export type albumUpsertWithoutTrackInput = {
    update: XOR<albumUpdateWithoutTrackInput, albumUncheckedUpdateWithoutTrackInput>
    create: XOR<albumCreateWithoutTrackInput, albumUncheckedCreateWithoutTrackInput>
    where?: albumWhereInput
  }

  export type albumUpdateToOneWithWhereWithoutTrackInput = {
    where?: albumWhereInput
    data: XOR<albumUpdateWithoutTrackInput, albumUncheckedUpdateWithoutTrackInput>
  }

  export type albumUpdateWithoutTrackInput = {
    title?: StringFieldUpdateOperationsInput | string
    artist?: artistUpdateOneRequiredWithoutAlbumNestedInput
  }

  export type albumUncheckedUpdateWithoutTrackInput = {
    title?: StringFieldUpdateOperationsInput | string
    artist_id?: IntFieldUpdateOperationsInput | number
    album_id?: IntFieldUpdateOperationsInput | number
  }

  export type track_discountUpsertWithWhereUniqueWithoutTrackInput = {
    where: track_discountWhereUniqueInput
    update: XOR<track_discountUpdateWithoutTrackInput, track_discountUncheckedUpdateWithoutTrackInput>
    create: XOR<track_discountCreateWithoutTrackInput, track_discountUncheckedCreateWithoutTrackInput>
  }

  export type track_discountUpdateWithWhereUniqueWithoutTrackInput = {
    where: track_discountWhereUniqueInput
    data: XOR<track_discountUpdateWithoutTrackInput, track_discountUncheckedUpdateWithoutTrackInput>
  }

  export type track_discountUpdateManyWithWhereWithoutTrackInput = {
    where: track_discountScalarWhereInput
    data: XOR<track_discountUpdateManyMutationInput, track_discountUncheckedUpdateManyWithoutTrackInput>
  }

  export type employeeCreateWithoutTrack_discountInput = {
    employee_id: number
    last_name: string
    first_name: string
    title?: string | null
    birth_date?: Date | string | null
    hire_date: Date | string
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email?: string | null
    termination_date?: Date | string | null
    customer?: customerCreateNestedManyWithoutEmployeeInput
    employee?: employeeCreateNestedOneWithoutOther_employeeInput
    other_employee?: employeeCreateNestedManyWithoutEmployeeInput
  }

  export type employeeUncheckedCreateWithoutTrack_discountInput = {
    employee_id: number
    last_name: string
    first_name: string
    title?: string | null
    reports_to?: number | null
    birth_date?: Date | string | null
    hire_date: Date | string
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email?: string | null
    termination_date?: Date | string | null
    customer?: customerUncheckedCreateNestedManyWithoutEmployeeInput
    other_employee?: employeeUncheckedCreateNestedManyWithoutEmployeeInput
  }

  export type employeeCreateOrConnectWithoutTrack_discountInput = {
    where: employeeWhereUniqueInput
    create: XOR<employeeCreateWithoutTrack_discountInput, employeeUncheckedCreateWithoutTrack_discountInput>
  }

  export type trackCreateWithoutTrack_discountInput = {
    name: string
    media_type_id?: number
    genre_id?: number | null
    composer?: string | null
    milliseconds?: number
    bytes?: number | null
    unit_price?: Decimal | DecimalJsLike | number | string
    invoice_line?: invoice_lineCreateNestedManyWithoutTrackInput
    playlist_track?: playlist_trackCreateNestedManyWithoutTrackInput
    album: albumCreateNestedOneWithoutTrackInput
  }

  export type trackUncheckedCreateWithoutTrack_discountInput = {
    name: string
    album_id: number
    media_type_id?: number
    genre_id?: number | null
    composer?: string | null
    milliseconds?: number
    bytes?: number | null
    unit_price?: Decimal | DecimalJsLike | number | string
    track_id?: number
    invoice_line?: invoice_lineUncheckedCreateNestedManyWithoutTrackInput
    playlist_track?: playlist_trackUncheckedCreateNestedManyWithoutTrackInput
  }

  export type trackCreateOrConnectWithoutTrack_discountInput = {
    where: trackWhereUniqueInput
    create: XOR<trackCreateWithoutTrack_discountInput, trackUncheckedCreateWithoutTrack_discountInput>
  }

  export type employeeUpsertWithoutTrack_discountInput = {
    update: XOR<employeeUpdateWithoutTrack_discountInput, employeeUncheckedUpdateWithoutTrack_discountInput>
    create: XOR<employeeCreateWithoutTrack_discountInput, employeeUncheckedCreateWithoutTrack_discountInput>
    where?: employeeWhereInput
  }

  export type employeeUpdateToOneWithWhereWithoutTrack_discountInput = {
    where?: employeeWhereInput
    data: XOR<employeeUpdateWithoutTrack_discountInput, employeeUncheckedUpdateWithoutTrack_discountInput>
  }

  export type employeeUpdateWithoutTrack_discountInput = {
    employee_id?: IntFieldUpdateOperationsInput | number
    last_name?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    birth_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hire_date?: DateTimeFieldUpdateOperationsInput | Date | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    termination_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    customer?: customerUpdateManyWithoutEmployeeNestedInput
    employee?: employeeUpdateOneWithoutOther_employeeNestedInput
    other_employee?: employeeUpdateManyWithoutEmployeeNestedInput
  }

  export type employeeUncheckedUpdateWithoutTrack_discountInput = {
    employee_id?: IntFieldUpdateOperationsInput | number
    last_name?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    reports_to?: NullableIntFieldUpdateOperationsInput | number | null
    birth_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hire_date?: DateTimeFieldUpdateOperationsInput | Date | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    termination_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    customer?: customerUncheckedUpdateManyWithoutEmployeeNestedInput
    other_employee?: employeeUncheckedUpdateManyWithoutEmployeeNestedInput
  }

  export type trackUpsertWithoutTrack_discountInput = {
    update: XOR<trackUpdateWithoutTrack_discountInput, trackUncheckedUpdateWithoutTrack_discountInput>
    create: XOR<trackCreateWithoutTrack_discountInput, trackUncheckedCreateWithoutTrack_discountInput>
    where?: trackWhereInput
  }

  export type trackUpdateToOneWithWhereWithoutTrack_discountInput = {
    where?: trackWhereInput
    data: XOR<trackUpdateWithoutTrack_discountInput, trackUncheckedUpdateWithoutTrack_discountInput>
  }

  export type trackUpdateWithoutTrack_discountInput = {
    name?: StringFieldUpdateOperationsInput | string
    media_type_id?: IntFieldUpdateOperationsInput | number
    genre_id?: NullableIntFieldUpdateOperationsInput | number | null
    composer?: NullableStringFieldUpdateOperationsInput | string | null
    milliseconds?: IntFieldUpdateOperationsInput | number
    bytes?: NullableIntFieldUpdateOperationsInput | number | null
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    invoice_line?: invoice_lineUpdateManyWithoutTrackNestedInput
    playlist_track?: playlist_trackUpdateManyWithoutTrackNestedInput
    album?: albumUpdateOneRequiredWithoutTrackNestedInput
  }

  export type trackUncheckedUpdateWithoutTrack_discountInput = {
    name?: StringFieldUpdateOperationsInput | string
    album_id?: IntFieldUpdateOperationsInput | number
    media_type_id?: IntFieldUpdateOperationsInput | number
    genre_id?: NullableIntFieldUpdateOperationsInput | number | null
    composer?: NullableStringFieldUpdateOperationsInput | string | null
    milliseconds?: IntFieldUpdateOperationsInput | number
    bytes?: NullableIntFieldUpdateOperationsInput | number | null
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    track_id?: IntFieldUpdateOperationsInput | number
    invoice_line?: invoice_lineUncheckedUpdateManyWithoutTrackNestedInput
    playlist_track?: playlist_trackUncheckedUpdateManyWithoutTrackNestedInput
  }

  export type trackCreateManyAlbumInput = {
    name: string
    media_type_id?: number
    genre_id?: number | null
    composer?: string | null
    milliseconds?: number
    bytes?: number | null
    unit_price?: Decimal | DecimalJsLike | number | string
    track_id?: number
  }

  export type trackUpdateWithoutAlbumInput = {
    name?: StringFieldUpdateOperationsInput | string
    media_type_id?: IntFieldUpdateOperationsInput | number
    genre_id?: NullableIntFieldUpdateOperationsInput | number | null
    composer?: NullableStringFieldUpdateOperationsInput | string | null
    milliseconds?: IntFieldUpdateOperationsInput | number
    bytes?: NullableIntFieldUpdateOperationsInput | number | null
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    invoice_line?: invoice_lineUpdateManyWithoutTrackNestedInput
    playlist_track?: playlist_trackUpdateManyWithoutTrackNestedInput
    track_discount?: track_discountUpdateManyWithoutTrackNestedInput
  }

  export type trackUncheckedUpdateWithoutAlbumInput = {
    name?: StringFieldUpdateOperationsInput | string
    media_type_id?: IntFieldUpdateOperationsInput | number
    genre_id?: NullableIntFieldUpdateOperationsInput | number | null
    composer?: NullableStringFieldUpdateOperationsInput | string | null
    milliseconds?: IntFieldUpdateOperationsInput | number
    bytes?: NullableIntFieldUpdateOperationsInput | number | null
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    track_id?: IntFieldUpdateOperationsInput | number
    invoice_line?: invoice_lineUncheckedUpdateManyWithoutTrackNestedInput
    playlist_track?: playlist_trackUncheckedUpdateManyWithoutTrackNestedInput
    track_discount?: track_discountUncheckedUpdateManyWithoutTrackNestedInput
  }

  export type trackUncheckedUpdateManyWithoutAlbumInput = {
    name?: StringFieldUpdateOperationsInput | string
    media_type_id?: IntFieldUpdateOperationsInput | number
    genre_id?: NullableIntFieldUpdateOperationsInput | number | null
    composer?: NullableStringFieldUpdateOperationsInput | string | null
    milliseconds?: IntFieldUpdateOperationsInput | number
    bytes?: NullableIntFieldUpdateOperationsInput | number | null
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    track_id?: IntFieldUpdateOperationsInput | number
  }

  export type albumCreateManyArtistInput = {
    title: string
    album_id?: number
  }

  export type albumUpdateWithoutArtistInput = {
    title?: StringFieldUpdateOperationsInput | string
    track?: trackUpdateManyWithoutAlbumNestedInput
  }

  export type albumUncheckedUpdateWithoutArtistInput = {
    title?: StringFieldUpdateOperationsInput | string
    album_id?: IntFieldUpdateOperationsInput | number
    track?: trackUncheckedUpdateManyWithoutAlbumNestedInput
  }

  export type albumUncheckedUpdateManyWithoutArtistInput = {
    title?: StringFieldUpdateOperationsInput | string
    album_id?: IntFieldUpdateOperationsInput | number
  }

  export type customer_reviewCreateManyCustomerInput = {
    review_id?: number
    invoice_id: number
    track_id: number
    rating?: number | null
    review_comment?: string | null
  }

  export type invoiceCreateManyCustomerInput = {
    invoice_id: number
    invoice_date: Date | string
    billing_address?: string | null
    billing_city?: string | null
    billing_state?: string | null
    billing_country?: string | null
    billing_postal_code?: string | null
    total: Decimal | DecimalJsLike | number | string
  }

  export type customer_reviewUpdateWithoutCustomerInput = {
    track_id?: IntFieldUpdateOperationsInput | number
    rating?: NullableIntFieldUpdateOperationsInput | number | null
    review_comment?: NullableStringFieldUpdateOperationsInput | string | null
    invoice?: invoiceUpdateOneRequiredWithoutCustomer_reviewNestedInput
  }

  export type customer_reviewUncheckedUpdateWithoutCustomerInput = {
    review_id?: IntFieldUpdateOperationsInput | number
    invoice_id?: IntFieldUpdateOperationsInput | number
    track_id?: IntFieldUpdateOperationsInput | number
    rating?: NullableIntFieldUpdateOperationsInput | number | null
    review_comment?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type customer_reviewUncheckedUpdateManyWithoutCustomerInput = {
    review_id?: IntFieldUpdateOperationsInput | number
    invoice_id?: IntFieldUpdateOperationsInput | number
    track_id?: IntFieldUpdateOperationsInput | number
    rating?: NullableIntFieldUpdateOperationsInput | number | null
    review_comment?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type invoiceUpdateWithoutCustomerInput = {
    invoice_id?: IntFieldUpdateOperationsInput | number
    invoice_date?: DateTimeFieldUpdateOperationsInput | Date | string
    billing_address?: NullableStringFieldUpdateOperationsInput | string | null
    billing_city?: NullableStringFieldUpdateOperationsInput | string | null
    billing_state?: NullableStringFieldUpdateOperationsInput | string | null
    billing_country?: NullableStringFieldUpdateOperationsInput | string | null
    billing_postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    total?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    customer_review?: customer_reviewUpdateManyWithoutInvoiceNestedInput
    invoice_line?: invoice_lineUpdateManyWithoutInvoiceNestedInput
  }

  export type invoiceUncheckedUpdateWithoutCustomerInput = {
    invoice_id?: IntFieldUpdateOperationsInput | number
    invoice_date?: DateTimeFieldUpdateOperationsInput | Date | string
    billing_address?: NullableStringFieldUpdateOperationsInput | string | null
    billing_city?: NullableStringFieldUpdateOperationsInput | string | null
    billing_state?: NullableStringFieldUpdateOperationsInput | string | null
    billing_country?: NullableStringFieldUpdateOperationsInput | string | null
    billing_postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    total?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    customer_review?: customer_reviewUncheckedUpdateManyWithoutInvoiceNestedInput
    invoice_line?: invoice_lineUncheckedUpdateManyWithoutInvoiceNestedInput
  }

  export type invoiceUncheckedUpdateManyWithoutCustomerInput = {
    invoice_id?: IntFieldUpdateOperationsInput | number
    invoice_date?: DateTimeFieldUpdateOperationsInput | Date | string
    billing_address?: NullableStringFieldUpdateOperationsInput | string | null
    billing_city?: NullableStringFieldUpdateOperationsInput | string | null
    billing_state?: NullableStringFieldUpdateOperationsInput | string | null
    billing_country?: NullableStringFieldUpdateOperationsInput | string | null
    billing_postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    total?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
  }

  export type customerCreateManyEmployeeInput = {
    customer_id: number
    first_name: string
    last_name: string
    company?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email: string
  }

  export type employeeCreateManyEmployeeInput = {
    employee_id: number
    last_name: string
    first_name: string
    title?: string | null
    birth_date?: Date | string | null
    hire_date: Date | string
    address?: string | null
    city?: string | null
    state?: string | null
    country?: string | null
    postal_code?: string | null
    phone?: string | null
    fax?: string | null
    email?: string | null
    termination_date?: Date | string | null
  }

  export type track_discountCreateManyEmployeeInput = {
    track_discount_id?: number
    track_id: number
    discount: Decimal | DecimalJsLike | number | string
    offer_date: Date | string
    close_date: Date | string
  }

  export type customerUpdateWithoutEmployeeInput = {
    customer_id?: IntFieldUpdateOperationsInput | number
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    company?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    customer_review?: customer_reviewUpdateManyWithoutCustomerNestedInput
    invoice?: invoiceUpdateManyWithoutCustomerNestedInput
  }

  export type customerUncheckedUpdateWithoutEmployeeInput = {
    customer_id?: IntFieldUpdateOperationsInput | number
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    company?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
    customer_review?: customer_reviewUncheckedUpdateManyWithoutCustomerNestedInput
    invoice?: invoiceUncheckedUpdateManyWithoutCustomerNestedInput
  }

  export type customerUncheckedUpdateManyWithoutEmployeeInput = {
    customer_id?: IntFieldUpdateOperationsInput | number
    first_name?: StringFieldUpdateOperationsInput | string
    last_name?: StringFieldUpdateOperationsInput | string
    company?: NullableStringFieldUpdateOperationsInput | string | null
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: StringFieldUpdateOperationsInput | string
  }

  export type employeeUpdateWithoutEmployeeInput = {
    employee_id?: IntFieldUpdateOperationsInput | number
    last_name?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    birth_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hire_date?: DateTimeFieldUpdateOperationsInput | Date | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    termination_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    customer?: customerUpdateManyWithoutEmployeeNestedInput
    other_employee?: employeeUpdateManyWithoutEmployeeNestedInput
    track_discount?: track_discountUpdateManyWithoutEmployeeNestedInput
  }

  export type employeeUncheckedUpdateWithoutEmployeeInput = {
    employee_id?: IntFieldUpdateOperationsInput | number
    last_name?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    birth_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hire_date?: DateTimeFieldUpdateOperationsInput | Date | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    termination_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    customer?: customerUncheckedUpdateManyWithoutEmployeeNestedInput
    other_employee?: employeeUncheckedUpdateManyWithoutEmployeeNestedInput
    track_discount?: track_discountUncheckedUpdateManyWithoutEmployeeNestedInput
  }

  export type employeeUncheckedUpdateManyWithoutEmployeeInput = {
    employee_id?: IntFieldUpdateOperationsInput | number
    last_name?: StringFieldUpdateOperationsInput | string
    first_name?: StringFieldUpdateOperationsInput | string
    title?: NullableStringFieldUpdateOperationsInput | string | null
    birth_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    hire_date?: DateTimeFieldUpdateOperationsInput | Date | string
    address?: NullableStringFieldUpdateOperationsInput | string | null
    city?: NullableStringFieldUpdateOperationsInput | string | null
    state?: NullableStringFieldUpdateOperationsInput | string | null
    country?: NullableStringFieldUpdateOperationsInput | string | null
    postal_code?: NullableStringFieldUpdateOperationsInput | string | null
    phone?: NullableStringFieldUpdateOperationsInput | string | null
    fax?: NullableStringFieldUpdateOperationsInput | string | null
    email?: NullableStringFieldUpdateOperationsInput | string | null
    termination_date?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
  }

  export type track_discountUpdateWithoutEmployeeInput = {
    discount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    offer_date?: DateTimeFieldUpdateOperationsInput | Date | string
    close_date?: DateTimeFieldUpdateOperationsInput | Date | string
    track?: trackUpdateOneRequiredWithoutTrack_discountNestedInput
  }

  export type track_discountUncheckedUpdateWithoutEmployeeInput = {
    track_discount_id?: IntFieldUpdateOperationsInput | number
    track_id?: IntFieldUpdateOperationsInput | number
    discount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    offer_date?: DateTimeFieldUpdateOperationsInput | Date | string
    close_date?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type track_discountUncheckedUpdateManyWithoutEmployeeInput = {
    track_discount_id?: IntFieldUpdateOperationsInput | number
    track_id?: IntFieldUpdateOperationsInput | number
    discount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    offer_date?: DateTimeFieldUpdateOperationsInput | Date | string
    close_date?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type customer_reviewCreateManyInvoiceInput = {
    review_id?: number
    customer_id: number
    track_id: number
    rating?: number | null
    review_comment?: string | null
  }

  export type invoice_lineCreateManyInvoiceInput = {
    invoice_line_id: number
    track_id: number
    unit_price: Decimal | DecimalJsLike | number | string
    quantity: number
  }

  export type customer_reviewUpdateWithoutInvoiceInput = {
    track_id?: IntFieldUpdateOperationsInput | number
    rating?: NullableIntFieldUpdateOperationsInput | number | null
    review_comment?: NullableStringFieldUpdateOperationsInput | string | null
    customer?: customerUpdateOneRequiredWithoutCustomer_reviewNestedInput
  }

  export type customer_reviewUncheckedUpdateWithoutInvoiceInput = {
    review_id?: IntFieldUpdateOperationsInput | number
    customer_id?: IntFieldUpdateOperationsInput | number
    track_id?: IntFieldUpdateOperationsInput | number
    rating?: NullableIntFieldUpdateOperationsInput | number | null
    review_comment?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type customer_reviewUncheckedUpdateManyWithoutInvoiceInput = {
    review_id?: IntFieldUpdateOperationsInput | number
    customer_id?: IntFieldUpdateOperationsInput | number
    track_id?: IntFieldUpdateOperationsInput | number
    rating?: NullableIntFieldUpdateOperationsInput | number | null
    review_comment?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type invoice_lineUpdateWithoutInvoiceInput = {
    invoice_line_id?: IntFieldUpdateOperationsInput | number
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    quantity?: IntFieldUpdateOperationsInput | number
    track?: trackUpdateOneRequiredWithoutInvoice_lineNestedInput
  }

  export type invoice_lineUncheckedUpdateWithoutInvoiceInput = {
    invoice_line_id?: IntFieldUpdateOperationsInput | number
    track_id?: IntFieldUpdateOperationsInput | number
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type invoice_lineUncheckedUpdateManyWithoutInvoiceInput = {
    invoice_line_id?: IntFieldUpdateOperationsInput | number
    track_id?: IntFieldUpdateOperationsInput | number
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type playlist_trackCreateManyPlaylistInput = {
    track_id: number
  }

  export type playlist_trackUpdateWithoutPlaylistInput = {
    track?: trackUpdateOneRequiredWithoutPlaylist_trackNestedInput
  }

  export type playlist_trackUncheckedUpdateWithoutPlaylistInput = {
    track_id?: IntFieldUpdateOperationsInput | number
  }

  export type playlist_trackUncheckedUpdateManyWithoutPlaylistInput = {
    track_id?: IntFieldUpdateOperationsInput | number
  }

  export type invoice_lineCreateManyTrackInput = {
    invoice_line_id: number
    invoice_id: number
    unit_price: Decimal | DecimalJsLike | number | string
    quantity: number
  }

  export type playlist_trackCreateManyTrackInput = {
    playlist_id: number
  }

  export type track_discountCreateManyTrackInput = {
    track_discount_id?: number
    discount: Decimal | DecimalJsLike | number | string
    offer_date: Date | string
    close_date: Date | string
    employee_id: number
  }

  export type invoice_lineUpdateWithoutTrackInput = {
    invoice_line_id?: IntFieldUpdateOperationsInput | number
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    quantity?: IntFieldUpdateOperationsInput | number
    invoice?: invoiceUpdateOneRequiredWithoutInvoice_lineNestedInput
  }

  export type invoice_lineUncheckedUpdateWithoutTrackInput = {
    invoice_line_id?: IntFieldUpdateOperationsInput | number
    invoice_id?: IntFieldUpdateOperationsInput | number
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type invoice_lineUncheckedUpdateManyWithoutTrackInput = {
    invoice_line_id?: IntFieldUpdateOperationsInput | number
    invoice_id?: IntFieldUpdateOperationsInput | number
    unit_price?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    quantity?: IntFieldUpdateOperationsInput | number
  }

  export type playlist_trackUpdateWithoutTrackInput = {
    playlist?: playlistUpdateOneRequiredWithoutPlaylist_trackNestedInput
  }

  export type playlist_trackUncheckedUpdateWithoutTrackInput = {
    playlist_id?: IntFieldUpdateOperationsInput | number
  }

  export type playlist_trackUncheckedUpdateManyWithoutTrackInput = {
    playlist_id?: IntFieldUpdateOperationsInput | number
  }

  export type track_discountUpdateWithoutTrackInput = {
    discount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    offer_date?: DateTimeFieldUpdateOperationsInput | Date | string
    close_date?: DateTimeFieldUpdateOperationsInput | Date | string
    employee?: employeeUpdateOneRequiredWithoutTrack_discountNestedInput
  }

  export type track_discountUncheckedUpdateWithoutTrackInput = {
    track_discount_id?: IntFieldUpdateOperationsInput | number
    discount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    offer_date?: DateTimeFieldUpdateOperationsInput | Date | string
    close_date?: DateTimeFieldUpdateOperationsInput | Date | string
    employee_id?: IntFieldUpdateOperationsInput | number
  }

  export type track_discountUncheckedUpdateManyWithoutTrackInput = {
    track_discount_id?: IntFieldUpdateOperationsInput | number
    discount?: DecimalFieldUpdateOperationsInput | Decimal | DecimalJsLike | number | string
    offer_date?: DateTimeFieldUpdateOperationsInput | Date | string
    close_date?: DateTimeFieldUpdateOperationsInput | Date | string
    employee_id?: IntFieldUpdateOperationsInput | number
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