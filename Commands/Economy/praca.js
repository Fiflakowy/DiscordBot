const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../db.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

class WorkCanvas {
    static async generatePaySlip(username, totalCoins, jobText) {
        const W = 1024;
        const H = 576;
        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext('2d');

        // Wczytanie tła
        const bgPath = path.join(process.cwd(), 'praca.png');
        if (!fs.existsSync(bgPath)) {
            throw new Error('Brak pliku praca.png w folderze głównym!');
        }

        const bg = await loadImage(fs.readFileSync(bgPath));
        ctx.drawImage(bg, 0, 0, W, H);

        const inkColor = '#2B1E10';
        ctx.fillStyle = inkColor;
        ctx.textBaseline = 'middle';

        // ====================== NAGŁÓWEK ======================
        ctx.textAlign = 'center';
        ctx.font = 'bold 48px Georgia, serif';
        ctx.fillText('OFICJALNY KWIT WYPŁATY', W / 2, 170);

        // ====================== DANE (etykiety + wartości) ======================
        ctx.textAlign = 'left';
        ctx.font = 'bold 29px Georgia, serif';

        const labelX = 270;
        const valueX = 425;        // zgodnie z Twoją sugestią
        let y = 235;

        // Pracownik
        ctx.fillText('Pracownik:', labelX, y);
        ctx.fillText(username, valueX, y);
        y += 48;

        // Zadanie
        const truncatedJob = jobText.length > 46 
            ? jobText.substring(0, 43) + '...' 
            : jobText;
        
        ctx.fillText('Zadanie:', labelX, y);
        ctx.fillText(truncatedJob, valueX, y);
        y += 48;

        // Data
        const date = new Date().toLocaleDateString('pl-PL', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        ctx.fillText('Data:', labelX, y);
        ctx.fillText(date, valueX, y);

        // ====================== KWOTA ======================
        ctx.textAlign = 'center';
        ctx.font = 'bold 58px Georgia, serif';
        
        const amount = `ZAROBEK: ${totalCoins} ZŁ`;

        // Cień
        ctx.fillStyle = '#1C1408';
        ctx.fillText(amount, W/2 + 4, 415);

        // Główny tekst
        ctx.fillStyle = inkColor;
        ctx.fillText(amount, W/2, 411);

        // Obrys dla lepszej widoczności
        ctx.strokeStyle = '#1C1408';
        ctx.lineWidth = 3.5;
        ctx.strokeText(amount, W/2, 411);

        return new AttachmentBuilder(await canvas.encode('png'), { 
            name: 'kwit_wyplaty.png' 
        });
    }
}

// Sprawdzenie bazy
function checkDatabase() {
    try {
        const columns = db.prepare("PRAGMA table_info(economy)").all();
        if (!columns.find(c => c.name === 'xp')) {
            db.prepare("ALTER TABLE economy ADD COLUMN xp INTEGER DEFAULT 0").run();
            console.log('[DB] Dodano kolumnę xp');
        }
    } catch (e) {
        console.error('[DB] Błąd:', e);
    }
}
checkDatabase();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('praca')
        .setDescription('Podejmij się dorywczej pracy w Zakonie.'),

    async execute(interaction) {
        await interaction.deferReply();

        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        const totalPay = Math.floor(Math.random() * 60) + 20;
        const job = "Rąbanie drewna w lesie";

        db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, xp) VALUES (?, ?, 0, 0)')
          .run(userId, guildId);

        db.prepare('UPDATE economy SET coins = coins + ?, xp = xp + 10 WHERE userId = ? AND guildId = ?')
          .run(totalPay, userId, guildId);

        try {
            const image = await WorkCanvas.generatePaySlip(
                interaction.user.username, 
                totalPay, 
                job
            );

            await interaction.editReply({ 
                content: `**Kwit wypłaty gotowy, ${interaction.user}!** 🍺`, 
                files: [image] 
            });
        } catch (e) {
            console.error('Błąd generowania kwitu:', e);
            await interaction.editReply("❌ Wystąpił błąd podczas generowania kwitu.");
        }
    }
};
