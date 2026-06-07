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

        // Wczytanie tła (pergamin)
        const bgPath = path.join(process.cwd(), 'praca.png');
        if (!fs.existsSync(bgPath)) {
            throw new Error('Brak pliku praca.png w folderze głównym!');
        }
        
        const bg = await loadImage(fs.readFileSync(bgPath));
        ctx.drawImage(bg, 0, 0, W, H);

        // Kolor atramentu
        const inkColor = '#2B1E10';
        ctx.fillStyle = inkColor;
        ctx.textBaseline = 'middle';

        // ====================== NAGŁÓWEK ======================
        ctx.textAlign = 'center';
        ctx.font = 'bold 42px Georgia, serif';
        ctx.fillText('OFICJALNY KWIT WYPŁATY', W / 2, 160);

        // ====================== DANE PRACOWNIKA ======================
        ctx.textAlign = 'left';
        ctx.font = '28px Georgia, serif';

        const startX = 270;
        let startY = 225;

        ctx.fillText(`Pracownik: ${username}`, startX, startY);
        startY += 45;

        // Zadanie (z obcinaniem)
        const truncatedJob = jobText.length > 38 
            ? jobText.substring(0, 35) + '...' 
            : jobText;
        ctx.fillText(`Zadanie: ${truncatedJob}`, startX, startY);
        startY += 45;

        const date = new Date().toLocaleDateString('pl-PL', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
        ctx.fillText(`Data: ${date}`, startX, startY);

        // ====================== KWOTA (WYRÓŻNIONA) ======================
        ctx.textAlign = 'center';
        ctx.font = 'bold 48px Georgia, serif';
        
        const amountText = `ZAROBEK: ${totalCoins} ZŁ`;
        ctx.fillText(amountText, 520, 395);   // X=520, Y=395 jak w wytycznych

        // Opcjonalny delikatny cień pod kwotą (dla lepszego efektu)
        ctx.fillStyle = '#1C120C';
        ctx.fillText(amountText, 522, 397);

        // Przywrócenie koloru głównego
        ctx.fillStyle = inkColor;

        return new AttachmentBuilder(await canvas.encode('png'), { 
            name: 'kwit_wyplaty.png' 
        });
    }
}

// Naprawa bazy (dodanie xp jeśli nie istnieje)
function checkDatabase() {
    try {
        const columns = db.prepare("PRAGMA table_info(economy)").all();
        if (!columns.find(c => c.name === 'xp')) {
            db.prepare("ALTER TABLE economy ADD COLUMN xp INTEGER DEFAULT 0").run();
        }
    } catch (e) {
        console.error('[DB] Błąd przy sprawdzaniu kolumny xp:', e);
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

        // Zapewnienie rekordu w bazie
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
                content: `**Kwit wypłaty gotowy, ${interaction.user}!**`, 
                files: [image] 
            });
        } catch (e) {
            console.error('Błąd generowania kwitu:', e);
            await interaction.editReply("❌ Wystąpił błąd podczas generowania kwitu wypłaty.");
        }
    }
};
