
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 6.2.1
 * Query Engine version: 4123509d24aa4dede1e864b46351bf2790323b69
 */
Prisma.prismaVersion = {
  client: "6.2.1",
  engine: "4123509d24aa4dede1e864b46351bf2790323b69"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.AlbumScalarFieldEnum = {
  title: 'title',
  artist_id: 'artist_id',
  album_id: 'album_id'
};

exports.Prisma.ArtistScalarFieldEnum = {
  name: 'name',
  artist_id: 'artist_id'
};

exports.Prisma.CustomerScalarFieldEnum = {
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

exports.Prisma.Customer_reviewScalarFieldEnum = {
  review_id: 'review_id',
  customer_id: 'customer_id',
  invoice_id: 'invoice_id',
  track_id: 'track_id',
  rating: 'rating',
  review_comment: 'review_comment'
};

exports.Prisma.EmployeeScalarFieldEnum = {
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

exports.Prisma.GenreScalarFieldEnum = {
  genre_id: 'genre_id',
  name: 'name'
};

exports.Prisma.InvoiceScalarFieldEnum = {
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

exports.Prisma.Invoice_lineScalarFieldEnum = {
  invoice_line_id: 'invoice_line_id',
  invoice_id: 'invoice_id',
  track_id: 'track_id',
  unit_price: 'unit_price',
  quantity: 'quantity'
};

exports.Prisma.Media_typeScalarFieldEnum = {
  media_type_id: 'media_type_id',
  name: 'name'
};

exports.Prisma.PlaylistScalarFieldEnum = {
  playlist_id: 'playlist_id',
  name: 'name'
};

exports.Prisma.Playlist_trackScalarFieldEnum = {
  playlist_id: 'playlist_id',
  track_id: 'track_id'
};

exports.Prisma.TrackScalarFieldEnum = {
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

exports.Prisma.Track_discountScalarFieldEnum = {
  track_discount_id: 'track_discount_id',
  track_id: 'track_id',
  discount: 'discount',
  offer_date: 'offer_date',
  close_date: 'close_date',
  employee_id: 'employee_id'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
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

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
