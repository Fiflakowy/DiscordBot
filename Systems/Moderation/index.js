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

    // Słowa zakazane (zoptymalizowane)
    const forbiddenPatterns = ["nigg", "nger", "kurw", "kurew", "jeb", "pierd", "pizd", "chuj", "huj", "kutas", "cwel", "fuc", "fck", "puss", "cunt"];
    
    const badWords = [
        "nigger","niggers","cwel","chuj","huj","kutas","kurwa","kurwy","jebać","pierdol","pizda",
        "dziwka","sukinsyn","skurwysyn","pojeb","debil","cipa","cipka","dupcia","fucking","fuck"
        // ... resztę możesz zostawić, ale powyższe są najważniejsze
    ];

    // ==========================================
    // AUTOROLE + WELCOME DM
    // ==========================================
    client.on('guildMemberAdd', async (member) => {
        try {
            const role = member.guild.roles.cache.get(autoRoleId);
            if (role) {
                await member.roles.add(role);
                console.log(`✅ [AUTOROLE] Nadano rolę: ${member.user.tag}`);
            }

            const welcomeEmbed = new EmbedBuilder()
                .setColor('#D4AF37')
                .setAuthor({ name: 'Zakon Fiflaka', iconURL: member.guild.iconURL({ dynamic: true }) })
                .setTitle('🍻 Witaj w naszych progach, Wędrowcze!')
                .setDescription('Brama Zakonu została przed Tobą otwarta. Znajdź wolne miejsce przy kominku...')
                .addFields(
                    { name: '📜 Pierwszy Krok', value: 'Zapoznaj się z regulaminem.', inline: false },
                    { name: '💰 Nagrody', value: 'Odbieraj `/daily` i `/tablica`!', inline: false }
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
        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;

        if (oldRoles.size === newRoles.size) return;

        const logChannel = newMember.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const added = newRoles.filter(r => !oldRoles.has(r.id));
        const removed = oldRoles.filter(r => !newRoles.has(r.id));

        if (added.size > 0) {
            logChannel.send({
                embeds: [new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('🎖️ Nadano role')
                    .addFields(
                        { name: '👤 Użytkownik', value: `${newMember.user.tag} (<@${newMember.id}>)` },
                        { name: '➕ Role', value: added.map(r => `<@&${r.id}>`).join('\n') }
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
                        { name: '➖ Role', value: removed.map(r => `<@&${r.id}>`).join('\n') }
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

        // === ANTI-SPAM ===
        if (!userSpamMap.has(userId)) userSpamMap.set(userId, []);
        const timestamps = userSpamMap.get(userId);
        const now = Date.now();
        timestamps.push(now);
        const recent = timestamps.filter(t => now - t < SPAM_TIME);
        userSpamMap.set(userId, recent);

        if (recent.length > SPAM_LIMIT) {
            userSpamMap.set(userId, []);
            return handleAutoWarn(message, "spamować");
        }

        // === INVITE ===
        if (inviteRegex.test(message.content)) {
            return handleAutoWarn(message, "wysyłać zaproszeń na inne serwery");
        }

        // === LINKI ===
        const canSendLinks = member.roles.cache.has(bypassLinkRole);
        if (!canSendLinks) {
            const links = message.content.match(generalLinkRegex);
            if (links) {
                const badLink = links.some(url => {
                    const lower = url.toLowerCase();
                    return !allowedLinkDomains.some(d => lower.includes(d));
                });
                if (badLink) return handleAutoWarn(message, "wysyłać niedozwolonych linków");
            }
        }

        // === MASS MENTION ===
        if (message.mentions.users.size > MASS_MENTION_MAX) {
            return handleAutoWarn(message, `oznaczać zbyt wiele osób (max ${MASS_MENTION_MAX})`);
        }

        // === CAPS LOCK ===
        if (message.content.length > CAPS_LOCK_MIN_LEN) {
            const letters = message.content.replace(/[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '');
            if (letters.length > 0) {
                const upper = letters.replace(/[^A-ZĄĆĘŁŃÓŚŹŻ]/g, '');
                if (upper.length / letters.length > CAPS_LOCK_RATIO) {
                    return handleAutoWarn(message, "krzyczeć (nadużywanie caps lock)");
                }
            }
        }

        // === WULGARYZMY ===
        let clean = message.content.toLowerCase()
            .replace(/(.)\1+/g, '$1')
            .replace(/[0-9]/g, m => ({'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t'})[m] || m)
            .replace(/[^a-ząęćłńóśźż]/g, '');

        const isBad = badWords.some(w => clean.includes(w)) || 
                     forbiddenPatterns.some(p => clean.includes(p));

        if (isBad) {
            return handleAutoWarn(message, "używać wulgaryzmów");
        }
    });

    // ==========================================
    // FUNKCJA AUTO-WARN
    // ==========================================
    async function handleAutoWarn(message, reason) {
        try {
            await message.delete().catch(() => {});

            const { userId, guildId } = { userId: message.author.id, guildId: message.guild.id };

            db.prepare('INSERT OR IGNORE INTO warnings (userId, guildId, warnCount) VALUES (?, ?, 0)').run(userId, guildId);
            db.prepare('UPDATE warnings SET warnCount = warnCount + 1 WHERE userId = ? AND guildId = ?').run(userId, guildId);

            const { warnCount } = db.prepare('SELECT warnCount FROM warnings WHERE userId = ? AND guildId = ?').get(userId, guildId);

            let actionText = "Ostrzeżenie dodane.";

            if (warnCount === 3) {
                await message.member.timeout(10 * 60 * 1000, '3 ostrzeżenia');
                actionText = "Timeout 10 minut za 3 ostrzeżenia.";
            } else if (warnCount >= 5) {
                await message.member.timeout(24 * 60 * 60 * 1000, '5 ostrzeżeń');
                actionText = "Timeout 24h + reset licznika.";
                db.prepare('UPDATE warnings SET warnCount = 0 WHERE userId = ? AND guildId = ?').run(userId, guildId);
            }

            // Wiadomość na kanale
            const warnMsg = await message.channel.send({
                content: `⚠️ <@${userId}>, **${reason}**! To Twoje **${warnCount}** ostrzeżenie.`
            });
            setTimeout(() => warnMsg.delete().catch(() => {}), 8000);

            // DM
            const dmEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle(`⚔️ Złamanie Kodeksu – ${message.guild.name}`)
                .addFields(
                    { name: 'Powód', value: reason },
                    { name: 'Liczba ostrzeżeń', value: warnCount.toString() },
                    { name: 'Konsekwencja', value: actionText },
                    { name: 'Treść', value: `\`\`\`${message.content.slice(0, 500)}\`\`\`` }
                )
                .setTimestamp();

            message.author.send({ embeds: [dmEmbed] }).catch(() => {});

            // Log
            const logChannel = message.guild.channels.cache.get(logChannelId);
            if (logChannel) {
                logChannel.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#FF4500')
                        .setTitle('👁️ Auto-Mod')
                        .setThumbnail(message.author.displayAvatarURL())
                        .addFields(
                            { name: 'Winny', value: `${message.author.tag} (<@${userId}>)` },
                            { name: 'Ostrzeżeń', value: warnCount.toString() },
                            { name: 'Powód', value: reason },
                            { name: 'Kara', value: actionText }
                        )
                        .setTimestamp()
                    ]
                });
            }
        } catch (err) {
            console.error('❌ [AUTO-WARN ERROR]:', err);
        }
    }

    console.log('🛡️ System Moderacji Załadowany!');
};
