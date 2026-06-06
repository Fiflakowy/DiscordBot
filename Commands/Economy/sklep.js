const {
    SlashCommandBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder
} = require('discord.js');
const db = require('../../db.js');
const { createCanvas } = require('@napi-rs/canvas');

// ─────────────────────────────────────────────
// 📦 SHOP DATA (BAZA PRZEDMIOTÓW)
// ─────────────────────────────────────────────
const ELIXIRS = [
    { id: 'e1', label: 'Słaby Wywar',          mult: 1.5, emoji: '🧪', rarity: 'Pospolity',   color: '#78c46e', desc: 'Delikatna mikstura dla nowicjuszy.' },
    { id: 'e2', label: 'Mikstura Odwagi',       mult: 2.0, emoji: '🍺', rarity: 'Pospolity',   color: '#78c46e', desc: 'Dodaje sił na wieczorną sesję.' },
    { id: 'e3', label: 'Eliksir Mędrca',        mult: 2.5, emoji: '📚', rarity: 'Rzadki',      color: '#5ba3f5', desc: 'Wiedza zakodowana w każdej kropli.' },
    { id: 'e4', label: 'Miód Królewski',        mult: 3.0, emoji: '🍯', rarity: 'Rzadki',      color: '#5ba3f5', desc: 'Zbierany przez pszczoły Karczmarza.' },
    { id: 'e5', label: 'Smocza Krew',           mult: 3.5, emoji: '🐲', rarity: 'Epicki',      color: '#c17af0', desc: 'Pali gardło. Przynosi chwałę.' },
    { id: 'e6', label: 'Błogosławieństwo',      mult: 4.0, emoji: '⚡', rarity: 'Epicki',      color: '#c17af0', desc: 'Dotknięty boską mocą.' },
    { id: 'e7', label: 'Kamień Filozoficzny',   mult: 4.5, emoji: '💎', rarity: 'Legendarny',  color: '#f5a623', desc: 'Owoc wieków alchemicznych badań.' },
    { id: 'e8', label: 'Serce Legendy',         mult: 5.0, emoji: '👑', rarity: 'Mityczny',    color: '#ff4e6a', desc: 'Legenda sama prosi Cię o autograf.' },
];

const DURATIONS = [
    { h: 1,   label: '1 Godzina',     tag: 'Szybki strzał',      emoji: '⚡' },
    { h: 3,   label: '3 Godziny',     tag: 'Wieczorna sesja',    emoji: '🌆' },
    { h: 6,   label: '6 Godzin',      tag: 'Pół nocy',           emoji: '🌙' },
    { h: 12,  label: '12 Godzin',     tag: 'Cały dzień',         emoji: '☀️' },
    { h: 24,  label: '24 Godziny',    tag: 'Pełna doba',         emoji: '🗓️' },
    { h: 48,  label: '2 Dni',         tag: 'Weekend na bogato',  emoji: '🏖️' },
    { h: 72,  label: '3 Dni',         tag: 'Długi weekend',      emoji: '🎉' },
    { h: 168, label: '7 Dni',         tag: 'Tydzień chwały',     emoji: '👑' },
];

const ARTIFACTS = [
    {
        id:    'art_warn',
        label: 'Czysta Karta',
        desc:  'Wymazuje jedno ostrzeżenie z Twojej kartoteki na zawsze.',
        price: 15000,
        emoji: '🕊️',
        rarity: 'Rzadki',
    },
    {
        id:    'art_xp2',
        label: 'Zwój Wiedzy',
        desc:  'Natychmiastowy bonus +500 XP. Jednorazowego użytku.',
        price: 8000,
        emoji: '📜',
        rarity: 'Pospolity',
    },
];

const BASE_ELIXIR_PRICE = 750;

const RARITY_COLOR = {
    Pospolity:   0x78c46e,
    Rzadki:      0x5ba3f5,
    Epicki:      0xc17af0,
    Legendarny:  0xf5a623,
    Mityczny:    0xff4e6a,
};

// ─────────────────────────────────────────────
// 🎨 CANVAS GENERATOR (Wydajniejsza wersja)
// ─────────────────────────────────────────────
/**
 * Generates a dynamic shop banner image using Canvas.
 * @returns {Promise<AttachmentBuilder>} Discord Attachment
 */
