const { 
    ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, UserSelectMenuBuilder, ModalBuilder, 
    TextInputBuilder, TextInputStyle 
} = require('discord.js');

module.exports = (client) => {
    // ==========================================
    // ⚙️ KONFIGURACJA ZAKONU FIFLAKA
    // ==========================================
    const CREATE_CHANNEL_ID = '1503338484016873523'; // Kanał "Wejdź aby stworzyć"
    const CATEGORY_ID = '1503338444028510369'; // Kategoria dla Prywatnych Lóż

    const pendingCreations = new Set();

    // ==========================================
    // 1. TWORZENIE I USUWANIE KOMNAT
    // ==========================================
    client.on('voiceStateUpdate', async (oldState, newState) => {
        const member = newState.member;
        if (!member || member.user.bot) return;

        // --- TWORZENIE KOMNATY (Z 5-SEKUNDOWYM OPÓŹNIENIEM) ---
        if (newState.channelId === CREATE_CHANNEL_ID && oldState.channelId !== CREATE_CHANNEL_ID) {
            if (pendingCreations.has(member.id)) return;
            pendingCreations.add(member.id);

            // Odliczamy 5 sekund (Karczmarz przeciera stół)
            setTimeout(async () => {
                pendingCreations.delete(member.id);

                try {
                    const currentVoice = member.voice;
                    if (!currentVoice || currentVoice.channelId !== CREATE_CHANNEL_ID) return;

                    // Karczmarz otwiera nową lożę
                    const newChannel = await newState.guild.channels.create({
                        name: `🍻 Loża: ${member.user.username}`,
                        type: ChannelType.GuildVoice,
                        parent: CATEGORY_ID,
                        permissionOverwrites: [
                            {
                                id: newState.guild.roles.everyone.id,
                                allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel]
                            },
                            {
                                id: member.id,
                                allow: [
                                    PermissionFlagsBits.Connect, 
                                    PermissionFlagsBits.ViewChannel, 
                                    PermissionFlagsBits.ManageChannels
                                ]
                            }
                        ]
                    });

                    // Przenosimy Mistrza do jego nowej loży
                    await member.voice.setChannel(newChannel);

                    // --- PANEL ZAKONU FIFLAKA ---
                    const embed = new EmbedBuilder()
                        .setColor('#e4c464') // Złoto Zakonu Fiflaka
                        .setTitle('🍻 Prywatna Loża w Karczmie')
                        .setDescription(`Witaj przy stole, Mistrzu <@${member.id}>!\nKarczmarz oddaje tę lożę do Twojej dyspozycji. Użyj poniższego panelu, aby zarządzać swoimi biesiadnikami i odeprzeć nieproszonych gości.\n\n⚠️ **Złota Zasada:** Szyld (nazwę) możesz zmienić tylko **2 razy na 10 minut** (ograniczenia magii Discorda).`)
                        .setThumbnail(newState.guild.iconURL({ dynamic: true, size: 256 }))
                        .addFields({ name: 'Zarządzanie', value: 'Kliknij na zwoje poniżej, aby nałożyć swoją wolę.' })
                        .setFooter({ text: 'Zakon Fiflaka • Karczemna Władza', iconURL: member.user.displayAvatarURL() });

                    // Rząd 1: Przyciski Dostępu i Widoczności
                    const buttonsRow1 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('voice_lock').setLabel('🔒 Zarygluj Drzwi').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId('voice_unlock').setLabel('🔓 Otwórz Drzwi').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('voice_hide').setLabel('👻 Zasłoń Kotarę').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('voice_unhide').setLabel('👁️ Odsłoń Kotarę').setStyle(ButtonStyle.Primary)
                    );

                    // Rząd 2: Zarządzanie Kanałem i Przejęcie
                    const buttonsRow2 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('voice_rename').setLabel('📝 Zmień Szyld').setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('voice_limit').setLabel('🪑 Ilość Krzeseł').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('voice_claim').setLabel('👑 Przejmij Stół').setStyle(ButtonStyle.Success)
                    );

                    // Rząd 3, 4, 5: Pickery Użytkowników
                    const addMenu = new ActionRowBuilder().addComponents(
                        new UserSelectMenuBuilder().setCustomId('voice_add_user').setPlaceholder('✅ Wpuść biesiadnika / Odejmij bana').setMaxValues(1)
                    );
                    const kickMenu = new ActionRowBuilder().addComponents(
                        new UserSelectMenuBuilder().setCustomId('voice_kick_user').setPlaceholder('👢 Wyproś z loży (Kick)').setMaxValues(1)
                    );
                    const banMenu = new ActionRowBuilder().addComponents(
                        new UserSelectMenuBuilder().setCustomId('voice_ban_user').setPlaceholder('🔨 Zakaż wstępu (Ban)').setMaxValues(1)
                    );

                    // Wysyłamy wiadomość startową z panelem
                    await newChannel.send({ 
                        content: `Pijmy, Śmiejmy się, Fiflajmy! Zdrówko, <@${member.id}>! 🍻`, 
                        embeds: [embed], 
                        components: [buttonsRow1, buttonsRow2, addMenu, kickMenu, banMenu] 
                    });

                } catch (err) {
                    console.error('❌ [VOICE MANAGER] Błąd przy tworzeniu loży:', err);
                }
            }, 5000); 
        }

        // --- USUWANIE PUSTEJ LÓŻY ---
        if (oldState.channelId && oldState.channelId !== CREATE_CHANNEL_ID && oldState.channel?.parentId === CATEGORY_ID) {
            if (oldState.channel.members.size === 0) {
                try {
                    await oldState.channel.delete('Pusta loża Karczmy');
                } catch (err) {}
            }
        }
    });

    // ==========================================
    // 2. OBSŁUGA INTERAKCJI (PANEL MISTRZA)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton() && !interaction.isUserSelectMenu() && !interaction.isModalSubmit()) return;

        const channel = interaction.channel;
        if (channel?.parentId !== CATEGORY_ID) return;

        const customId = interaction.customId;
        const isOwner = channel.permissionsFor(interaction.member).has(PermissionFlagsBits.ManageChannels);

        // Zabezpieczenie: Tylko gospodarz decyduje, chyba że to bunt (Przejęcie Stółu)
        if (!isOwner && customId !== 'voice_claim') {
            return interaction.reply({ content: '⚔️ Nie jesteś Gospodarzem tej loży! Łapska precz od cudzego stołu.', ephemeral: true });
        }

        try {
            // --- OBSŁUGA PRZYCISKÓW ---
            if (interaction.isButton()) {
                
                // 1. BLOKADA
                if (customId === 'voice_lock') {
                    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { Connect: false });
                    return interaction.reply({ content: '🔒 Drzwi do loży zostały **zaryglowane** (nikt obcy nie wejdzie).', ephemeral: true });
                }
                if (customId === 'voice_unlock') {
                    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { Connect: null });
                    return interaction.reply({ content: '🔓 Drzwi do loży są ponownie **otwarte**.', ephemeral: true });
                }

                // 2. UKRYWANIE
                if (customId === 'voice_hide') {
                    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { ViewChannel: false });
                    return interaction.reply({ content: '👻 Zasłonięto kotarę (loża została **ukryta** przed innymi).', ephemeral: true });
                }
                if (customId === 'voice_unhide') {
                    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, { ViewChannel: null });
                    return interaction.reply({ content: '👁️ Odsłonięto kotarę (loża znów jest **widoczna**).', ephemeral: true });
                }

                // 3. PRZEJĘCIE WŁADZY (CLAIM)
                if (customId === 'voice_claim') {
                    const hasOwnerInChannel = channel.members.some(m => channel.permissionsFor(m).has(PermissionFlagsBits.ManageChannels));
                    
                    if (hasOwnerInChannel) {
                        return interaction.reply({ content: '❌ Gospodarz wciąż siedzi przy stole! Próba buntu udaremniona.', ephemeral: true });
                    }

                    await channel.permissionOverwrites.edit(interaction.user.id, {
                        Connect: true,
                        ViewChannel: true,
                        ManageChannels: true
                    });
                    return interaction.reply({ content: '👑 Karczmarz ogłasza zmianę! **Zostałeś nowym Gospodarzem tej loży.**', ephemeral: true });
                }

                // 4. NAZWA I LIMIT (MODALE)
                if (customId === 'voice_rename') {
                    const modal = new ModalBuilder().setCustomId('modal_rename').setTitle('📝 Zmiana Szyldu');
                    const input = new TextInputBuilder().setCustomId('rename_input').setLabel('Nowa nazwa loży:').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30);
                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    return await interaction.showModal(modal);
                }
                if (customId === 'voice_limit') {
                    const modal = new ModalBuilder().setCustomId('modal_limit').setTitle('🪑 Ilość Krzeseł');
                    const input = new TextInputBuilder().setCustomId('limit_input').setLabel('Liczba miejsc (0-99, 0 = brak limitu):').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2);
                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    return await interaction.showModal(modal);
                }
            }

            // --- OBSŁUGA PICKERÓW ---
            if (interaction.isUserSelectMenu()) {
                const targetId = interaction.values[0];

                if (targetId === interaction.user.id) {
                    return interaction.reply({ content: '⚔️ Wypij wodę. Klikasz sam na siebie!', ephemeral: true });
                }

                if (customId === 'voice_add_user') {
                    await channel.permissionOverwrites.edit(targetId, { Connect: true, ViewChannel: true });
                    return interaction.reply({ content: `✅ Wpuszczono brata <@${targetId}> do loży. Drzwi stoją otworem.`, ephemeral: true });
                }
                if (customId === 'voice_kick_user') {
                    const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
                    if (targetMember && targetMember.voice.channelId === channel.id) {
                        await targetMember.voice.disconnect('Wyrzucony z Karczemnej Loży');
                        return interaction.reply({ content: `👢 Intruz <@${targetId}> wyleciał za drzwi.`, ephemeral: true });
                    }
                    return interaction.reply({ content: `⚠️ <@${targetId}> nie przebywa przy Twoim stole.`, ephemeral: true });
                }
                if (customId === 'voice_ban_user') {
                    await channel.permissionOverwrites.edit(targetId, { Connect: false });
                    const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
                    if (targetMember && targetMember.voice.channelId === channel.id) {
                        await targetMember.voice.disconnect('Zbanowany w loży');
                    }
                    return interaction.reply({ content: `🔨 Zbanowano <@${targetId}>. Karczmarz już nigdy go tu nie wpuści.`, ephemeral: true });
                }
            }

            // --- OBSŁUGA MODALI ---
            if (interaction.isModalSubmit()) {
                if (customId === 'modal_rename') {
                    const newName = interaction.fields.getTextInputValue('rename_input');
                    await channel.setName(newName);
                    return interaction.reply({ content: `📝 Karczmarz zawiesił nowy szyld: **${newName}**\n*(Pamiętaj o limicie: max 2 zmiany na 10 minut!)*`, ephemeral: true });
                }
                if (customId === 'modal_limit') {
                    const newLimit = parseInt(interaction.fields.getTextInputValue('limit_input'));
                    if (isNaN(newLimit) || newLimit < 0 || newLimit > 99) {
                        return interaction.reply({ content: '❌ Gospodarzu, podaj poprawną liczbę krzeseł od 0 do 99!', ephemeral: true });
                    }
                    await channel.setUserLimit(newLimit);
                    return interaction.reply({ content: `🪑 Przy stole jest teraz miejsc: **${newLimit === 0 ? 'Brak ograniczeń' : newLimit}**`, ephemeral: true });
                }
            }

        } catch (err) {
            console.error('❌ [VOICE INTERACTION ERROR]:', err);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Karczmarz rozlał piwo... Serwery Discorda blokują tę akcję (pewnie za szybko zmieniasz nazwę).', ephemeral: true }).catch(()=>{});
            }
        }
    });

    console.log('🏰 [SYSTEM] Prywatne Loże Karczmy w pełni operacyjne!');
};