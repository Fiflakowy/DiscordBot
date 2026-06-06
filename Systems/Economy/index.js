const db = require('../../db.js');
const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    console.log('🎙️ [SYSTEM] Moduł nagród za kanały głosowe (Voice + Anti-Farm) załadowany!');

    const LEVEL_UP_CHANNEL_ID = '1503163821324501022'; // Twój kanał do awansów

    // Pętla wykonuje się co dokładnie 60 000 milisekund (1 minuta)
    setInterval(() => {
        const now = Date.now();
        const today = new Date(now).toISOString().split('T')[0];

        // Przeszukujemy wszystkie serwery, na których jest bot
        client.guilds.cache.forEach(guild => {
            
            // Przeszukujemy wszystkich graczy na kanałach głosowych
            guild.voiceStates.cache.forEach(async voiceState => {
                
                // 1. Omijamy boty
                if (voiceState.member.user.bot) return;

                // 2. SYSTEM ANTY-FARM (ZABEZPIECZENIA)
                const channel = voiceState.channel;
                if (!channel) return;

                // Muszą być min. 2 osoby na kanale, żeby naliczało nagrody (nikt nie zarabia za gadanie do siebie)
                if (channel.members.filter(m => !m.user.bot).size < 2) return;

                if (
                    voiceState.selfMute ||        // Wyciszył sam siebie (mikrofon)
                    voiceState.selfDeaf ||        // Wyciszył słuchawki
                    voiceState.serverMute ||      // Został wyciszony przez admina
                    voiceState.serverDeaf ||      // Został ogłuszony przez admina
                    (guild.afkChannelId && voiceState.channelId === guild.afkChannelId) // Siedzi na kanale AFK
                ) {
                    return; // Przerywamy, nic nie dostaje
                }

                const userId = voiceState.member.user.id;
                const guildId = guild.id;

                try {
                    // 3. SYNCHRONIZACJA Z BAZĄ (Wszystkie tabele)
                    db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, boostMultiplier, boostExpires, lastDaily) VALUES (?, ?, 0, 1, 0, 0)').run(userId, guildId);
                    db.prepare('INSERT OR IGNORE INTO levels (userId, guildId, xp, level) VALUES (?, ?, 0, 0)').run(userId, guildId);
                    db.prepare('INSERT OR IGNORE INTO quests (userId, guildId, msgCount, msgGoal, dailyDone, claimed, lastReset) VALUES (?, ?, 0, 20, 0, 0, ?)').run(userId, guildId, today);

                    // Pobieramy status boosta
                    const userEco = db.prepare('SELECT boostMultiplier, boostExpires FROM economy WHERE userId = ? AND guildId = ?').get(userId, guildId);
                    
                    let multiplier = 1;
                    if (userEco.boostExpires > now) {
                        multiplier = userEco.boostMultiplier;
                    } else if (userEco.boostMultiplier > 1) {
                        db.prepare('UPDATE economy SET boostMultiplier = 1, boostExpires = 0 WHERE userId = ? AND guildId = ?').run(userId, guildId);
                    }

                    // 4. PRZYZNAWANIE NAGRODY (Monety + XP)
                    const coinsPerMinute = 2; // Monety za minutę
                    const xpPerMinute = 10;   // XP za minutę

                    const finalCoins = Math.floor(coinsPerMinute * multiplier);
                    const finalXP = Math.floor(xpPerMinute * multiplier);

                    db.prepare('UPDATE economy SET coins = coins + ? WHERE userId = ? AND guildId = ?').run(finalCoins, userId, guildId);
                    db.prepare('UPDATE levels SET xp = xp + ? WHERE userId = ? AND guildId = ?').run(finalXP, userId, guildId);

                    // 5. SPRAWDZANIE CZY UŻYTKOWNIK WBIŁ LEVEL PRZEZ SIEDZENIE NA VOICE
                    let userProfile = db.prepare('SELECT xp, level FROM levels WHERE userId = ? AND guildId = ?').get(userId, guildId);
                    let currentLevel = userProfile.level;
                    let currentXP = userProfile.xp;
                    let leveledUp = false;

                    let xpNeeded = (currentLevel + 1) * (currentLevel + 1) * 100;

                    while (currentXP >= xpNeeded) {
                        currentLevel++;
                        leveledUp = true;
                        xpNeeded = (currentLevel + 1) * (currentLevel + 1) * 100; 
                    }

                    if (leveledUp) {
                        db.prepare('UPDATE levels SET level = ? WHERE userId = ? AND guildId = ?').run(currentLevel, userId, guildId);
                        const levelBonus = currentLevel * 50;
                        db.prepare('UPDATE economy SET coins = coins + ? WHERE userId = ? AND guildId = ?').run(levelBonus, userId, guildId);

                        const levelUpChannel = guild.channels.cache.get(LEVEL_UP_CHANNEL_ID);
                        if (levelUpChannel) {
                            const levelUpEmbed = new EmbedBuilder()
                                .setColor('#FFD700')
                                .setTitle('🎉 Awans w Hierarchii Zakonu!')
                                .setThumbnail(voiceState.member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                                .setDescription(`Chwała! <@${userId}> zdobył wiedzę słuchając braci na kanale głosowym i osiągnął **${currentLevel} poziom**!`)
                                .addFields(
                                    { name: '💰 Nagroda', value: `W Twoje ręce wpada **${levelBonus} monet**!`, inline: true },
                                    { name: '📈 Następny cel', value: `Wymaga **${xpNeeded} XP**`, inline: true }
                                )
                                .setImage('https://media.giphy.com/media/g9582DNuQppxC/giphy.gif')
                                .setFooter({ text: 'Zakon Fiflaka rośnie w siłę!' })
                                .setTimestamp();

                            await levelUpChannel.send({ content: `Gratulacje, <@${userId}>! 🍻`, embeds: [levelUpEmbed] });
                        }
                    }

                } catch (err) {
                    console.error('❌ [VOICE REWARDS] Błąd:', err);
                }
            });
        });
    }, 60000); 
};