async function generateShopBanner(username, coins, boostMult, boostActive) {
    const W = 760, H = 180;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0,   '#0d0d1a');
    bg.addColorStop(0.5, '#1a1025');
    bg.addColorStop(1,   '#0d0d1a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Decorative grid lines
    ctx.strokeStyle = 'rgba(228,196,100,0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Gold shimmer top & bottom bars
    const barGrad = ctx.createLinearGradient(0, 0, W, 0);
    barGrad.addColorStop(0,   'rgba(228,196,100,0)');
    barGrad.addColorStop(0.3, 'rgba(228,196,100,0.9)');
    barGrad.addColorStop(0.7, 'rgba(228,196,100,0.9)');
    barGrad.addColorStop(1,   'rgba(228,196,100,0)');
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, W, 3);
    ctx.fillRect(0, H - 3, W, 3);

    // Glow orb left
    const orb = ctx.createRadialGradient(90, 90, 5, 90, 90, 100);
    orb.addColorStop(0,   'rgba(228,196,100,0.25)');
    orb.addColorStop(1,   'rgba(228,196,100,0)');
    ctx.fillStyle = orb;
    ctx.fillRect(0, 0, W, H);

    // TITLE
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = '#e4c464';
    ctx.shadowColor = 'rgba(228,196,100,0.7)';
    ctx.shadowBlur = 18;
    ctx.fillText('🏛️  Sklep Karczmarza', 28, 56);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.font = '16px sans-serif';
    ctx.fillStyle = 'rgba(228,196,100,0.55)';
    ctx.fillText('Królewska Alchemia & Czarny Rynek', 32, 82);

    // Divider
    ctx.strokeStyle = 'rgba(228,196,100,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(28, 96); ctx.lineTo(420, 96); ctx.stroke();

    // User info
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#c9a84c';
    ctx.fillText(`👤 ${username}`, 32, 120);
    ctx.fillText(`💰 ${coins.toLocaleString('pl-PL')} monet`, 32, 143);

    if (boostActive) {
        ctx.fillStyle = '#2ECC71';
        ctx.fillText(`🧪 Aktywny boost: x${boostMult}`, 32, 165);
    } else {
        ctx.fillStyle = 'rgba(200,200,200,0.45)';
        ctx.fillText(`🧪 Brak aktywnego boosta`, 32, 165);
    }

    // Right decorative diamond
    const dX = 660, dY = 90, dS = 55;
    ctx.save();
    ctx.translate(dX, dY);
    ctx.rotate(Math.PI / 4);
    const dGrad = ctx.createLinearGradient(-dS, -dS, dS, dS);
    dGrad.addColorStop(0, 'rgba(228,196,100,0.18)');
    dGrad.addColorStop(1, 'rgba(228,196,100,0.04)');
    ctx.fillStyle = dGrad;
    ctx.strokeStyle = 'rgba(228,196,100,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(-dS / 2, -dS / 2, dS, dS);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Floating coins decoration
    const coinPositions = [[580, 45], [620, 130], [700, 60], [730, 140]];
    for (const [cx, cy] of coinPositions) {
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        const cGrad = ctx.createRadialGradient(cx - 3, cy - 3, 2, cx, cy, 10);
        cGrad.addColorStop(0, 'rgba(255,220,100,0.55)');
        cGrad.addColorStop(1, 'rgba(180,140,40,0.15)');
        ctx.fillStyle = cGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(228,196,100,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // NAPI-RS Async Encode - much better performance!
    const buffer = await canvas.encode('png');
    return new AttachmentBuilder(buffer, { name: 'shop_banner.png' });
}

// ─────────────────────────────────────────────
// 🛠️ UTILS & HELPERS
// ─────────────────────────────────────────────
const elixirPrice = (mult, hours) => Math.floor(BASE_ELIXIR_PRICE * mult * hours);

const rarityBar = (rarity) => {
    const map = { Pospolity: 1, Rzadki: 2, Epicki: 3, Legendarny: 4, Mityczny: 5 };
    const filled = map[rarity] ?? 1;
    return '◆'.repeat(filled) + '◇'.repeat(5 - filled);
};

const boostStatusField = (user) => {
    if (user.boostExpires > Date.now()) {
        return `\`🟢 AKTYWNY\` • x${user.boostMultiplier} • Wygasa <t:${Math.floor(user.boostExpires / 1000)}:R>`;
    }
    return `\`⬛ BRAK\` • Kup eliksir poniżej!`;
};

// ─────────────────────────────────────────────
// 📑 EMBED BUILDERS
// ─────────────────────────────────────────────
const buildMainEmbed = (user, warnData, guild) => new EmbedBuilder()
    .setColor(0xe4c464)
    .setAuthor({ name: `${guild.name} • Sklep Karczmarza`, iconURL: guild.iconURL({ dynamic: true }) ?? undefined })
    .setTitle('Witaj, Wędrowcze!')
    .setDescription(
        `> *"Wejdź, usiądź, wyjmij mieszek. Mam tu towary, które odmienią Twój los."*\n\n` +
        `Wybierz kategorię z menu poniżej, by przeglądać wares.`
    )
    .addFields(
        { name: '💰 Stan Kasy', value: `\`\`\`fix\n${user.coins.toLocaleString('pl-PL')} monet\`\`\``, inline: true },
        { name: '⚠️ Przewinienia', value: warnData.warnCount > 0 ? `\`\`\`diff\n- ${warnData.warnCount} ostrzeżenie(a)\`\`\`` : `\`\`\`diff\n+ Czysta kartoteka\`\`\``, inline: true },
        { name: '🧪 Aktywny Boost', value: boostStatusField(user), inline: false },
        { name: '📦 Kategorie', value: `> 🧪 **Eliksiry** — Mnożniki XP i Monet na czas\n> 🗝️ **Artefakty** — Rzadkie przedmioty jednorazowe\n`, inline: false }
    )
    .setImage('attachment://shop_banner.png')
    .setFooter({ text: '⏳ Sklep zamknie się po 2 minutach braku aktywności' });

const buildElixirBrowseEmbed = (user) => new EmbedBuilder()
    .setColor(0x5b4fcf)
    .setTitle('🧪 Karty Eliksirów')
    .setDescription(ELIXIRS.map(e => `${e.emoji} **${e.label}** \`${e.rarity}\` ${rarityBar(e.rarity)}\n↳ Mnożnik: **x${e.mult}** • ${e.desc}`).join('\n\n'))
    .addFields({ name: '💡 Jak kupić?', value: 'Wybierz eliksir z menu, a następnie czas działania. Cena = `mnożnik × czas × 750`.', inline: false })
    .setFooter({ text: `Twoje monety: ${user.coins.toLocaleString('pl-PL')} 🪙` });

const buildElixirTimeEmbed = (elixir, user) => new EmbedBuilder()
    .setColor(RARITY_COLOR[elixir.rarity] ?? 0xe4c464)
    .setTitle(`${elixir.emoji} ${elixir.label}`)
    .setDescription(
        `> ${elixir.desc}\n\n**Rzadkość:** \`${elixir.rarity}\` ${rarityBar(elixir.rarity)}\n**Mnożnik:** x${elixir.mult}\n\n**Dostępne opcje czasowe:**\n\n` +
        DURATIONS.map(d => {
            const price = elixirPrice(elixir.mult, d.h);
            return `${d.emoji} **${d.label}** — \`${price.toLocaleString('pl-PL')} 🪙\` ${user.coins >= price ? '✅' : '❌'}  _${d.tag}_`;
        }).join('\n')
    )
    .addFields({ name: '💰 Twoje Monety', value: `**${user.coins.toLocaleString('pl-PL')} 🪙**`, inline: true })
    .setFooter({ text: '✅ = stać Cię  |  ❌ = za mało monet' });

const buildArtifactBrowseEmbed = (user, warnData) => new EmbedBuilder()
    .setColor(0xc17af0)
    .setTitle('🗝️ Czarny Rynek Artefaktów')
    .setDescription(`> *"Nie pytaj skąd to mam. Pytaj, ile chcesz."*\n\n` + ARTIFACTS.map(a => `${a.emoji} **${a.label}** \`${a.rarity}\` ${rarityBar(a.rarity)}\n↳ Cena: **${a.price.toLocaleString('pl-PL')} 🪙** • ${a.desc}`).join('\n\n'))
    .addFields(
        { name: '💰 Monety', value: `**${user.coins.toLocaleString('pl-PL')} 🪙**`, inline: true },
        { name: '⚠️ Ostrzeżenia', value: `**${warnData.warnCount}**`, inline: true }
    )
    .setFooter({ text: 'Artefakty są jednorazowego użytku.' });

const buildSuccessEmbed = (title, description, fields, avatarURL) => new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .addFields(...fields)
    .setThumbnail(avatarURL)
    .setFooter({ text: 'Transakcja zakończona pomyślnie • Zakon Fiflaka' });

const buildErrorEmbed = (msg) => new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle('❌ Transakcja Odrzucona')
    .setDescription(msg)
    .setFooter({ text: 'Sprawdź stan konta i spróbuj ponownie.' });

// ─────────────────────────────────────────────
// 🎛️ COMPONENT BUILDERS (Przyciski i Menu)
// ─────────────────────────────────────────────
const buildCategoryRow = () => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cat_elixirs').setLabel('Eliksiry').setEmoji('🧪').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('cat_artifacts').setLabel('Artefakty').setEmoji('🗝️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('close_shop').setLabel('Wyjdź').setEmoji('🚪').setStyle(ButtonStyle.Danger)
);

