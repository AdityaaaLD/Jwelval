export default {
  schema: './src/db/schema.js',
  out: './db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './db/jewelval.db',
  },
}
