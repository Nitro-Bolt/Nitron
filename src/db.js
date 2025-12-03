const fs = require('fs');
const pathUtil = require('path');
const sqlite3 = require('better-sqlite3');
const config = require('../config');

const resolvedDataDirectory = pathUtil.resolve(__dirname, '..', config.dataPath);
if (!fs.existsSync(resolvedDataDirectory)) {
    throw new Error(`Data path "${resolvedDataDirectory}" does not exist. Did you forget to mount it?`);
}

const db = new sqlite3(pathUtil.join(resolvedDataDirectory, 'nitron.db'));
db.pragma('journal_mode = WAL');
db.pragma('secure_delete = true');

module.exports = db;
