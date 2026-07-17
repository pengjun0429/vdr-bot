const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', '..', 'data', 'messages.json');
const MAX_LOG = 5000;

let cache = [];

function load() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      cache = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
    }
  } catch { cache = []; }
}

function save() {
  if (!fs.existsSync(path.dirname(LOG_FILE))) fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(cache.slice(-MAX_LOG)), 'utf-8');
}

function log(type, data) {
  cache.push({ type, ...data, timestamp: new Date().toISOString() });
  if (cache.length > MAX_LOG) cache = cache.slice(-MAX_LOG);
  save();
}

function getRecent(limit = 50) {
  return cache.slice(-limit).reverse();
}

load();

module.exports = { log, getRecent, load };
