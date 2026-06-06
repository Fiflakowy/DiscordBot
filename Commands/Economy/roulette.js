const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder,
} = require('discord.js');
const { createCanvas } = require('canvas');
const db = require('../../db.js');

// ─── Constants ───────────────────────────────────────────────────────────────

const activeTables = new Set();

const RED_NUMBERS  = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const BLACK_NUMBERS = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);

// Roulette wheel order (European single-zero)
const WHEEL_ORDER = [
    0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,
    24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getColorInfo(n) {
    if (n === 0)             return { color: 'green', hex: '#1a7a3c', light: '#2ecc71', label: 'ZIELONY'  };
    if (RED_NUMBERS.has(n))  return { color: 'red',   hex: '#9b1c1c', light: '#e74c3c', label: 'CZERWONY' };
    return                          { color: 'black', hex: '#111827', light: '#6b7280', label: 'CZARNY'   };
}

function buildBetList(bets) {
    if (bets.length === 0) return '*Stół jest pusty... Kto zaryzykuje pierwszy?*';
    return bets
        .map(b => `**${b.tag}** → **${b.amount} 🪙** na **${b.displayValue}**`)
        .join('\n');
}

// ─── Canvas Renderer ─────────────────────────────────────────────────────────

/**
 * Draws a premium roulette result card with a full segmented wheel.
 * Returns a Buffer (PNG).
 */
function drawRouletteCanvas(winNumber) {
    const W = 900, H = 420;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext('2d');
    const cx = W / 2, cy = H / 2;

    const wc = getColorInfo(winNumber);

    // ── Gold gradient factory (re-created each time it's needed) ────────────
    function goldGrad() {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0,    '#9a7b1e');
        g.addColorStop(0.25, '#f5d060');
        g.addColorStop(0.5,  '#fffde7');
        g.addColorStop(0.75, '#f5d060');
        g.addColorStop(1,    '#9a7b1e');
        return g;
    }

    // ── Background felt ──────────────────────────────────────────────────────
    const bg = ctx.createRadialGradient(cx, cy, 60, cx, cy, 500);
    bg.addColorStop(0,   '#1b5e35');
    bg.addColorStop(0.6, '#0d3d1e');
    bg.addColorStop(1,   '#040f08');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── Gold border ──────────────────────────────────────────────────────────
    ctx.save();
    ctx.lineWidth   = 12;
    ctx.strokeStyle = goldGrad();
    roundRect(ctx, 4, 4, W - 8, H - 8, 16);
    ctx.stroke();
    ctx.lineWidth   = 2;
    ctx.strokeStyle = 'rgba(245,208,80,0.3)';
    roundRect(ctx, 20, 20, W - 40, H - 40, 10);
    ctx.stroke();
    ctx.restore();

    // ── Wheel setup ──────────────────────────────────────────────────────────
    const WR     = 165;  // outer radius of segments
    const segCnt = WHEEL_ORDER.length; // 37
    const sa     = (Math.PI * 2) / segCnt;
    const winIdx = WHEEL_ORDER.indexOf(winNumber);
    // rotate so winner lands at pointer (bottom = π/2)
    const rot = Math.PI / 2 - winIdx * sa - sa / 2;

    // outer gold bezel
    ctx.save();
    const bezel = ctx.createRadialGradient(cx, cy, WR - 4, cx, cy, WR + 20);
    bezel.addColorStop(0,   '#8a6d14');
    bezel.addColorStop(0.3, '#f5d060');
    bezel.addColorStop(0.6, '#c9a227');
    bezel.addColorStop(1,   '#5a4510');
    ctx.beginPath();
    ctx.arc(cx, cy, WR + 20, 0, Math.PI * 2);
    ctx.fillStyle = bezel;
    ctx.fill();
    ctx.restore();

    // segments
    for (let s = 0; s < segCnt; s++) {
        const n     = WHEEL_ORDER[s];
        const c     = getColorInfo(n);
        const start = rot + s * sa;
        const end   = start + sa;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, WR, start, end);
        ctx.closePath();
        ctx.fillStyle   = (n === winNumber) ? lightenHex(c.hex, 45) : c.hex;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth   = 1.2;
        ctx.stroke();
    }

    // segment number labels
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    for (let s = 0; s < segCnt; s++) {
        const n        = WHEEL_ORDER[s];
        const midAngle = rot + s * sa + sa / 2;
        const nr       = WR * 0.72;
        const tx       = cx + Math.cos(midAngle) * nr;
        const ty       = cy + Math.sin(midAngle) * nr;
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(midAngle + Math.PI / 2);
        ctx.font         = n === winNumber ? 'bold 11px sans-serif' : '9px sans-serif';
        ctx.fillStyle    = n === winNumber ? '#ffffff' : 'rgba(255,255,255,0.82)';
        ctx.shadowColor  = n === winNumber ? 'rgba(255,255,80,0.95)' : 'transparent';
        ctx.shadowBlur   = n === winNumber ? 7 : 0;
        ctx.fillText(n.toString(), 0, 0);
        ctx.restore();
    }
    ctx.restore();

    // gold diamonds on rim (decorative separators every 45°)
    ctx.save();
    for (let d = 0; d < 8; d++) {
        const a  = rot + (d / 8) * Math.PI * 2;
        const dx = cx + Math.cos(a) * (WR + 6);
        const dy = cy + Math.sin(a) * (WR + 6);
        ctx.save();
        ctx.translate(dx, dy);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(5, 0);
        ctx.lineTo(0, 6);
        ctx.lineTo(-5, 0);
        ctx.closePath();
        ctx.fillStyle = '#f5d060';
        ctx.fill();
        ctx.restore();
    }
    ctx.restore();

    // inner gold rim stroke
    ctx.beginPath();
    ctx.arc(cx, cy, WR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245,208,80,0.5)';
    ctx.lineWidth   = 2;
    ctx.stroke();

    // hub background
    ctx.save();
    const hub = ctx.createRadialGradient(cx, cy, 0, cx, cy, 58);
    hub.addColorStop(0,   '#2d2d2d');
    hub.addColorStop(0.7, '#181818');
    hub.addColorStop(1,   '#080808');
    ctx.beginPath();
    ctx.arc(cx, cy, 58, 0, Math.PI * 2);
    ctx.fillStyle = hub;
    ctx.fill();
    ctx.strokeStyle = goldGrad();
    ctx.lineWidth   = 4;
    ctx.stroke();
    ctx.restore();

    // hub: winning number
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = wc.light;
    ctx.shadowBlur   = 20;
    ctx.fillStyle    = '#ffffff';
    ctx.font         = 'bold 40px Georgia, serif';
    ctx.fillText(winNumber.toString(), cx, cy - 5);
    ctx.shadowBlur   = 0;
    ctx.font         = 'bold 13px sans-serif';
    ctx.fillStyle    = 'rgba(255,255,255,0.75)';
    ctx.fillText(wc.label, cx, cy + 24);
    ctx.restore();

    // ── Pointer triangle at bottom (pointing to winner) ──────────────────────
    const pAngle = Math.PI / 2;
    const pTipX  = cx + Math.cos(pAngle) * (WR + 2);
    const pTipY  = cy + Math.sin(pAngle) * (WR + 2);
    ctx.save();
    ctx.shadowColor = 'rgba(255,230,50,1)';
    ctx.shadowBlur  = 18;
    ctx.beginPath();
    ctx.moveTo(pTipX, pTipY);
    ctx.lineTo(pTipX - 9, pTipY - 22);
    ctx.lineTo(pTipX + 9, pTipY - 22);
    ctx.closePath();
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.restore();

    // ── Ball on the winning segment rim ──────────────────────────────────────
    const ballAngle = rot + winIdx * sa + sa / 2;
    const bx = cx + Math.cos(ballAngle) * (WR + 10);
    const by = cy + Math.sin(ballAngle) * (WR + 10);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur  = 10;
    const ballG = ctx.createRadialGradient(bx - 3, by - 3, 1, bx, by, 10);
    ballG.addColorStop(0,   '#ffffff');
    ballG.addColorStop(0.4, '#e8e8e8');
    ballG.addColorStop(1,   '#888888');
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, Math.PI * 2);
    ctx.fillStyle = ballG;
    ctx.fill();
    ctx.restore();

    // ── Left panel: RULETKA / ZAKONU ─────────────────────────────────────────
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur   = 12;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle    = goldGrad();
    ctx.font         = 'bold 40px Georgia, serif';
    ctx.fillText('RULETKA', 112, cy - 24);
    ctx.fillText('ZAKONU',  112, cy + 24);
    ctx.restore();

    // ── Right panel: WYPADŁO + colored badge ─────────────────────────────────
    const rx = W - 138, rw = 156, rh = 72;
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = goldGrad();
    ctx.font         = 'bold 18px sans-serif';
    ctx.shadowColor  = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur   = 8;
    ctx.fillText('WYPADŁO', rx, cy - 58);

    // badge
    ctx.shadowColor = wc.light;
    ctx.shadowBlur  = 22;
    roundRect(ctx, rx - rw / 2, cy - 28, rw, rh, 14);
    ctx.fillStyle   = wc.hex;
    ctx.fill();
    ctx.strokeStyle = wc.light;
    ctx.lineWidth   = 2;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font      = 'bold 44px Georgia, serif';
    ctx.fillText(winNumber.toString(), rx, cy + 6);

    ctx.font      = 'bold 14px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(wc.label, rx, cy + 38);
    ctx.restore();

    return canvas.toBuffer('image/png');
}

