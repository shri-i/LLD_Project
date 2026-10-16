const path = require('node:path');

// Load backend/.env no matter which directory the server is started from.
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = require('./app');

const port = Number.parseInt(process.env.PORT || '4000', 10);
const server = app.listen(port, () => {
  console.log(`BookMyShow API listening on port ${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
