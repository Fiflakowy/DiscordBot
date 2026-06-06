const Database = require('better-sqlite3');
const path = require('path');

// Inicjalizacja bazy danych (plik zostanie utworzony w głównym folderze bota)
const db = new Database('database.sqlite');

// Zwiększenie wydajności bazy danych (Write-Ahead Logging) - absolutnie kluczowe dla botów Discorda!
// Zapobiega blokowaniu bazy, gdy wielu graczy naraz pisze na czacie.
db.pragma('journal_mode = WAL');

// ==========================================================
// 1. TABELA LEVELINGU
// Przechowuje punkty doświadczenia i poziomy wędrowców.
// ==========================================================
db.prepare(`
    CREATE TABLE IF NOT EXISTS levels (
        userId TEXT,
        guildId TEXT,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 0,
        PRIMARY KEY (userId, guildId)
    )
`).run();

// ==========================================================
// 2. TABELA EKONOMII
// Przechowuje monety, aktywne wzmocnienia (boosty) ze sklepu oraz czas odbioru /daily.
// ==========================================================
db.prepare(`
    CREATE TABLE IF NOT EXISTS economy (
        userId TEXT,
        guildId TEXT,
        coins INTEGER DEFAULT 0,
        boostMultiplier REAL DEFAULT 1,
        boostExpires INTEGER DEFAULT 0,
        lastDaily INTEGER DEFAULT 0,
        PRIMARY KEY (userId, guildId)
    )
`).run();

// SZYBKI PATCH (BEZPIECZEŃSTWO DATY): 
// Jeśli masz starą bazę danych sprzed naszych potężnych aktualizacji, 
// te linijki dodadzą nowe funkcje do bazy, nie kasując starych monet graczy!
try { db.prepare('ALTER TABLE economy ADD COLUMN lastDaily INTEGER DEFAULT 0').run(); } catch (err) {}
try { db.prepare('ALTER TABLE economy ADD COLUMN boostMultiplier REAL DEFAULT 1').run(); } catch (err) {}
try { db.prepare('ALTER TABLE economy ADD COLUMN boostExpires INTEGER DEFAULT 0').run(); } catch (err) {}

// ==========================================================
// 3. TABELA OSTRZEŻEŃ (WARNY)
// Przechowuje historię naruszeń regulaminu przez graczy.
// ==========================================================
db.prepare(`
    CREATE TABLE IF NOT EXISTS warnings (
        userId TEXT,
        guildId TEXT,
        warnCount INTEGER DEFAULT 0,
        PRIMARY KEY (userId, guildId)
    )
`).run();

// ==========================================================
// 4. TABELA ZLECEŃ (TABLICA QUESTÓW)
// Przechowuje codzienne wyzwania dla członków Zakonu.
// ==========================================================
db.prepare(`
    CREATE TABLE IF NOT EXISTS quests (
        userId TEXT,
        guildId TEXT,
        msgCount INTEGER DEFAULT 0,
        msgGoal INTEGER DEFAULT 20,
        dailyDone INTEGER DEFAULT 0,
        claimed INTEGER DEFAULT 0,
        lastReset TEXT,
        PRIMARY KEY (userId, guildId)
    )
`).run();

// ==========================================================
// 5. TABELA EKWIPUNKU (KARTY DUSZ / PIRATÓW)
// Przechowuje wylosowane karty AI graczy, aby mogli je zbierać i sprzedawać.
// ==========================================================
db.prepare(`
    CREATE TABLE IF NOT EXISTS inventory (
        cardId INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT,
        guildId TEXT,
        charName TEXT,
        rarity TEXT,
        attackPower INTEGER,
        value INTEGER
    )
`).run();

console.log('📦 [BAZA DANYCH] Wszystkie tabele (Levels, Economy, Warnings, Quests, Inventory) zabezpieczone i gotowe!');

module.exports = db;