const buildElixirSelectRow = () => new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('select_elixir').setPlaceholder('🧪 Wybierz eliksir...').addOptions(
        ELIXIRS.map(e => new StringSelectMenuOptionBuilder().setLabel(`${e.label}  (x${e.mult})`).setDescription(`${e.rarity} • ${e.desc.substring(0, 50)}`).setValue(e.id).setEmoji(e.emoji))
    )
);

const buildElixirTimeRow = (elixirId, userCoins) => new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`buy_elixir_${elixirId}`).setPlaceholder('⏳ Wybierz czas trwania...').addOptions(
        DURATIONS.map(d => {
            const elixir = ELIXIRS.find(e => e.id === elixirId);
            const price = elixirPrice(elixir.mult, d.h);
            const canAfford = userCoins >= price;
            return new StringSelectMenuOptionBuilder()
                .setLabel(`${d.emoji} ${d.label} — ${price.toLocaleString('pl-PL')} 🪙`)
                .setDescription(`${d.tag}${!canAfford ? ' • ❌ Za mało monet' : ''}`)
                .setValue(`${d.h}_${price}`)
                .setEmoji(canAfford ? '✅' : '❌');
        })
    )
);

const buildBackRow = (target = 'cat_elixirs') => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(target).setLabel('Wróć').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('close_shop').setLabel('Wyjdź').setEmoji('🚪').setStyle(ButtonStyle.Danger)
);

