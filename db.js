const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ======================================================
// KONFIGURACJA ŚCIEŻKI BAZY (Railway + Volume)
// ======================================================
const DATA_DIR = '/data';                    // Railway Persistent Volume
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

// Tworzenie folderu /data jeśli nie istnieje
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('📁 [DB] Utworzono folder /data');
}

// Inicjalizacja bazy danych
const db = new Database(DB_PATH, {
    verbose: null,           // Możesz zmienić na console.log jeśli chcesz debugować zapytania
});

// Włącz Write-Ahead Logging + optymalizacje
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = 10000');

console.log(`📦 [DB] Połączono z bazą: ${DB_PATH}`);

// ==========================================================
// 1. TABELA LEVELINGU
// ==========================================================
db.prepare(`
    CREATE TABLE IF NOT EXISTS levels (
        userId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 0,
        PRIMARY KEY (userId, guildId)
    )
`).run();

// ==========================================================
// 2. TABELA EKONOMII
// ==========================================================
db.prepare(`
    CREATE TABLE IF NOT EXISTS economy (
        userId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        coins INTEGER DEFAULT 0,
        boostMultiplier REAL DEFAULT 1,
        boostExpires INTEGER DEFAULT 0,
        lastDaily INTEGER DEFAULT 0,
        PRIMARY KEY (userId, guildId)
    )
`).run();

// Patchy bezpieczeństwa (dla starych baz)
const patches = [
    'ALTER TABLE economy ADD COLUMN lastDaily INTEGER DEFAULT 0',
    'ALTER TABLE economy ADD COLUMN boostMultiplier REAL DEFAULT 1',
    'ALTER TABLE economy ADD COLUMN boostExpires INTEGER DEFAULT 0'
];

patches.forEach(sql => {
    try {
        db.prepare(sql).run();
    } catch (err) {
        // Kolumna już istnieje — ignorujemy błąd
    }
});

// ==========================================================
// 3. TABELA OSTRZEŻEŃ (WARNY)
// ==========================================================
db.prepare(`
    CREATE TABLE IF NOT EXISTS warnings (
        userId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        warnCount INTEGER DEFAULT 0,
        PRIMARY KEY (userId, guildId)
    )
`).run();

// ==========================================================
// 4. TABELA QUESTÓW / TABLICY
// ==========================================================
db.prepare(`
    CREATE TABLE IF NOT EXISTS quests (
        userId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        msgCount INTEGER DEFAULT 0,
        msgGoal INTEGER DEFAULT 20,
        dailyDone INTEGER DEFAULT 0,
        claimed INTEGER DEFAULT 0,
        lastReset TEXT,
        PRIMARY KEY (userId, guildId)
    )
`).run();

// ==========================================================
// 5. TABELA EKWIPUNKU (Karty Duszy / Piratów)
// ==========================================================
db.prepare(`
    CREATE TABLE IF NOT EXISTS inventory (
        cardId INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        charName TEXT,
        rarity TEXT,
        attackPower INTEGER DEFAULT 0,
        value INTEGER DEFAULT 0
    )
`).run();

console.log('✅ [DB] Wszystkie tabele utworzone i gotowe do użycia!');

module.exports = db;
