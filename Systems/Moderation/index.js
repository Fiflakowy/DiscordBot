const { EmbedBuilder } = require('discord.js');
const db = require('../../db.js');

module.exports = (client) => {
    // ==========================================
    // KONFIGURACJA
    // ==========================================
    const adminRoles = ['1475570484585168957', '1475572271446884535'];
    const bypassLinkRole = '1476000398107217980';
    const autoRoleId = '1475572275095929022';
    const logChannelId = '1503164203488252014';

    // Ustawienia ochrony
    const SPAM_LIMIT = 5;
    const SPAM_TIME = 5000;
    const MASS_MENTION_MAX = 4;
    const CAPS_LOCK_MIN_LEN = 15;
    const CAPS_LOCK_RATIO = 0.7;

    const userSpamMap = new Map();

    // Regexy
    const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[^\s/]+/gi;
    const generalLinkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
    const allowedLinkDomains = ['tenor.com', 'giphy.com', 'tenor.co'];

    // Słowa zakazane
    const forbiddenPatterns = ["nigg", "nger", "kurw", "kurew", "jeb", "pierd", "pizd", "chuj", "huj", "kutas", "cwel"];
    const badWords = [
        "nigger","niggers","cwel","chuj","huj","kutas","kurwa","kurwy","jebać","pierdol","pizda",
        "dziwka","sukinsyn","skurwysyn","pojeb","debil","cipa","cipka","dupcia","fuck"
    ];

    // ==========================================
    // AUTOROLE + WELCOME DM
    // ==========================================
    client.on('guildMemberAdd', async (member) => {
        try {
            const role = member.guild.roles.cache.get(autoRoleId);
            if (role) await member.roles.add(role);

            const welcomeEmbed = new EmbedBuilder()
                .setColor('#D4AF37')
                .setAuthor({ name: 'Zakon Fiflaka', iconURL: member.guild.iconURL({ dynamic: true }) })
                .setTitle('🍻 Witaj w naszych progach, Wędrowcze!')
                .setDescription('Brama Zakonu została przed Tobą otwarta...')
                .addFields(
                    { name: '📜 Pierwszy Krok', value: 'Zapoznaj się z regulaminem na dedykowanym kanale.', inline: false },
                    { name: '💰 Nagrody', value: 'Odbieraj codziennie `/daily` oraz sprawdzaj `/tablica`!', inline: false }
                )
                .setFooter({ text: 'Niech Twoja legenda się zacznie.' })
                .setTimestamp();

            await member.send({ embeds: [welcomeEmbed] }).catch(() => {});
        } catch (err) {
            console.error('❌ [AUTOROLE] Błąd:', err);
        }
    });

    // ==========================================
    // LOGOWANIE ZMIAN RÓL
    // ==========================================
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        if (oldMember.roles.cache.size === newMember.roles.cache.size) return;

        const logChannel = newMember.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
        const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

        if (added.size > 0) {
            logChannel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('🎖️ Nadano nowe role')
                    .addFields(
                        { name: '👤 Użytkownik', value: `${newMember.user.tag} (<@${newMember.id}>)` },
                        { name: '➕ Nadane role', value: added.map(r => `<@&${r.id}>`).join('\n') || 'Brak' }
                    )
                    .setTimestamp()
                ]
            });
        }

        if (removed.size > 0) {
            logChannel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle('📉 Zabano role')
                    .addFields(
                        { name: '👤 Użytkownik', value: `${newMember.user.tag} (<@${newMember.id}>)` },
                        { name: '➖ Zabane role', value: removed.map(r => `<@&${r.id}>`).join('\n') || 'Brak' }
                    )
                    .setTimestamp()
                ]
            });
        }
    });

    // ==========================================
    // GŁÓWNA MODERACJA
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (!message.guild || message.author.bot) return;
        const member = message.member;
        if (!member) return;

        const isAdmin = member.roles.cache.some(r => adminRoles.includes(r.id));
        if (isAdmin) return;

        const userId = message.author.id;
        const content = message.content;

        // === ANTI-SPAM ===
        if (!userSpamMap.has(userId)) userSpamMap.set(userId, []);
        const timestamps = userSpamMap.get(userId);
        const now = Date.now();
        timestamps.push(now);
        const recent = timestamps.filter(t => now - t < SPAM_TIME);
        userSpamMap.set(userId, recent);

        if (recent.length > SPAM_LIMIT) {
            userSpamMap.set(userId, []);
            return handleAutoWarn(message, "Spam (zbyt szybkie pisanie)", content);
        }

        // === INVITE ===
        if (inviteRegex.test(content)) {
            return handleAutoWarn(message, "Wysyłanie zaproszeń na inne serwery Discord", content);
        }

        // === LINKI ===
        const canSendLinks = member.roles.cache.has(bypassLinkRole);
        if (!canSendLinks) {
            const links = content.match(generalLinkRegex);
            if (links) {
                const badLink = links.some(url => {
                    const lower = url.toLowerCase();
                    return !allowedLinkDomains.some(d => lower.includes(d));
                });
                if (badLink) return handleAutoWarn(message, "Wysyłanie niedozwolonych linków", content);
            }
        }

        // === MASS MENTION ===
        if (message.mentions.users.size > MASS_MENTION_MAX) {
            return handleAutoWarn(message, `Mass Mention (więcej niż ${MASS_MENTION_MAX} oznaczeń)`, content);
        }

        // === CAPS LOCK ===
        if (content.length > CAPS_LOCK_MIN_LEN) {
            const letters = content.replace(/[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '');
            if (letters.length > 0) {
                const upper = letters.replace(/[^A-ZĄĆĘŁŃÓŚŹŻ]/g, '');
                if (upper.length / letters.length > CAPS_LOCK_RATIO) {
                    return handleAutoWarn(message, "Nadmierne używanie Caps Locka", content);
                }
            }
        }

        // === WULGARYZMY ===
        let clean = content.toLowerCase()
            .replace(/(.)\1+/g, '$1')
            .replace(/[0-9]/g, m => ({'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t'})[m] || m)
            .replace(/[^a-ząęćłńóśźż]/g, '');

        const detectedWord = badWords.find(w => clean.includes(w)) || 
                           forbiddenPatterns.find(p => clean.includes(p));

        if (detectedWord) {
            return handleAutoWarn(message, `Używanie wulgaryzmów (wykryto: ${detectedWord})`, content);
        }
    });

    // ==========================================
    // FUNKCJA AUTO-WARN (ZWIĘKSZONA SZCZEGÓŁOWOŚĆ)
    // ==========================================
    async function handleAutoWarn(message, reason, originalContent = "") {
        try {
            await message.delete().catch(() => {});

            const userId = message.author.id;
            const guildId = message.guild.id;

            db.prepare('INSERT OR IGNORE INTO warnings (userId, guildId, warnCount) VALUES (?, ?, 0)').run(userId, guildId);
            db.prepare('UPDATE warnings SET warnCount = warnCount + 1 WHERE userId = ? AND guildId = ?').run(userId, guildId);

            const { warnCount } = db.prepare('SELECT warnCount FROM warnings WHERE userId = ? AND guildId = ?').get(userId, guildId);

            let actionText = "Ostrzeżenie zostało dodane do Twoich akt.";
            if (warnCount === 3) {
                await message.member.timeout(10 * 60 * 1000, `3 ostrzeżenia - ${reason}`);
                actionText = "🔇 **Timeout 10 minut** za 3 ostrzeżenia.";
            } else if (warnCount >= 5) {
                await message.member.timeout(24 * 60 * 60 * 1000, `5 ostrzeżeń - ${reason}`);
                actionText = "⛓️ **Timeout 24 godziny** + reset licznika ostrzeżeń.";
                db.prepare('UPDATE warnings SET warnCount = 0 WHERE userId = ? AND guildId = ?').run(userId, guildId);
            }

            // Wiadomość na kanale
            await message.channel.send({
                content: `⚠️ <@${userId}>, **${reason}**!\nTo Twoje **${warnCount}** ostrzeżenie.`
            }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 10000));

            // DM - bardzo szczegółowy
            const dmEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`⚔️ Ostrzeżenie od Straży Zakonu`)
                .setDescription(`Złamano zasady na serwerze **${message.guild.name}**`)
                .addFields(
                    { name: '📛 Powód', value: reason, inline: false },
                    { name: '🔢 Liczba ostrzeżeń', value: `**${warnCount}** / 5`, inline: true },
                    { name: '🔨 Konsekwencja', value: actionText, inline: true },
                    { name: '📝 Treść Twojej wiadomości', value: `\`\`\`${originalContent.slice(0, 800)}\`\`\`` || "Brak tekstu" }
                )
                .setFooter({ text: 'Kolejne ostrzeżenie może skutkować dłuższą karą.' })
                .setTimestamp();

            message.author.send({ embeds: [dmEmbed] }).catch(() => {});

            // Log do kanału moderacyjnego
            const logChannel = message.guild.channels.cache.get(logChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#FF4500')
                    .setTitle('👁️ Auto-Mod | Ostrzeżenie')
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .addFields(
                        { name: '👤 Użytkownik', value: `${message.author.tag} (<@${userId}>)`, inline: true },
                        { name: '🔢 Ostrzeżeń', value: `**${warnCount}**`, inline: true },
                        { name: '📛 Powód', value: reason },
                        { name: '📝 Treść wiadomości', value: `\`\`\`${originalContent.slice(0, 700)}\`\`\`` || "[Brak treści]" }
                    )
                    .setTimestamp();

                logChannel.send({ embeds: [logEmbed] });
            }
        } catch (err) {
            console.error('❌ [AUTO-WARN ERROR]:', err);
        }
    }

    console.log('🛡️ Zaawansowany System Moderacji Załadowany!');
};
