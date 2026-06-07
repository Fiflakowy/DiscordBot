const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../db.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

// Rejestracja czcionki - pamiętaj, że plik jest w głównym folderze, więc zmieniamy ścieżkę
GlobalFonts.registerFromPath(path.join(process.cwd(), 'JetBrainsMono-ExtraBold.ttf'), 'JetBrainsMono');

class WorkCanvas {
    static async generatePaySlip(username, totalCoins, jobText) {
        const W = 1024, H = 555;
        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext('2d');

        // Wczytywanie tła z głównego folderu
        const bgPath = path.join(process.cwd(), 'praca.png');
        const imageBuffer = fs.readFileSync(bgPath);
        const bg = await loadImage(imageBuffer);
        ctx.drawImage(bg, 0, 0, W, H);

        // Stylizacja tekstu
        ctx.textAlign = 'center';
        ctx.fillStyle = '#2c2c2c';

        // Tytuł
        ctx.font = 'bold 40px JetBrainsMono';
        ctx.fillText('OFICJALNY KWIT WYPŁATY', W / 2, 180);

        // Informacje
        ctx.font = '24px JetBrainsMono';
        ctx.fillText(`Zleceniobiorca: ${username}`, W / 2, 230);
        ctx.fillText(`Zadanie: ${jobText}`, W / 2, 270);

        // Kwota (Złoty kolor)
        ctx.fillStyle = '#b8860b';
        ctx.font = 'bold 60px JetBrainsMono';
        ctx.fillText(`+${totalCoins} ZŁ`, W / 2, 380);

        return new AttachmentBuilder(await canvas.encode('png'), { name: 'payslip.png' });
    }
}

// Funkcja naprawy bazy
function ensureDatabaseSchema() {
    try {
        const columns = db.prepare("PRAGMA table_info(economy)").all();
        if (!columns.find(c => c.name === 'xp')) {
            db.prepare("ALTER TABLE economy ADD COLUMN xp INTEGER DEFAULT 0").run();
        }
    } catch (e) { console.error("Błąd bazy:", e); }
}
ensureDatabaseSchema();

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

        // Aktualizacja bazy
        db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, xp) VALUES (?, ?, 0, 0)').run(userId, guildId);
        db.prepare('UPDATE economy SET coins = coins + ?, xp = xp + 10 WHERE userId = ? AND guildId = ?')
          .run(totalPay, userId, guildId);

        // Generowanie grafiki
        try {
            const image = await WorkCanvas.generatePaySlip(interaction.user.username, totalPay, job);
            await interaction.editReply({ files: [image] });
        } catch (error) {
            console.error(error);
            await interaction.editReply("Wystąpił błąd podczas generowania kwitu wypłaty.");
        }
    }
};
