const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const db = require('../../db.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// Rejestracja czcionki (jeśli używasz JetBrainsMono)
GlobalFonts.registerFromPath(path.join(__dirname, 'JetBrainsMono-ExtraBold.ttf'), 'JetBrainsMono');

class WorkCanvas {
    static async generatePaySlip(username, totalCoins, jobText) {
        // Wymiary Twojego tła
        const W = 1024, H = 555;
        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext('2d');

        // 1. Wczytanie tła "praca.png"
        const bg = await loadImage(path.join(__dirname, 'praca.png'));
        ctx.drawImage(bg, 0, 0, W, H);

        // 2. Ustawienia tekstu
        ctx.textAlign = 'center';
        ctx.fillStyle = '#2c2c2c';

        // Tytuł
        ctx.font = 'bold 40px JetBrainsMono';
        ctx.fillText('OFICJALNY KWIT WYPŁATY', W / 2, 180);

        // Informacje
        ctx.font = '24px JetBrainsMono';
        ctx.fillText(`Zleceniobiorca: ${username}`, W / 2, 230);
        ctx.fillText(`Zadanie: ${jobText}`, W / 2, 270);

        // Kwota
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
        const job = "Rąbanie drewna w lesie"; // Możesz tu dodać losowanie z tablicy

        // Aktualizacja bazy
        db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, xp) VALUES (?, ?, 0, 0)').run(userId, guildId);
        db.prepare('UPDATE economy SET coins = coins + ?, xp = xp + 10 WHERE userId = ? AND guildId = ?')
          .run(totalPay, userId, guildId);

        // Generowanie grafiki
        const image = await WorkCanvas.generatePaySlip(interaction.user.username, totalPay, job);

        await interaction.editReply({
            files: [image]
        });
    }
};
