const fs = require('fs');
const pathUtil = require('path');
const sqlite3 = require('better-sqlite3');
const config = require('../config');

const resolvedDataDirectory = pathUtil.resolve(__dirname, '..', config.dataPath);
if (!fs.existsSync(resolvedDataDirectory)) {
    throw new Error(`Data path "${resolvedDataDirectory}" does not exist. Did you forget to mount it?`);
}

const db = new sqlite3(pathUtil.join(resolvedDataDirectory, 'bots.db'));
db.pragma('journal_mode = WAL');
db.pragma('secure_delete = true');
db.prepare(`
    CREATE TABLE IF NOT EXISTS tracked_ids (
        user_id TEXT PRIMARY KEY,
        created INTEGER
    )
`).run();
db.prepare(`
    CREATE TABLE IF NOT EXISTS image_hashes (
        hash TEXT PRIMARY KEY
    )    
`).run();

module.exports = db;

// idk what nitron.db does, so I made bots.db specifically to store the scam bot stuff, just lmk if I can do anything with nitron.db - blu