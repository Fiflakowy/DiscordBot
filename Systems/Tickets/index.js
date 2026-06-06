const { 
    ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, 
    StringSelectMenuBuilder, StringSelectMenuOptionBuilder, 
    ButtonBuilder, ButtonStyle, AttachmentBuilder 
} = require('discord.js');

module.exports = (client) => {
    // ==========================================
    // ⚙️ KONFIGURACJA TWOJEGO KRÓLESTWA
    // ==========================================
    const PANEL_CHANNEL_ID = '1503680697997459538';   
    const TICKET_CATEGORY_ID = '1503687005375299686'; 
    const LOG_CHANNEL_ID = '1503164203488252014';     
    
    const SUPPORT_ROLE_IDS = [
        '1475572271446884535', 
        '1502957868687556678', 
        '1502957868146491402'
    ];

    const ID_KOMENDY_SKLEP = '1503051899182645289';
    const ID_KOMENDY_TABLICA = '1503430942839013430';

    // ==========================================
    // 1. PANCERNY AUTO-SETUP POTĘŻNEGO PANELU
    // ==========================================
    const setupTicketPanel = async () => {
        try {
            const panelChannel = await client.channels.fetch(PANEL_CHANNEL_ID).catch(() => null);
            if (!panelChannel) return console.log('⚠️ [TICKETS] Nie widzę kanału panelu!');

            const messages = await panelChannel.messages.fetch({ limit: 10 });
            const botPanel = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);

            if (!botPanel) {
                const mainEmbed = new EmbedBuilder()
                    .setColor('#D4AF37')
                    .setTitle('🛡️ CENTRUM POMOCY I ZGŁOSZEŃ ZAKONU FIFLAKA')
                    .setAuthor({ name: 'Zarząd Zakonu', iconURL: client.user.displayAvatarURL() })
                    .setDescription(
                        `Witaj wędrowcze w Strażnicy! 🏰\n\n` +
                        `Jeśli Twoje kufle są puste przez błąd w magii, spotkałeś niesprawiedliwość lub chcesz zapytać o dekrety królewskie – dobrze trafiłeś.\n\n` +
                        `**JAK OTWORZYĆ ZGŁOSZENIE?**\n` +
                        `1️⃣ Wybierz odpowiednią kategorię z menu poniżej.\n` +
                        `2️⃣ Poczekaj ułamek sekundy na otwarcie prywatnej komnaty.\n` +
                        `3️⃣ Opisz sprawę, a Strażnicy Zakonu ruszą Ci z pomocą!`
                    )
                    .addFields(
                        { name: '📜 Błędy Magii', value: 'Wszelkie problemy techniczne i błędy bota.', inline: true },
                        { name: '🗡️ Skargi', value: 'Naruszenia regulaminu przez innych biesiadników.', inline: true },
                        { name: '❓ Pytania', value: 'Masz wątpliwości? Starszyzna odpowie na wszystko.', inline: true }
                    )
                    // TWOJE ZDJĘCIE - Sprawia, że panel jest ogromny i klimatyczny
                    .setImage('https://imgur.com/kLEOrnX.png') 
                    .setFooter({ text: 'Zakon Fiflaka • Oficjalny System Wsparcia', iconURL: client.user.displayAvatarURL() })
                    .setTimestamp();

                const menu = new StringSelectMenuBuilder()
                    .setCustomId('ticket_create')
                    .setPlaceholder('👉 Kliknij tutaj, aby wybrać temat zgłoszenia...')
                    .addOptions(
                        new StringSelectMenuOptionBuilder()
                            .setLabel('POMOC TECHNICZNA')
                            .setDescription('Zgłoś błąd, bugi lub problemy z botem.')
                            .setValue('pomoc')
                            .setEmoji('🛠️'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('SKARGA NA GRACZA')
                            .setDescription('Zgłoś złamanie kodeksu przez innego wędrowca.')
                            .setValue('raport')
                            .setEmoji('🗡️'),
                        new StringSelectMenuOptionBuilder()
                            .setLabel('PYTANIE / INNE')
                            .setDescription('Wszystko, co nie pasuje do powyższych kategorii.')
                            .setValue('pytanie')
                            .setEmoji('❓')
                    );

                await panelChannel.send({ embeds: [mainEmbed], components: [new ActionRowBuilder().addComponents(menu)] });
                console.log('✅ [TICKETS] Potężny panel został wystawiony!');
            }
        } catch (err) {
            console.error('❌ [TICKETS ERROR]:', err);
        }
    };

    if (client.isReady()) setupTicketPanel();
    else client.once('ready', setupTicketPanel);

    // ==========================================
    // 2. LOGIKA SYSTEMU INTERAKCJI
    // ==========================================
    client.on('interactionCreate', async (interaction) => {

        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_create') {
            await interaction.deferReply({ ephemeral: true });

            const reason = interaction.values[0];
            const userId = interaction.user.id;

            const existingChannel = interaction.guild.channels.cache.find(c => c.topic === userId && c.parentId === TICKET_CATEGORY_ID);
            if (existingChannel) return interaction.editReply({ content: `❌ Masz już otwarty ticket: <#${existingChannel.id}>!` });

            try {
                const permissionOverwrites = [
                    { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                ];
                SUPPORT_ROLE_IDS.forEach(id => permissionOverwrites.push({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }));

                const ticketChannel = await interaction.guild.channels.create({
                    name: `🆘-${reason}-${interaction.user.username}`,
                    type: ChannelType.GuildText,
                    parent: TICKET_CATEGORY_ID,
                    topic: userId,
                    permissionOverwrites: permissionOverwrites
                });

                const welcomeEmbed = new EmbedBuilder()
                    .setColor('#D4AF37')
                    .setTitle(`🛡️ WEZWANIE PRZYJĘTE: ${reason.toUpperCase()}`)
                    .setDescription(
                        `Witaj <@${userId}>!\n\n` +
                        `Twoje zgłoszenie trafiło do ksiąg Straży. Zaraz ktoś się Tobą zajmie.\n\n` +
                        `**W MIĘDZYCZASIE:**\n` +
                        `💰 Odwiedź </sklep:${ID_KOMENDY_SKLEP}>\n` +
                        `📜 Zobacz </tablica:${ID_KOMENDY_TABLICA}>\n\n` +
                        `*Gdy skończysz rozmowę, użyj panelu sterowania poniżej.*`
                    )
                    .setImage('https://imgur.com/kLEOrnX.png') // Ponowne użycie zdjęcia dla klimatu
                    .setFooter({ text: 'Panel Administracyjny Zakonu' });

                const controlRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_close').setLabel('🔒 Zamknij').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('ticket_claim').setLabel('🤚 Przejmij').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('ticket_save').setLabel('📝 Zapisz Logi').setStyle(ButtonStyle.Secondary)
                );

                await ticketChannel.send({ 
                    content: `🔔 <@${userId}> | <@&${SUPPORT_ROLE_IDS[0]}>`, 
                    embeds: [welcomeEmbed], 
                    components: [controlRow] 
                });

                await interaction.editReply({ content: `✅ Komnata otwarta: <#${ticketChannel.id}>` });

            } catch (err) {
                console.error(err);
                return interaction.editReply({ content: '🔥 Magia zawiodła!' });
            }
        }

        // OBSŁUGA PRZYCISKÓW (ZAMKNIJ / PRZEJMIJ / ZAPISZ)
        if (interaction.isButton()) {
            const channel = interaction.channel;
            if (channel.parentId !== TICKET_CATEGORY_ID) return;

            const isSupport = interaction.member.roles.cache.some(r => SUPPORT_ROLE_IDS.includes(r.id)) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

            if (interaction.customId === 'ticket_close') {
                await interaction.reply({ content: '🔒 **Likwidacja komnaty...** Zapisywanie zwojów i sprzątanie stołów (5 sekund).' });
                const transcript = await generateTranscript(channel);
                const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
                
                if (logChannel && transcript) {
                    const logEmbed = new EmbedBuilder()
                        .setColor('#E74C3C')
                        .setTitle('🔒 Ticket Zamknięty')
                        .addFields(
                            { name: 'Otworzył', value: `<@${channel.topic}>`, inline: true },
                            { name: 'Zamknął', value: `<@${interaction.user.id}>`, inline: true }
                        );
                    await logChannel.send({ embeds: [logEmbed], files: [transcript] });
                }
                setTimeout(() => channel.delete().catch(() => {}), 5000);
            }

            if (interaction.customId === 'ticket_claim' && isSupport) {
                const row = ActionRowBuilder.from(interaction.message.components[0]);
                row.components[1].setDisabled(true); 
                await interaction.message.edit({ components: [row] });
                await interaction.reply({ content: `✋ Strażnik <@${interaction.user.id}> przejął to zgłoszenie!` });
            }

            if (interaction.customId === 'ticket_save' && isSupport) {
                await interaction.deferReply({ ephemeral: true });
                const transcript = await generateTranscript(channel);
                if (transcript) await interaction.editReply({ content: '📝 Zapis rozmowy:', files: [transcript] });
            }
        }
    });

    async function generateTranscript(channel) {
        try {
            const messages = await channel.messages.fetch({ limit: 100 });
            let content = `--- LOGI ZAKONU: ${channel.name} ---\n\n`;
            messages.reverse().forEach(m => {
                if (m.author.bot && m.embeds.length > 0) return;
                content += `[${new Date(m.createdTimestamp).toLocaleString('pl-PL')}] ${m.author.tag}: ${m.content || '[Media]'}\n`;
            });
            return new AttachmentBuilder(Buffer.from(content, 'utf-8'), { name: `ticket-${channel.name}.txt` });
        } catch (e) { return null; }
    }
};