const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../db.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

class WorkCanvas {
    static async generatePaySlip(username, totalCoins, jobText) {
        const W = 1024, H = 555;
        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext('2d');

        // Wczytywanie tła
        const bgPath = path.join(process.cwd(), 'praca.png');
        const bg = await loadImage(fs.readFileSync(bgPath));
        ctx.drawImage(bg, 0, 0, W, H);

        // Ustawienia tekstu (używamy sans-serif dla polskich znaków)
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 1. Tytuł
        ctx.fillStyle = '#2c2c2c';
        ctx.font = 'bold 40px sans-serif';
        ctx.fillText('OFICJALNY KWIT WYPŁATY', W / 2, 190);

        // 2. Pracownik
        ctx.font = '28px sans-serif';
        ctx.fillText(`Zleceniobiorca: ${username}`, W / 2, 250);

        // 3. Zadanie (z prostym łamaniem tekstu)
        ctx.font = '24px sans-serif';
        const displayJob = jobText.length > 40 ? jobText.substring(0, 37) + '...' : jobText;
        ctx.fillText(`Zadanie: ${displayJob}`, W / 2, 290);

        // 4. Kwota
        ctx.fillStyle = '#b8860b';
        ctx.font = 'bold 70px sans-serif';
        ctx.fillText(`+${totalCoins} ZŁ`, W / 2, 400);

        return new AttachmentBuilder(await canvas.encode('png'), { name: 'payslip.png' });
    }
}

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

        db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, xp) VALUES (?, ?, 0, 0)').run(userId, guildId);
        db.prepare('UPDATE economy SET coins = coins + ?, xp = xp + 10 WHERE userId = ? AND guildId = ?')
          .run(totalPay, userId, guildId);

        try {
            const image = await WorkCanvas.generatePaySlip(interaction.user.username, totalPay, job);
            await interaction.editReply({ files: [image] });
        } catch (e) {
            console.error(e);
            await interaction.editReply("Błąd generowania obrazka.");
        }
    }
};
