const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Wymierz sprawiedliwość i nadaj oficjalne ostrzeżenie bywalcowi Karczmy')
        .addUserOption(option => 
            option.setName('uzytkownik')
            .setDescription('Wybierz osobę, która łamie prawo Zakonu')
            .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('powod')
            .setDescription('Za co wymierzasz karę?')
            .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers), // Tylko dla Straży Karczmy

    async execute(interaction) {
        const target = interaction.options.getMember('uzytkownik');
        const reason = interaction.options.getString('powod') || 'Złamanie regulaminu Karczmy';
        const logChannelId = '1503164203488252014'; // Twój kanał logów

        // --- Zabezpieczenia ---
        if (!target) return interaction.reply({ content: '📭 Nie znaleziono takiego wędrowca w naszych progach.', ephemeral: true });
        if (target.user.bot) return interaction.reply({ content: '🤖 Karczmarz ręczy za swoje boty. Nie możesz ich uchodzić za winnych!', ephemeral: true });
        if (target.id === interaction.user.id) return interaction.reply({ content: '🍺 Próbujesz wsadzić samego siebie do lochu? Odstaw już ten miód pitny!', ephemeral: true });
        
        // Zabezpieczenie przed karaniem wyższych rangą
        if (target.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: '⚔️ Nie możesz wymierzyć kary komuś, kto ma równą lub wyższą rangę w Zakonie!', ephemeral: true });
        }

        const userId = target.id;
        const guildId = interaction.guild.id;

        // --- 1. Zapis do bazy danych ---
        db.prepare('INSERT OR IGNORE INTO warnings (userId, guildId, warnCount) VALUES (?, ?, 0)').run(userId, guildId);
        db.prepare('UPDATE warnings SET warnCount = warnCount + 1 WHERE userId = ? AND guildId = ?').run(userId, guildId);

        const data = db.prepare('SELECT warnCount FROM warnings WHERE userId = ? AND guildId = ?').get(userId, guildId);
        const warnCount = data.warnCount;

        let actionText = "Wpisano do kartoteki Straży. Obywatel wciąż cieszy się wolnością.";

        // --- 2. Logika kar automatycznych (Timeout) ---
        try {
            if (warnCount === 3) {
                await target.timeout(10 * 60 * 1000, `3 ostrzeżenia: ${reason}`);
                actionText = "Osiągnięto **3 ostrzeżenia**! Założono knebel na **10 minut**.";
            } else if (warnCount >= 5) {
                await target.timeout(24 * 60 * 60 * 1000, `5 ostrzeżeń: ${reason}`);
                actionText = "Osiągnięto **5 ostrzeżeń**! Zesłano do lochu na **24 godziny**. Licznik wyczyszczony.";
                db.prepare('UPDATE warnings SET warnCount = 0 WHERE userId = ? AND guildId = ?').run(userId, guildId);
            }
        } catch (err) {
            actionText = "⚠️ *Zanotowano winę, lecz magia zawiodła (bot ma zbyt niską rolę, by nałożyć Timeout na tego gracza).*";
        }

        // --- 3. WYSŁANIE LISTU (DM) DO GRACZA ---
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setAuthor({ name: 'Straż Zakonu Fiflaka', iconURL: interaction.guild.iconURL({ dynamic: true }) })
                .setTitle('⚠️ Otrzymałeś Oficjalne Ostrzeżenie')
                .setDescription(`Witaj. Straż Karczmy przyłapała Cię na łamaniu kodeksu. Radzimy ważyć słowa i czyny, by nie wylądować w lochu.`)
                .addFields(
                    { name: '📜 Powód', value: `\`${reason}\``, inline: false },
                    { name: '🛑 Twoje ostrzeżenia', value: `To Twoje **${warnCount}** ostrzeżenie. (3 = Timeout 10m, 5 = Timeout 24h)`, inline: false }
                )
                .setFooter({ text: 'Od decyzji Straży nie ma odwołania.' })
                .setTimestamp();
            
            await target.send({ embeds: [dmEmbed] });
        } catch (err) {
            // Ignorujemy błąd, jeśli użytkownik ma wyłączone wiadomości prywatne
        }

        // --- 4. Embed dla kanału (Publiczny wyrok) ---
        const warnEmbed = new EmbedBuilder()
            .setColor('#E74C3C') // Czerwony kolor ostrzegawczy
            .setTitle('⚖️ Wyrok Straży Zakonu')
            .setThumbnail(target.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setDescription(`Niech to będzie przestroga dla innych! Obywatel <@${userId}> dopuścił się złamania prawa.`)
            .addFields(
                { name: '👤 Winny', value: `<@${userId}>`, inline: true },
                { name: '🛡️ Wydający Wyrok', value: `<@${interaction.user.id}>`, inline: true },
                { name: '📈 Stan Ostrzeżeń', value: `**${warnCount}**`, inline: true },
                { name: '📜 Złamanie Kodeksu', value: `\`${reason}\``, inline: false },
                { name: '🔨 Wymierzona Kara', value: actionText, inline: false }
            )
            .setFooter({ text: 'Zakon Fiflaka • Prawo i Porządek' })
            .setTimestamp();

        await interaction.reply({ embeds: [warnEmbed] });

        // --- 5. Wysyłanie loga na kanał administracyjny ---
        const logChannel = interaction.guild.channels.cache.get(logChannelId);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor('#8B0000') // Ciemna czerwień dla logów
                .setTitle('🛡️ Ręczna Interwencja Straży')
                .addFields(
                    { name: 'Ukarany', value: `${target.user.tag} (\`${userId}\`)`, inline: true },
                    { name: 'Strażnik', value: `${interaction.user.tag}`, inline: true },
                    { name: 'Nowy stan ostrzeżeń', value: `**${warnCount}**`, inline: true },
                    { name: 'Powód kary', value: reason, inline: false },
                    { name: 'Skutek', value: actionText, inline: false }
                )
                .setTimestamp();
            logChannel.send({ embeds: [logEmbed] });
        }
    }
};