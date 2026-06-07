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
            throw new Error('Brak pliku praca.png w folderze głównym projektu!');
        }

        const bg = await loadImage(fs.readFileSync(bgPath));
        ctx.drawImage(bg, 0, 0, W, H);

        // Kolor atramentu
        const inkColor = '#2B1E10';
        ctx.fillStyle = inkColor;
        ctx.textBaseline = 'middle';

        // ====================== NAGŁÓWEK ======================
        ctx.textAlign = 'center';
        ctx.font = 'bold 52px Georgia, serif';
        ctx.fillText('OFICJALNY KWIT WYPŁATY', W / 2, 138);

        // ====================== DANE PRACOWNIKA ======================
        ctx.textAlign = 'left';
        ctx.font = 'bold 29px Georgia, serif';

        const leftX = 255;
        let y = 225;

        ctx.fillText(`Pracownik: ${username}`, leftX, y);
        y += 48;

        const truncatedJob = jobText.length > 42 
            ? jobText.substring(0, 39) + '...' 
            : jobText;
        
        ctx.fillText(`Zadanie: ${truncatedJob}`, leftX, y);
        y += 48;

        const date = new Date().toLocaleDateString('pl-PL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        ctx.fillText(`Data: ${date}`, leftX, y);

        // ====================== KWOTA WYRÓŻNIONA ======================
        ctx.textAlign = 'center';
        ctx.font = 'bold 58px Georgia, serif';
        
        const amount = `ZAROBEK: ${totalCoins} ZŁ`;

        // Cień dla głębi
        ctx.fillStyle = '#1C1408';
        ctx.fillText(amount, W/2 + 3, 395);

        // Główny tekst
        ctx.fillStyle = inkColor;
        ctx.fillText(amount, W/2, 392);

        // Subtelny obrys
        ctx.strokeStyle = '#1C1408';
        ctx.lineWidth = 3;
        ctx.strokeText(amount, W/2, 392);

        return new AttachmentBuilder(await canvas.encode('png'), { 
            name: 'kwit_wyplaty.png' 
        });
    }
}

// Naprawa tabeli economy (dodanie xp jeśli brakuje)
function checkDatabase() {
    try {
        const columns = db.prepare("PRAGMA table_info(economy)").all();
        if (!columns.find(c => c.name === 'xp')) {
            db.prepare("ALTER TABLE economy ADD COLUMN xp INTEGER DEFAULT 0").run();
            console.log('[DB] Dodano kolumnę xp do tabeli economy');
        }
    } catch (e) {
        console.error('[DB] Błąd sprawdzania tabeli:', e);
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

        // Aktualizacja ekonomii
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
            await interaction.editReply("❌ Wystąpił błąd podczas generowania kwitu wypłaty.");
        }
    }
};
