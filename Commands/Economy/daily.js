const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Odbierz swoją codzienną zapomogę z kasy Zakonu!'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const dailyReward = 500; // Ile monet dostaje gracz? (Możesz zmienić)
        const cooldown = 24 * 60 * 60 * 1000; // 24 godziny w milisekundach
        const now = Date.now();
        
        // Pobieramy dzisiejszą datę do systemu zadań (np. "2026-05-11")
        const today = new Date(now).toISOString().split('T')[0]; 

        // 1. Zabezpieczenie: Dodajemy gracza do bazy, jeśli go tam nie ma
        db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, boostMultiplier, boostExpires, lastDaily) VALUES (?, ?, 0, 1, 0, 0)').run(userId, guildId);
        db.prepare('INSERT OR IGNORE INTO quests (userId, guildId, msgCount, msgGoal, dailyDone, claimed, lastReset) VALUES (?, ?, 0, 20, 0, 0, ?)').run(userId, guildId, today);

        // 2. Pobieramy dane z bazy
        const userEco = db.prepare('SELECT coins, lastDaily FROM economy WHERE userId = ? AND guildId = ?').get(userId, guildId);
        const timeSinceLastDaily = now - userEco.lastDaily;

        // 3. Sprawdzamy, czy minęły już 24 godziny
        if (timeSinceLastDaily < cooldown) {
            const timeLeft = cooldown - timeSinceLastDaily;
            const nextDailyTime = Math.floor((now + timeLeft) / 1000); // Format Discorda pod odliczanie

            return interaction.reply({ 
                content: `⏳ Byłeś tu całkiem niedawno! Karczmarz da Ci kolejne monety <t:${nextDailyTime}:R>.`, 
                ephemeral: true 
            });
        }

        // 4. Sukces! Dajemy nagrodę i ustawiamy czas ostatniego odbioru na TERAZ
        db.prepare('UPDATE economy SET coins = coins + ?, lastDaily = ? WHERE userId = ? AND guildId = ?').run(dailyReward, now, userId, guildId);
        
        // 5. INTEGRACJA Z TABLICĄ ZLECEŃ: Oznaczamy zadanie /daily jako zrobione (dailyDone = 1)
        db.prepare('UPDATE quests SET dailyDone = 1 WHERE userId = ? AND guildId = ? AND lastReset = ?').run(userId, guildId, today);

        // Pobieramy nowy stan konta do ładnego wyświetlenia
        const newEco = db.prepare('SELECT coins FROM economy WHERE userId = ? AND guildId = ?').get(userId, guildId);

        // 6. Wysyłamy klimatyczny Embed
        const embed = new EmbedBuilder()
            .setColor('#D4AF37')
            .setTitle('💰 Codzienna Zapomoga')
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setDescription(`Karczmarz rzuca Ci na stół ciężki mieszek ze złotem!\nOdebrałeś **${dailyReward} monet**.`)
            .addFields(
                { name: '🏦 Aktualny stan konta', value: `**${newEco.coins}** 🪙`, inline: false },
                { name: '📜 Tablica Zleceń', value: 'Zaliczyłeś zadanie "Poranna Rutyna"! Wpisz `/tablica`, aby sprawdzić postępy.', inline: false }
            )
            .setFooter({ text: 'Wróć jutro po więcej!' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};