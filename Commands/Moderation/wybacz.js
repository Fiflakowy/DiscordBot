const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wybacz')
        .setDescription('Okaż litość i zdejmij ostrzeżenia z kartoteki obywatela')
        .addUserOption(option => 
            option.setName('uzytkownik')
            .setDescription('Wybierz wędrowca, któremu chcesz okazać łaskę')
            .setRequired(true)
        )
        .addIntegerOption(option => 
            option.setName('ilosc')
            .setDescription('Ile ostrzeżeń usunąć z akt? (domyślnie 1)')
            .setMinValue(1)
            .setRequired(false)
        )
        .addStringOption(option => 
            option.setName('powod')
            .setDescription('Dlaczego zdejmujesz karę? (np. Pomyłka, Odwołanie)')
            .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers), // Tylko dla Straży Karczmy

    async execute(interaction) {
        const targetUser = interaction.options.getUser('uzytkownik');
        const amountToRemove = interaction.options.getInteger('ilosc') || 1;
        const reason = interaction.options.getString('powod') || 'Decyzja Najwyższej Straży';
        
        const userId = targetUser.id;
        const guildId = interaction.guild.id;
        const logChannelId = '1503164203488252014';

        // --- Zabezpieczenia ---
        if (targetUser.bot) return interaction.reply({ content: '🤖 Boty są bezgrzeszne, nie ma im czego wybaczać!', ephemeral: true });
        if (userId === interaction.user.id) return interaction.reply({ content: '📜 Chcesz ułaskawić samego siebie? Kodeks na to nie pozwala!', ephemeral: true });

        // --- 1. Pobieranie danych z bazy ---
        const data = db.prepare('SELECT warnCount FROM warnings WHERE userId = ? AND guildId = ?').get(userId, guildId);

        if (!data || data.warnCount === 0) {
            return interaction.reply({ 
                content: `🛡️ Obywatel <@${userId}> ma nieskazitelną kartotekę! Nie ciąży na nim żaden wyrok.`, 
                ephemeral: true 
            });
        }

        // --- 2. Obliczenia nowej liczby kar ---
        const currentWarns = data.warnCount;
        const newWarnCount = Math.max(0, currentWarns - amountToRemove);
        const removedActually = currentWarns - newWarnCount;

        // --- 3. Aktualizacja bazy danych ---
        db.prepare('UPDATE warnings SET warnCount = ? WHERE userId = ? AND guildId = ?').run(newWarnCount, userId, guildId);

        // --- 4. WYSŁANIE LISTU (DM) DO GRACZA ---
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#2ECC71') // Szmaragdowa zieleń
                .setAuthor({ name: 'Straż Zakonu Fiflaka', iconURL: interaction.guild.iconURL({ dynamic: true }) })
                .setTitle('🕊️ Królewski Akt Łaski')
                .setDescription(`Witaj! Przynosimy dobre wieści. Straż Zakonu przejrzała Twoją kartotekę i postanowiła zdjąć z Ciebie ciężar win.`)
                .addFields(
                    { name: '✨ Zdjęto ostrzeżeń', value: `**${removedActually}**`, inline: true },
                    { name: '📜 Obecny stan', value: `Masz na koncie **${newWarnCount}** ostrzeżeń.`, inline: true },
                    { name: '💬 Powód ułaskawienia', value: `\`${reason}\``, inline: false }
                )
                .setFooter({ text: 'Wykorzystaj tę szansę mądrze i nie łam więcej regulaminu!' })
                .setTimestamp();
            
            await targetUser.send({ embeds: [dmEmbed] });
        } catch (err) {
            // Użytkownik ma zablokowane DM, kontynuujemy bez błędu
        }

        // --- 5. Embed dla kanału (Publiczne Ogłoszenie) ---
        const publicEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('✨ Rozgrzeszenie w Karczmie')
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
            .setDescription(`Wielkoduszność zstąpiła na Zakon! Strażnik <@${interaction.user.id}> okazał łaskę.`)
            .addFields(
                { name: '👤 Ułaskawiony', value: `<@${userId}>`, inline: true },
                { name: '⚖️ Zabrano win', value: `**${removedActually}**`, inline: true },
                { name: '📉 Pozostałe ostrzeżenia', value: `**${newWarnCount}**`, inline: true },
                { name: '📜 Powód aktu łaski', value: `\`${reason}\``, inline: false }
            )
            .setFooter({ text: 'Zakon Fiflaka • Sprawiedliwość i Litość' })
            .setTimestamp();

        await interaction.reply({ embeds: [publicEmbed] });

        // --- 6. Wysyłanie loga do Strażnicy ---
        const logChannel = interaction.guild.channels.cache.get(logChannelId);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor('#27AE60') // Ciemniejsza zieleń dla logów
                .setTitle('⚖️ Usunięcie Ostrzeżenia (Ułaskawienie)')
                .addFields(
                    { name: 'Użytkownik', value: `${targetUser.tag} (\`${userId}\`)`, inline: true },
                    { name: 'Strażnik', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Usunięto', value: `**${removedActually}** warn(y)`, inline: true },
                    { name: 'Nowy stan kartoteki', value: `**${newWarnCount}**`, inline: false },
                    { name: 'Podany powód', value: reason, inline: false }
                )
                .setTimestamp();
            logChannel.send({ embeds: [logEmbed] });
        }
    }
};