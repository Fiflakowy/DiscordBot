const db = require('../../db.js');

module.exports = (client) => {
    console.log('🎙️ [SYSTEM] Zaawansowany moduł Voice (XP + ECO + BOOSTS) załadowany!');

    // Pętla wykonuje się co 1 minutę
    setInterval(() => {
        const now = Date.now();

        client.guilds.cache.forEach(guild => {
            guild.voiceStates.cache.forEach(voiceState => {
                
                // 1. Podstawowe filtry
                if (!voiceState.member || voiceState.member.user.bot) return;
                if (!voiceState.channelId) return; // Jeśli nie jest na kanale

                // 2. SYSTEM ANTY-AFK (Bardzo rygorystyczny)
                // Gracz nic nie dostaje, jeśli:
                if (
                    voiceState.selfMute ||    // Ma wyciszony mikrofon
                    voiceState.selfDeaf ||    // Ma ogłuszone słuchawki
                    voiceState.serverMute ||  // Ma muta od admina
                    voiceState.serverDeaf ||  // Ma deafena od admina
                    (guild.afkChannelId && voiceState.channelId === guild.afkChannelId) // Jest na kanale AFK
                ) {
                    return; 
                }

                // Sprawdzamy, czy na kanale jest ktoś jeszcze (opcjonalnie - żeby nie farmić samemu)
                if (voiceState.channel.members.filter(m => !m.user.bot).size < 2) return;

                const userId = voiceState.member.user.id;
                const guildId = guild.id;

                try {
                    // 3. ZABEZPIECZENIE BAZY (Economy + Levels)
                    db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, boostMultiplier, boostExpires) VALUES (?, ?, 0, 1, 0)').run(userId, guildId);
                    db.prepare('INSERT OR IGNORE INTO levels (userId, guildId, xp, level) VALUES (?, ?, 0, 0)').run(userId, guildId);

                    const userEco = db.prepare('SELECT * FROM economy WHERE userId = ? AND guildId = ?').get(userId, guildId);

                    // 4. OBSŁUGA MULTIPLIERA ZE SKLEPU
                    let multiplier = 1;
                    if (userEco.boostExpires > now) {
                        multiplier = userEco.boostMultiplier;
                    } else if (userEco.boostMultiplier > 1) {
                        // Reset wygasłego boosta
                        db.prepare('UPDATE economy SET boostMultiplier = 1, boostExpires = 0 WHERE userId = ? AND guildId = ?').run(userId, guildId);
                    }

                    // 5. DEFINICJA NAGRÓD BAZOWYCH
                    let baseCoins = 5; // Bazowo 5 monet na minutę
                    let baseXP = 20;   // Bazowo 20 XP na minutę

                    // BONUSY (Za aktywność wizualną)
                    if (voiceState.streaming) { baseCoins += 3; baseXP += 10; } // Streamuje grę
                    if (voiceState.selfVideo) { baseCoins += 5; baseXP += 15; } // Ma włączoną kamerkę

                    // 6. FINALNA KALKULACJA (Uwzględniamy boost ze sklepu)
                    const finalCoins = Math.floor(baseCoins * multiplier);
                    const finalXP = Math.floor(baseXP * multiplier);

                    // 7. ZAPIS DO BAZY
                    // Dodajemy monety
                    db.prepare('UPDATE economy SET coins = coins + ? WHERE userId = ? AND guildId = ?').run(finalCoins, userId, guildId);
                    
                    // Dodajemy XP
                    db.prepare('UPDATE levels SET xp = xp + ? WHERE userId = ? AND guildId = ?').run(finalXP, userId, guildId);

                    // --- SYSTEM LEVEL-UP W VOICE (Opcjonalnie) ---
                    // Sprawdzamy czy nie awansował siedząc na voice
                    const userProfile = db.prepare('SELECT * FROM levels WHERE userId = ? AND guildId = ?').get(userId, guildId);
                    const xpNeeded = (userProfile.level + 1) * (userProfile.level + 1) * 100;

                    if (userProfile.xp >= xpNeeded) {
                        const newLvl = userProfile.level + 1;
                        db.prepare('UPDATE levels SET level = ? WHERE userId = ? AND guildId = ?').run(newLvl, userId, guildId);
                        
                        // Logujemy awans do konsoli lub wysyłamy na kanał (jeśli chcesz)
                        console.log(`🆙 [LEVEL UP] ${voiceState.member.user.username} awansował na ${newLvl} poziom siedząc na Voice!`);
                    }

                } catch (err) {
                    console.error('❌ [VOICE SYSTEM ERROR]:', err);
                }
            });
        });
    }, 60000); // Co minutę
};