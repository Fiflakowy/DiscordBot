const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('history')
        .setDescription('Sprawdź szczegółową kartotekę i historię obywatela')
        .addUserOption(option => 
            option.setName('uzytkownik')
            .setDescription('Wybierz osobę do prześwietlenia')
            .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('uzytkownik');
        const userId = targetUser.id;
        const guildId = interaction.guild.id;

        if (targetUser.bot) return interaction.reply({ content: '🤖 Boty nie łamią regulaminu. Karczmarz ręczy za nie głową!', ephemeral: true });

        // Próbujemy pobrać "Membera" (żeby sprawdzić czy ma aktywnego Mute'a / Timeout na serwerze)
        let targetMember;
        try {
            targetMember = await interaction.guild.members.fetch(userId);
        } catch (err) {
            // Użytkownik mógł już opuścić serwer
        }

        // --- POBIERANIE DANYCH Z BAZY ---
        const eco = db.prepare('SELECT * FROM economy WHERE userId = ? AND guildId = ?').get(userId, guildId) || { coins: 0, boostMultiplier: 1, boostExpires: 0 };
        const lvl = db.prepare('SELECT * FROM levels WHERE userId = ? AND guildId = ?').get(userId, guildId) || { xp: 0, level: 0 };
        const warn = db.prepare('SELECT * FROM warnings WHERE userId = ? AND guildId = ?').get(userId, guildId) || { warnCount: 0 };
        
        const today = new Date().toISOString().split('T')[0];
        const quest = db.prepare('SELECT * FROM quests WHERE userId = ? AND guildId = ? AND lastReset = ?').get(userId, guildId, today) || { msgCount: 0, msgGoal: 20, dailyDone: 0 };

        const now = Date.now();

        // --- OBLICZENIA I STATUSY ---
        // 1. Kary i Mute (Timeout)
        let timeoutStatus = '🟢 Brak aktywnego wyciszenia';
        if (targetMember && targetMember.communicationDisabledUntilTimestamp && targetMember.communicationDisabledUntilTimestamp > now) {
            timeoutStatus = `🔴 **Wyciszony do:** <t:${Math.floor(targetMember.communicationDisabledUntilTimestamp / 1000)}:R>`;
        }

        let warnsLeftInfo = '';
        if (warn.warnCount < 3) {
            warnsLeftInfo = `*(Brakuje **${3 - warn.warnCount}** ostrz. do wyciszenia na 10 min)*`;
        } else if (warn.warnCount >= 3 && warn.warnCount < 5) {
            warnsLeftInfo = `*(Brakuje **${5 - warn.warnCount}** ostrz. do wyciszenia na 24h)*`;
        } else {
            warnsLeftInfo = `*(Przekroczono limit kar automatycznych!)*`;
        }

        // 2. Ekonomia i Poziomy
        const boostStatus = (eco.boostExpires > now) ? `✅ Aktywny (**x${eco.boostMultiplier}**) do <t:${Math.floor(eco.boostExpires / 1000)}:t>` : '❌ Brak';
        const xpNeeded = (lvl.level + 1) * (lvl.level + 1) * 100;

        // 3. Dzisiejsze Questy
        const dailyStatus = quest.dailyDone === 1 ? '✅ Odebrano' : '❌ Nie odebrano';
        
        // --- TWORZENIE EMBEDA ---
        const historyEmbed = new EmbedBuilder()
            .setColor(warn.warnCount >= 3 ? '#E74C3C' : '#2ECC71') // Czerwony jeśli dużo warnów, zielony jeśli czysto
            .setAuthor({ name: `Kartoteka Straży: ${targetUser.username}`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '⚖️ Status Moderacyjny', value: `Obecne ostrzeżenia: **${warn.warnCount}**\n${warnsLeftInfo}\n\nKnebel (Timeout): \n${timeoutStatus}`, inline: false },
                { name: '💰 Stan Skarbca', value: `Monety: **${eco.coins}** 🪙\nMagiczny Eliksir:\n${boostStatus}`, inline: true },
                { name: '📈 Doświadczenie', value: `Poziom: **${lvl.level}**\nObecne XP: **${lvl.xp}** / ${xpNeeded}`, inline: true },
                { name: '📜 Dzisiejsze Zlecenia', value: `Wiadomości: **${quest.msgCount} / ${quest.msgGoal}**\nZapomoga (/daily): **${dailyStatus}**`, inline: false },
                { name: '📅 Informacje Ogólne', value: `Konto stworzone: <t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>\nDołączył do Zakonu: ${targetMember ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>` : 'Opuścił serwer'}\nID Obywatela: \`${userId}\``, inline: false }
            )
            .setFooter({ text: 'Raport wygenerowany przez Najwyższą Straż Zakonu' })
            .setTimestamp();

        await interaction.reply({ embeds: [historyEmbed] });
    }
};