// ─── Utility: lighten hex color for winner segment highlight ─────────────────

function lightenHex(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r   = Math.min(255, (num >> 16) + amount);
    const g   = Math.min(255, ((num >> 8) & 0xff) + amount);
    const b   = Math.min(255, (num & 0xff) + amount);
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// ─── Utility: draw rounded rectangle path ────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ─── Command ─────────────────────────────────────────────────────────────────

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roulette')
        .setDescription('Otwórz stół do Ruletki dla wszystkich (Czas na zakłady: 30 sekund)'),

    async execute(interaction) {
        const channelId = interaction.channelId;
        const guildId   = interaction.guild.id;

        if (activeTables.has(channelId)) {
            return interaction.reply({
                content: '❌ Karczmarz już kręci kołem! Dorzuć się do obecnego stołu używając przycisków.',
                ephemeral: true,
            });
        }

        activeTables.add(channelId);
        await interaction.deferReply();

        /** @type {Map<string, {userId,tag,type,value,amount,displayValue}>} */
        const bets = new Map(); // userId → bet (1 bet per user, replaced on re-bet)

        // ── Build embed & buttons ────────────────────────────────────────────

        const tableEmbed = () =>
            new EmbedBuilder()
                .setColor('#D4AF37')
                .setTitle('🎰 Ekskluzywna Ruletka Zakonu')
                .setDescription(
                    'Karczmarz rzuca kulkę na mahoniowy stół. Macie **30 sekund**!\n\n' +
                    '**Wypłaty:**\n' +
                    '🔴 Czerwone / ⚫ Czarne ➔ **x2**\n' +
                    '🎲 Przedziały (1-12, 13-24, 25-36) ➔ **x2**\n' +
                    '🔢 Konkretna cyfra (1-36) ➔ **x3**\n' +
                    '🟢 Zielone (Tylko 0) ➔ **x5**'
                )
                .addFields({ name: '💰 Położone Złoto:', value: buildBetList([...bets.values()]) })
                .setFooter({ text: 'Zakon Fiflaka • Kasyno Premium' });

        const rowColors = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bet_red').setLabel('Czerwone (x2)').setStyle(ButtonStyle.Danger).setEmoji('🔴'),
            new ButtonBuilder().setCustomId('bet_black').setLabel('Czarne (x2)').setStyle(ButtonStyle.Secondary).setEmoji('⚫'),
            new ButtonBuilder().setCustomId('bet_green').setLabel('Zielone (x5)').setStyle(ButtonStyle.Success).setEmoji('🟢'),
        );
        const rowDozens = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bet_doz1').setLabel('1-12 (x2)').setStyle(ButtonStyle.Primary).setEmoji('🎲'),
            new ButtonBuilder().setCustomId('bet_doz2').setLabel('13-24 (x2)').setStyle(ButtonStyle.Primary).setEmoji('🎲'),
            new ButtonBuilder().setCustomId('bet_doz3').setLabel('25-36 (x2)').setStyle(ButtonStyle.Primary).setEmoji('🎲'),
        );
        const rowNumber = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bet_number').setLabel('Konkretna Cyfra (x3)').setStyle(ButtonStyle.Primary).setEmoji('🔢'),
        );

        const tableMessage = await interaction.editReply({
            embeds: [tableEmbed()],
            components: [rowColors, rowDozens, rowNumber],
        });

        // ── Collector ────────────────────────────────────────────────────────

        const collector = tableMessage.createMessageComponentCollector({ time: 30_000 });

        collector.on('collect', async (i) => {
            const userId  = i.user.id;
            const modalId = `roulette_modal_${i.customId}_${i.id}`;

            const modal = new ModalBuilder().setCustomId(modalId).setTitle('Twój Zakład');

            const amountInput = new TextInputBuilder()
                .setCustomId('amount')
                .setLabel('Ile monet kładziesz na stół?')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(7);

            modal.addComponents(new ActionRowBuilder().addComponents(amountInput));

            if (i.customId === 'bet_number') {
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('number')
                            .setLabel('Wpisz cyfrę (1-36):')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                            .setMaxLength(2),
                    ),
                );
            }

            await i.showModal(modal);

            let submitted;
            try {
                submitted = await i.awaitModalSubmit({
                    filter: (x) => x.customId === modalId && x.user.id === userId,
                    time: 25_000,
                });
            } catch {
                return; // user didn't submit in time — silently ignore
            }

            await submitted.deferReply({ ephemeral: true });

            // ── Parse amount ──────────────────────────────────────────────────
            const amount = parseInt(submitted.fields.getTextInputValue('amount'), 10);
            if (!Number.isInteger(amount) || amount <= 0) {
                return submitted.editReply('❌ Karczmarz kręci głową. Podaj poprawną, dodatnią liczbę monet!');
            }

            // ── DB: ensure row, check balance ─────────────────────────────────
            db.prepare(
                'INSERT OR IGNORE INTO economy (userId, guildId, coins) VALUES (?, ?, 0)'
            ).run(userId, guildId);

            const userEco = db.prepare(
                'SELECT coins FROM economy WHERE userId = ? AND guildId = ?'
            ).get(userId, guildId);

            // If user is re-betting, temporarily refund their previous bet for balance check
            const prevBet = bets.get(userId);
            const effectiveCoins = userEco.coins + (prevBet ? prevBet.amount : 0);

            if (effectiveCoins < amount) {
                return submitted.editReply(
                    `❌ Biedaku! Chcesz obstawić **${amount} 🪙**, ale po odliczeniu poprzedniego zakładu możesz postawić co najwyżej **${effectiveCoins} 🪙**.`
                );
            }

            // ── Build bet object ──────────────────────────────────────────────
            let betType, betValue, displayValue;

            switch (i.customId) {
                case 'bet_red':    betType = 'color';  betValue = 'red';   displayValue = '🔴 Czerwone';    break;
                case 'bet_black':  betType = 'color';  betValue = 'black'; displayValue = '⚫ Czarne';      break;
                case 'bet_green':  betType = 'color';  betValue = 'green'; displayValue = '🟢 Zielone (0)'; break;
                case 'bet_doz1':   betType = 'dozen';  betValue = 1;       displayValue = '🎲 1-12';        break;
                case 'bet_doz2':   betType = 'dozen';  betValue = 2;       displayValue = '🎲 13-24';       break;
                case 'bet_doz3':   betType = 'dozen';  betValue = 3;       displayValue = '🎲 25-36';       break;
                case 'bet_number': {
                    const num = parseInt(submitted.fields.getTextInputValue('number'), 10);
                    if (!Number.isInteger(num) || num < 1 || num > 36) {
                        return submitted.editReply('❌ Konkretna cyfra musi być z zakresu **1–36**!');
                    }
                    betType = 'number'; betValue = num; displayValue = `🔢 Cyfra: ${num}`;
                    break;
                }
                default:
                    return submitted.editReply('❌ Nieznany rodzaj zakładu.');
            }

            // ── Refund previous bet (if re-betting) then deduct new ───────────
            if (prevBet) {
                db.prepare(
                    'UPDATE economy SET coins = coins + ? WHERE userId = ? AND guildId = ?'
                ).run(prevBet.amount, userId, guildId);
            }
            db.prepare(
                'UPDATE economy SET coins = coins - ? WHERE userId = ? AND guildId = ?'
            ).run(amount, userId, guildId);

            // ── Store bet ─────────────────────────────────────────────────────
            bets.set(userId, { userId, tag: i.user.username, type: betType, value: betValue, amount, displayValue });

            // ── Update table embed ────────────────────────────────────────────
            await interaction.editReply({ embeds: [tableEmbed()] });

            const rebet = prevBet ? ` *(poprzedni zakład zastąpiony)*` : '';
            await submitted.editReply(
                `✅ Zakład na **${displayValue}** za **${amount} 🪙** przyjęty!${rebet}`
            );
        });

        // ── On end: spin & resolve ────────────────────────────────────────────

        collector.on('end', async () => {
            activeTables.delete(channelId);

            const winNumber = Math.floor(Math.random() * 37); // 0–36
            const { hex: winHex, color: winColor, label: colorLabel } = getColorInfo(winNumber);

            // Disable buttons
            try {
                const disabledComponents = tableMessage.components.map((row) =>
                    new ActionRowBuilder().addComponents(
                        row.components.map((btn) =>
                            ButtonBuilder.from(btn).setDisabled(true)
                        )
                    )
                );
                await interaction.editReply({ components: disabledComponents });
            } catch { /* message may be gone */ }

            // Draw canvas
            const imgBuffer  = drawRouletteCanvas(winNumber);
            const attachment = new AttachmentBuilder(imgBuffer, { name: 'roulette_result.png' });

            // Resolve bets
            let resultLines = [];
            let totalPaidOut = 0;

            if (bets.size === 0) {
                resultLines.push('*Nikt nie obstawił. Karczmarz wzrusza ramionami i poleruje kulkę.*');
            } else {
                for (const bet of bets.values()) {
                    let won = false, multiplier = 0;

                    if (bet.type === 'color') {
                        won = bet.value === winColor;
                        multiplier = bet.value === 'green' ? 5 : 2;
                    } else if (bet.type === 'dozen') {
                        const ranges = { 1: [1,12], 2: [13,24], 3: [25,36] };
                        const [lo, hi] = ranges[bet.value];
                        won = winNumber >= lo && winNumber <= hi;
                        multiplier = 2;
                    } else if (bet.type === 'number') {
                        won = bet.value === winNumber;
                        multiplier = 3;
                    }

                    if (won) {
                        const payout = bet.amount * multiplier;
                        totalPaidOut += payout;
                        db.prepare(
                            'UPDATE economy SET coins = coins + ? WHERE userId = ? AND guildId = ?'
                        ).run(payout, bet.userId, guildId);
                        resultLines.push(`🎉 **${bet.tag}** wygrywa **${payout} 🪙**! *(${bet.displayValue}, x${multiplier})*`);
                    } else {
                        resultLines.push(`💀 **${bet.tag}** traci **${bet.amount} 🪙** *(${bet.displayValue})*`);
                    }
                }
            }

            const resultEmbed = new EmbedBuilder()
                .setColor(winHex)
                .setTitle(`🎰 WYPADŁO: ${winNumber} — ${colorLabel}`)
                .setDescription(resultLines.join('\n'))
                .setImage('attachment://roulette_result.png')
                .setFooter({ text: 'Zakon Fiflaka • Ekskluzywne Kasyno' })
                .setTimestamp();

            if (totalPaidOut > 0) {
                resultEmbed.addFields({ name: '💸 Łączna wypłata:', value: `**${totalPaidOut} 🪙**` });
            }

            await interaction.followUp({ embeds: [resultEmbed], files: [attachment] });
        });
    },
};