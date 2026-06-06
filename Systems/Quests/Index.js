const db = require('../../db.js');

// Pamięć podręczna Karczmarza: Kto kiedy ostatnio coś powiedział? (Anti-Farm)
const talkCooldowns = new Map();
const COOLDOWN_TIME = 10000; // 10 sekund przerwy, by wiadomość wliczyła się do questa

module.exports = (client) => {
    client.on('messageCreate', (message) => {
        // Ignorujemy boty i wiadomości w prywatnych komnatach (DM)
        if (!message.guild || message.author.bot) return;

        const userId = message.author.id;
        const guildId = message.guild.id;
        
        // Pobieramy dzisiejszą datę
        const today = new Date().toISOString().split('T')[0];

        // --- ZABEZPIECZENIE ANTI-FARM (Cooldown na questy) ---
        const now = Date.now();
        if (talkCooldowns.has(userId)) {
            const lastTalk = talkCooldowns.get(userId);
            if (now - lastTalk < COOLDOWN_TIME) {
                // Gracz pisze za szybko! Nie zaliczamy tej wiadomości do Tablicy
                return; 
            }
        }
        // Zapisujemy czas wypowiedzi gracza
        talkCooldowns.set(userId, now);

        // --- BAZA DANYCH ZLECEŃ ---
        // Sprawdzamy czy wędrowiec podjął się już dzisiejszych wyzwań
        let quest = db.prepare('SELECT * FROM quests WHERE userId = ? AND guildId = ?').get(userId, guildId);

        if (!quest || quest.lastReset !== today) {
            // Karczmarz wiesza nowe zlecenia na Tablicy o poranku!
            const newGoal = Math.floor(Math.random() * 20) + 20; // Losowy cel od 20 do 40 wiadomości
            
            db.prepare(`
                INSERT OR REPLACE INTO quests (userId, guildId, msgCount, msgGoal, dailyDone, claimed, lastReset) 
                VALUES (?, ?, 1, ?, 0, 0, ?)
            `).run(userId, guildId, newGoal, today); 
            // UWAGA: msgCount wynosi 1, bo gracz właśnie napisał swoją pierwszą wiadomość!
            
        } else {
            // Jeśli gracz ma już questy, upewniamy się, że nie przebił jeszcze limitu i dodajemy punkcik
            if (quest.msgCount < quest.msgGoal) {
                db.prepare('UPDATE quests SET msgCount = msgCount + 1 WHERE userId = ? AND guildId = ?').run(userId, guildId);
            }
        }
    });

    console.log('📜 [SYSTEM] Magiczna Tablica Zleceń (Questy + Anti-Farm) uważnie słucha!');
};