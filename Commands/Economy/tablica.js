const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    AttachmentBuilder 
} = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const db = require('../../db.js');

// ─── Utility: Funkcja do rysowania zaokrąglonych prostokątów ────────────────
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

// ─── Canvas Renderer: Tworzenie Graficznej Tablicy ───────────────────────────
async function drawQuestCanvas(user, quest, eco, finalReward, hasCombo, isReady) {
    const W = 800, H = 500;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // 1. Tło: Drewniana Tablica
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#3e2723'); // Ciemne drewno
    bgGrad.addColorStop(1, '#1b100b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Wewnętrzna ramka tablicy
    ctx.strokeStyle = '#140c08';
    ctx.lineWidth = 15;
    ctx.strokeRect(7, 7, W - 14, H - 14);

    // 2. Pergamin
    const PW = 720, PH = 420, PX = 40, PY = 40;
    
    // Cień pergaminu
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#fdf1d5'; // Kolor starego papieru
    roundRect(ctx, PX, PY, PW, PH, 10);
    ctx.fill();
    ctx.restore();

    // Szum/Brud na pergaminie (delikatny efekt tekstury)
    ctx.fillStyle = 'rgba(139, 115, 85, 0.05)';
    for (let i = 0; i < 500; i++) {
        const x = Math.random() * PW + PX;
        const y = Math.random() * PH + PY;
        const s = Math.random() * 2 + 1;
        ctx.fillRect(x, y, s, s);
    }

    // 3. Nagłówek i Avatar
    ctx.fillStyle = '#3e2723';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('Królewskie Zlecenia', PX + 110, PY + 50);
    
    ctx.font = 'italic 18px Georgia, serif';
    ctx.fillStyle = '#5c4033';
    ctx.fillText(`Wędrowiec: ${user.username}`, PX + 110, PY + 80);

    // Ładowanie avatara (okrągły)
    try {
        const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 128 }));
        ctx.save();
        ctx.beginPath();
        ctx.arc(PX + 60, PY + 60, 40, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, PX + 20, PY + 20, 80, 80);
        ctx.restore();
        // Złota ramka wokół avatara
        ctx.beginPath();
        ctx.arc(PX + 60, PY + 60, 40, 0, Math.PI * 2);
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 4;
        ctx.stroke();
    } catch (e) {
        // Fallback jeśli awatar nie zadziała (ciche zignorowanie)
    }

    // Linia oddzielająca
    ctx.beginPath();
    ctx.moveTo(PX + 40, PY + 120);
    ctx.lineTo(PX + PW - 40, PY + 120);
    ctx.strokeStyle = 'rgba(62, 39, 35, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 4. Sekcja 1: Rozgadany Wędrowiec (Zadanie na wiadomości)
    ctx.fillStyle = '#3e2723';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('💬 Rozgadany Wędrowiec', PX + 40, PY + 165);

    // Pasek postępu
    const barX = PX + 40, barY = PY + 185, barW = PW - 80, barH = 26;
    const ratio = Math.min(quest.msgCount / quest.msgGoal, 1);
    
    // Tło paska
    ctx.fillStyle = '#dcd3b6';
    roundRect(ctx, barX, barY, barW, barH, 13);
    ctx.fill();
    
    // Wypełnienie paska
    if (ratio > 0) {
        ctx.save();
        ctx.clip(); // Ograniczamy do zaokrąglonego kształtu
        const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        barGrad.addColorStop(0, '#f1c40f');
        barGrad.addColorStop(1, ratio === 1 ? '#2ecc71' : '#f39c12');
        ctx.fillStyle = barGrad;
        ctx.fillRect(barX, barY, barW * ratio, barH);
        ctx.restore();
    }

    // Ramka paska
    ctx.strokeStyle = '#8b7355';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Tekst na pasku
    ctx.fillStyle = ratio > 0.5 ? '#ffffff' : '#5c4033';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${quest.msgCount} / ${quest.msgGoal} Wiadomości`, barX + barW / 2, barY + 18);

    // 5. Sekcja 2: Poranna Rutyna (Daily)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#3e2723';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('💰 Poranna Rutyna (Zapomoga)', PX + 40, PY + 255);

    ctx.font = 'bold 18px sans-serif';
    if (quest.dailyDone === 1) {
        ctx.fillStyle = '#27ae60';
        ctx.fillText('✅ ZADANIE WYKONANE', PX + 40, PY + 285);
    } else {
        ctx.fillStyle = '#c0392b';
        ctx.fillText('❌ OCZEKUJE (Odbierz wpisując /daily)', PX + 40, PY + 285);
    }

    // 6. Sekcja 3: Nagroda i COMBO
    ctx.fillStyle = 'rgba(62, 39, 35, 0.05)';
    roundRect(ctx, PX + 40, PY + 320, PW - 80, 70, 8);
    ctx.fill();

    ctx.fillStyle = '#3e2723';
    ctx.font = '16px sans-serif';
    ctx.fillText('Przewidywana Nagroda:', PX + 55, PY + 345);

    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = '#d35400';
    ctx.fillText(`${finalReward} 🪙`, PX + 55, PY + 375);

    ctx.textAlign = 'right';
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#5c4033';
    ctx.fillText('Aktywne Eliksiry (COMBO):', PX + PW - 55, PY + 345);
    
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = hasCombo ? '#8e44ad' : '#7f8c8d';
    ctx.fillText(hasCombo ? `Mnożnik x${eco.boostMultiplier} 🔥` : 'Brak', PX + PW - 55, PY + 372);

    // 7. PIECZĘĆ jeśli odebrane
    if (quest.claimed === 1) {
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.rotate(-Math.PI / 8); // Obrót o lekki kąt
        
        ctx.strokeStyle = 'rgba(192, 57, 43, 0.8)'; // Czerwony tusz pieczątki
        ctx.lineWidth = 6;
        ctx.strokeRect(-160, -40, 320, 80);
        
        ctx.fillStyle = 'rgba(192, 57, 43, 0.8)';
        ctx.font = 'bold 46px Courier New, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('WYKONANO', 0, 15);
        
        ctx.restore();
    }

    return canvas.toBuffer('image/png');
}

// ─── Komenda główna ──────────────────────────────────────────────────────────

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tablica')
        .setDescription('Otwórz Graficzną Tablicę Królewskich Zleceń Zakonu Fiflaka'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const today = new Date().toISOString().split('T')[0];

        // Wyświetla botowi "Myśli..." dając czas na wygenerowanie grafiki
        await interaction.deferReply();

        // 1. Pobieranie danych
        let quest = db.prepare('SELECT * FROM quests WHERE userId = ? AND guildId = ?').get(userId, guildId);
        
        // Zabezpieczenie ekonomii
        db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, boostMultiplier, boostExpires, lastDaily) VALUES (?, ?, 0, 1, 0, 0)').run(userId, guildId);
        const eco = db.prepare('SELECT boostMultiplier, boostExpires FROM economy WHERE userId = ? AND guildId = ?').get(userId, guildId);

        if (!quest || quest.lastReset !== today) {
            return interaction.editReply({ 
                content: "📜 **Pusta karta!** Karczmarz nie zdążył jeszcze przypiąć Twoich zleceń na dziś. Napisz cokolwiek na czacie głównym, aby aktywować misje!"
            });
        }

        // 2. Logika COMBO i Nagród
        const baseReward = 1000;
        let finalReward = baseReward;
        let hasCombo = false;

        if (eco.boostExpires > Date.now() && eco.boostMultiplier > 1) {
            finalReward = Math.floor(baseReward * eco.boostMultiplier);
            hasCombo = true;
        }

        const isReady = (quest.msgCount >= quest.msgGoal && quest.dailyDone === 1);

        // 3. Generowanie grafiki Canvas
        const buffer = await drawQuestCanvas(interaction.user, quest, eco, finalReward, hasCombo, isReady);
        const attachment = new AttachmentBuilder(buffer, { name: 'tablica_zlecen.png' });

        // Jeśli już odebrano, wysyłamy tylko obrazek z czerwoną pieczęcią "WYKONANO"
        if (quest.claimed === 1) {
            return interaction.editReply({ 
                content: `> 📜 <@${userId}>, sprawdzasz wywieszone ogłoszenia, ale Twoje zadania na dziś są już sfinalizowane! Wróć jutro.`,
                files: [attachment] 
            });
        }

        // 4. Przygotowanie przycisku dla zadań w trakcie/do odebrania
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('claim_quests')
                .setLabel(hasCombo ? `Odbierz COMBO: ${finalReward} Monet!` : `Odbierz ${finalReward} Monet`)
                .setStyle(hasCombo ? ButtonStyle.Danger : ButtonStyle.Success)
                .setEmoji('💰')
                .setDisabled(!isReady)
        );

        const responseMessage = await interaction.editReply({ 
            content: `> 📜 <@${userId}> spogląda na drewnianą tablicę zleceń Zakonu...`,
            files: [attachment], 
            components: [row] 
        });

        // 5. Obsługa przycisku odbioru nagrody
        const filter = i => i.customId === 'claim_quests' && i.user.id === interaction.user.id;
        const collector = responseMessage.createMessageComponentCollector({ filter, time: 120000 });

        collector.on('collect', async i => {
            // Ponowna weryfikacja na wypadek wygaśnięcia eliksiru podczas oglądania tablicy
            const currentEco = db.prepare('SELECT boostMultiplier, boostExpires FROM economy WHERE userId = ? AND guildId = ?').get(userId, guildId);
            let actualReward = baseReward;
            if (currentEco.boostExpires > Date.now() && currentEco.boostMultiplier > 1) {
                actualReward = Math.floor(baseReward * currentEco.boostMultiplier);
            }

            // Oznaczamy questa jako odebranego i dodajemy monety
            db.prepare('UPDATE quests SET claimed = 1 WHERE userId = ? AND guildId = ?').run(userId, guildId);
            db.prepare('UPDATE economy SET coins = coins + ? WHERE userId = ? AND guildId = ?').run(actualReward, userId, guildId);

            // Epicki Embed Sukcesu po zatwierdzeniu
            const successEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('🎉 Zlecenia Wykonane!')
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .setDescription(`Karczmarz z uśmiechem odhacza zadania i rzuca Ci na stół ciężki worek złota. Odwaliłeś dziś kawał dobrej roboty!`)
                .addFields(
                    { name: '💰 Otrzymane Złoto', value: `**+${actualReward} 🪙**`, inline: true },
                    { name: '🔥 Zastosowane Combo', value: currentEco.boostMultiplier > 1 ? `**x${currentEco.boostMultiplier}**` : 'Brak', inline: true }
                )
                .setFooter({ text: 'Zakon Fiflaka dziękuje za Twoje zasługi. Nowe zlecenia pojawią się o północy!' });

            await i.update({ embeds: [successEmbed], components: [], files: [], content: null });
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && !quest.claimed) {
                // Usuwamy przycisk, jeśli gracz nie zdążył odebrać przez 2 minuty
                interaction.editReply({ components: [] }).catch(() => {});
            }
        });
    }
};