const buildArtifactSelectRow = () => new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId('buy_artifact').setPlaceholder('🗝️ Wybierz artefakt...').addOptions(
        ARTIFACTS.map(a => new StringSelectMenuOptionBuilder().setLabel(`${a.label} — ${a.price.toLocaleString('pl-PL')} 🪙`).setDescription(a.desc.substring(0, 80)).setValue(a.id).setEmoji(a.emoji))
    )
);

// ─────────────────────────────────────────────
// 🚀 MAIN COMMAND
// ─────────────────────────────────────────────
module.exports = {
    data: new SlashCommandBuilder()
        .setName('sklep')
        .setDescription('Otwórz Sklep Karczmarza — Eliksiry, Artefakty i więcej'),

    async execute(interaction) {
        const { user: { id: userId, username }, guild: { id: guildId }, guild } = interaction;

        // Ensure DB rows exist (safeguard)
        db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, boostMultiplier, boostExpires, lastDaily) VALUES (?, ?, 0, 1, 0, 0)').run(userId, guildId);
        db.prepare('INSERT OR IGNORE INTO warnings (userId, guildId, warnCount) VALUES (?, ?, 0)').run(userId, guildId);

        // Fetch Functions
        const getUser = () => db.prepare('SELECT * FROM economy WHERE userId = ? AND guildId = ?').get(userId, guildId);
        const getWarnData = () => db.prepare('SELECT warnCount FROM warnings WHERE userId = ? AND guildId = ?').get(userId, guildId);

        const user = getUser();
        const warnData = getWarnData();

        // Generate Canvas Banner Safely
        let banner = null;
        try {
            banner = await generateShopBanner(username, user.coins, user.boostMultiplier, user.boostExpires > Date.now());
        } catch (err) {
            console.error('[Sklep] Canvas generation failed:', err);
        }

        const response = await interaction.reply({
            embeds: [buildMainEmbed(user, warnData, guild)],
            components: [buildCategoryRow()],
            files: banner ? [banner] : [],
        });

        const collector = response.createMessageComponentCollector({ time: 120_000 });

        collector.on('collect', async i => {
            try {
                // Guard: Only invoker can click
                if (i.user.id !== userId) {
                    return i.reply({ content: '🗡️ Ten sklep jest przeznaczony dla kogoś innego!', ephemeral: true });
                }

                const fresh = getUser();
                const freshWarn = getWarnData();

                // ── NAVIGATION ──
                if (i.customId === 'cat_elixirs') {
                    return await i.update({ embeds: [buildElixirBrowseEmbed(fresh)], components: [buildElixirSelectRow(), buildBackRow('back_main')], files: [] });
                }

                if (i.customId === 'cat_artifacts') {
                    return await i.update({ embeds: [buildArtifactBrowseEmbed(fresh, freshWarn)], components: [buildArtifactSelectRow(), buildBackRow('back_main')], files: [] });
                }

                if (i.customId === 'back_main') {
                    let newBanner = null;
                    try { newBanner = await generateShopBanner(username, fresh.coins, fresh.boostMultiplier, fresh.boostExpires > Date.now()); } catch {}
                    return await i.update({ embeds: [buildMainEmbed(fresh, freshWarn, guild)], components: [buildCategoryRow()], files: newBanner ? [newBanner] : [] });
                }

                if (i.customId === 'close_shop') {
                    collector.stop('closed');
                    return await i.update({ content: '🚪 *Zatrzaskujesz drzwi Karczmarza za sobą.*', embeds: [], components: [], files: [] });
                }

                // ── ELIXIR LOGIC ──
                if (i.customId === 'select_elixir') {
                    const elixirId = i.values[0];
                    const elixir = ELIXIRS.find(e => e.id === elixirId);
                    if (!elixir) return await i.reply({ content: '❓ Nieznany eliksir.', ephemeral: true });
                    return await i.update({ embeds: [buildElixirTimeEmbed(elixir, fresh)], components: [buildElixirTimeRow(elixirId, fresh.coins), buildBackRow('cat_elixirs')], files: [] });
                }

                if (i.customId.startsWith('buy_elixir_')) {
                    const elixirId = i.customId.replace('buy_elixir_', '');
                    const elixir = ELIXIRS.find(e => e.id === elixirId);
                    if (!elixir) return await i.reply({ content: '❓ Nieznany eliksir.', ephemeral: true });

                    const [hoursStr, priceStr] = i.values[0].split('_');
                    const hours = parseInt(hoursStr);
                    const finalPrice = parseInt(priceStr);
                    const durationMs = hours * 60 * 60 * 1000;
                    const durInfo = DURATIONS.find(d => d.h === hours);

                    // Anti-cheat validation
                    if (finalPrice !== elixirPrice(elixir.mult, hours)) {
                        return await i.reply({ content: '⚠️ Wykryto manipulację ceną. Transakcja anulowana.', ephemeral: true });
                    }

                    if (fresh.coins < finalPrice) {
                        return await i.update({ embeds: [buildErrorEmbed(`Brakuje Ci złota!\nPotrzebujesz **${finalPrice.toLocaleString('pl-PL')} 🪙**, masz **${fresh.coins.toLocaleString('pl-PL')} 🪙**.`)], components: [buildBackRow('cat_elixirs')], files: [] });
                    }

                    // Stack duration logic
                    const isStacking = fresh.boostExpires > Date.now() && fresh.boostMultiplier === elixir.mult;
                    const newExpiry = isStacking ? fresh.boostExpires + durationMs : Date.now() + durationMs;

                    db.prepare('UPDATE economy SET coins = coins - ?, boostMultiplier = ?, boostExpires = ? WHERE userId = ? AND guildId = ?').run(finalPrice, elixir.mult, newExpiry, userId, guildId);

                    collector.stop('bought');
                    return await i.update({
                        embeds: [buildSuccessEmbed(
                            'Eliksir zakupiony!',
                            `Karczmarz rzuca Ci ${elixir.emoji} **${elixir.label}**. Wypijasz go duszkiem!\n${isStacking ? '> ⚡ *Czas dodany do istniejącego boosta!*' : ''}`,
                            [
                                { name: '🪄 Mnożnik', value: `**x${elixir.mult}**`, inline: true },
                                { name: '⏳ Czas', value: `**${durInfo?.label ?? hours + 'h'}**`, inline: true },
                                { name: '📅 Wygasa', value: `<t:${Math.floor(newExpiry / 1000)}:f>`, inline: false },
                                { name: '💸 Zapłacono', value: `**${finalPrice.toLocaleString('pl-PL')} 🪙**`, inline: true },
                                { name: '💰 Pozostało', value: `**${(fresh.coins - finalPrice).toLocaleString('pl-PL')} 🪙**`, inline: true },
                            ],
                            interaction.user.displayAvatarURL({ dynamic: true })
                        )],
                        components: [], files: []
                    });
                }

                // ── ARTIFACT LOGIC ──
                if (i.customId === 'buy_artifact') {
                    const artifactId = i.values[0];
                    const artifact = ARTIFACTS.find(a => a.id === artifactId);
                    if (!artifact) return await i.reply({ content: '❓ Nieznany artefakt.', ephemeral: true });

                    // Warn clear logic check
                    if (artifactId === 'art_warn' && freshWarn.warnCount === 0) {
                        return await i.reply({ embeds: [buildErrorEmbed('Masz czystą kartotekę — nie potrzebujesz Czystej Karty!\nOszczędź złoto.')], ephemeral: true });
                    }

                    if (fresh.coins < artifact.price) {
                        return await i.update({ embeds: [buildErrorEmbed(`Brakuje Ci złota!\nPotrzebujesz **${artifact.price.toLocaleString('pl-PL')} 🪙**, masz **${fresh.coins.toLocaleString('pl-PL')} 🪙**.`)], components: [buildBackRow('cat_artifacts')], files: [] });
                    }

                    // Process Payment & Reward
                    db.prepare('UPDATE economy SET coins = coins - ? WHERE userId = ? AND guildId = ?').run(artifact.price, userId, guildId);
                    let extraField = null;

                    if (artifactId === 'art_warn') {
                        db.prepare('UPDATE warnings SET warnCount = MAX(0, warnCount - 1) WHERE userId = ? AND guildId = ?').run(userId, guildId);
                        const newWarn = getWarnData();
                        extraField = { name: '📉 Nowy stan ostrzeżeń', value: `**${newWarn.warnCount}**`, inline: true };
                    } else if (artifactId === 'art_xp2') {
                        db.prepare('UPDATE economy SET xp = COALESCE(xp, 0) + 500 WHERE userId = ? AND guildId = ?').run(userId, guildId);
                        extraField = { name: '📈 XP przyznane', value: `**+500 XP**`, inline: true };
                    }

                    const fields = [
                        { name: '🗝️ Artefakt', value: `**${artifact.emoji} ${artifact.label}**`, inline: true },
                        { name: '💸 Zapłacono', value: `**${artifact.price.toLocaleString('pl-PL')} 🪙**`, inline: true },
                        { name: '💰 Pozostało', value: `**${(fresh.coins - artifact.price).toLocaleString('pl-PL')} 🪙**`, inline: true },
                    ];
                    if (extraField) fields.push(extraField);

                    collector.stop('bought');
                    return await i.update({
                        embeds: [buildSuccessEmbed(`${artifact.label} — Zakupiono!`, `Karczmarz wyjmuje ${artifact.emoji} **${artifact.label}** spod lady i wręcza Ci go z uśmiechem.\n> *"${artifact.desc}"*`, fields, interaction.user.displayAvatarURL({ dynamic: true }))],
                        components: [], files: []
                    });
                }
            } catch (error) {
                console.error('[Sklep] Błąd podczas obsługi interakcji:', error);
                // Błąd przy i.update() po timeout/lagu Discorda - po prostu ignorujemy, żeby nie rzuciło serwera
            }
        });

        // ── TIMEOUT ──
        collector.on('end', (_, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: '⏳ *Karczmarz spuścił rolety. Wróć, kiedy będziesz gotów wydać złoto.*', embeds: [], components: [], files: [] }).catch(() => {});
            }
        });
    },
};