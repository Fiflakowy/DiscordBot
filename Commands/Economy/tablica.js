const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tablica')
        .setDescription('Otwórz Tablicę Królewskich Zleceń Zakonu Fiflaka'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const today = new Date().toISOString().split('T')[0];

        // 1. Pobieranie danych (Questy i Ekonomia dla COMBO)
        let quest = db.prepare('SELECT * FROM quests WHERE userId = ? AND guildId = ?').get(userId, guildId);
        
        // Zabezpieczenie ekonomii
        db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, boostMultiplier, boostExpires, lastDaily) VALUES (?, ?, 0, 1, 0, 0)').run(userId, guildId);
        const eco = db.prepare('SELECT boostMultiplier, boostExpires FROM economy WHERE userId = ? AND guildId = ?').get(userId, guildId);

        if (!quest || quest.lastReset !== today) {
            return interaction.reply({ 
                content: "📜 **Pusta karta!** Karczmarz nie zdążył jeszcze przypiąć Twoich zleceń na dziś. Napisz cokolwiek na czacie głównym, aby aktywować misje!", 
                ephemeral: true 
            });
        }

        // 2. Logika COMBO i Nagród
        const baseReward = 1000;
        let finalReward = baseReward;
        let comboText = "Brak (Kup eliksir w `/sklep`!)";
        let hasCombo = false;

        if (eco.boostExpires > Date.now() && eco.boostMultiplier > 1) {
            finalReward = Math.floor(baseReward * eco.boostMultiplier);
            comboText = `🔥 **x${eco.boostMultiplier}** (Zyskujesz **${finalReward}** 🪙!)`;
            hasCombo = true;
        }

        // 3. Statusy i Paski Postępu
        const isReady = (quest.msgCount >= quest.msgGoal && quest.dailyDone === 1);
        
        // Funkcja do rysowania paska [▓▓▓▓▓░░░░░]
        const progressRatio = Math.min(quest.msgCount / quest.msgGoal, 1);
        const filledBars = Math.round(progressRatio * 10);
        const emptyBars = 10 - filledBars;
        const progressBar = `\`[${'▓'.repeat(filledBars)}${'░'.repeat(emptyBars)}]\``;

        const msgStatus = quest.msgCount >= quest.msgGoal ? '✅ **Wykonano**' : `⏳ **W trakcie** (${quest.msgCount}/${quest.msgGoal})`;
        const dailyStatus = quest.dailyDone === 1 ? '✅ **Odebrano**' : '❌ **Oczekuje** (Wpisz `/daily`)';

        // 4. Budowanie wyglądu (Embed)
        const embed = new EmbedBuilder()
            .setColor('#e4c464') // Złoto Zakonu Fiflaka
            .setAuthor({ name: 'Zakon Fiflaka', iconURL: interaction.guild.iconURL({ dynamic: true }) })
            .setTitle('📜 Tablica Królewskich Zleceń')
            .setThumbnail('https://i.imgur.com/lr2a9gN.png')
            .setDescription(`Witaj, wędrowcze <@${userId}>! Oto zadania, które Karczmarz wywiesił dla Ciebie na dziś. Wypełnij je, by zdobyć złoto!`)
            .addFields(
                { name: '💬 Rozgadany Wędrowiec', value: `> Cel: Napisz **${quest.msgGoal}** wiadomości w Karczmie\n> Postęp: ${progressBar} ${msgStatus}`, inline: false },
                { name: '💰 Poranna Rutyna', value: `> Cel: Odbierz dzisiejszą zapomogę\n> Postęp: ${dailyStatus}`, inline: false },
                { name: '✨ Aktywne COMBO (Premia)', value: `> Mnożnik Eliksiru: ${comboText}`, inline: false }
            )
            .setFooter({ text: 'Zlecenia i zadania odnawiają się o północy!' });

        if (quest.claimed === 1) {
            embed.setColor('#2ECC71');
            embed.addFields({ name: '🎁 Status', value: '✅ Wszystkie nagrody za dziś zostały już zgarnięte. Wróć jutro!' });
            return interaction.reply({ embeds: [embed] });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('claim_quests')
                .setLabel(hasCombo ? `Odbierz COMBO: ${finalReward} Monet!` : `Odbierz ${finalReward} Monet`)
                .setStyle(hasCombo ? ButtonStyle.Danger : ButtonStyle.Success) // Czerwony przycisk jeśli jest super combo!
                .setEmoji('💰')
                .setDisabled(!isReady)
        );

        const response = await interaction.reply({ embeds: [embed], components: [row] });

        // 5. Obsługa przycisku odbioru nagrody
        const filter = i => i.customId === 'claim_quests' && i.user.id === interaction.user.id;
        const collector = response.createMessageComponentCollector({ filter, time: 120000 }); // 2 minuty na kliknięcie

        collector.on('collect', async i => {
            // Ponownie pobieramy stan ekonomii na wypadek, gdyby eliksir wygasł w trakcie oglądania tablicy
            const currentEco = db.prepare('SELECT boostMultiplier, boostExpires FROM economy WHERE userId = ? AND guildId = ?').get(userId, guildId);
            let actualReward = baseReward;
            if (currentEco.boostExpires > Date.now() && currentEco.boostMultiplier > 1) {
                actualReward = Math.floor(baseReward * currentEco.boostMultiplier);
            }

            // Oznaczamy questa jako odebranego i dodajemy monety
            db.prepare('UPDATE quests SET claimed = 1 WHERE userId = ? AND guildId = ?').run(userId, guildId);
            db.prepare('UPDATE economy SET coins = coins + ? WHERE userId = ? AND guildId = ?').run(actualReward, userId, guildId);

            // Epicki Embed Sukcesu
            const successEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('🎉 Zlecenia Wykonane!')
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .setDescription(`Karczmarz rzuca Ci na stół ciężki worek złota. Odwaliłeś dziś kawał dobrej roboty!`)
                .addFields(
                    { name: 'Otrzymane Złoto', value: `**+${actualReward} 🪙**`, inline: true },
                    { name: 'Combo', value: currentEco.boostMultiplier > 1 ? `**x${currentEco.boostMultiplier}**` : 'Brak', inline: true }
                )
                .setFooter({ text: 'Zakon Fiflaka dziękuje za Twoje zasługi.' });

            await i.update({ embeds: [successEmbed], components: [] });
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && !quest.claimed) {
                // Usuwamy przycisk jeśli gracz nie kliknął go przez 2 minuty
                interaction.editReply({ components: [] }).catch(() => {});
            }
        });
    }
};