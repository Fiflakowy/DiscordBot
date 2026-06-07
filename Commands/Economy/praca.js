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

        // Wczytywanie tła z głównego folderu
        const bgPath = path.join(process.cwd(), 'praca.png');
        const bg = await loadImage(fs.readFileSync(bgPath));
        ctx.drawImage(bg, 0, 0, W, H);

        // Ustawienia tekstu
        ctx.textBaseline = 'middle';
        const startX = 260; // Lewy margines pergaminu

        // 1. Tytuł (wyśrodkowany na górze pergaminu)
        ctx.textAlign = 'center';
        ctx.fillStyle = '#2c2c2c';
        ctx.font = 'bold 40px sans-serif';
        ctx.fillText('OFICJALNY KWIT WYPŁATY', W / 2, 170);

        // 2. Dane pracownika (wyrównane do lewej)
        ctx.textAlign = 'left';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText(`Zleceniobiorca: ${username}`, startX, 240);
        
        ctx.font = '24px sans-serif';
        const displayJob = jobText.length > 35 ? jobText.substring(0, 32) + '...' : jobText;
        ctx.fillText(`Zadanie: ${displayJob}`, startX, 285);

        // 3. Kwota (wyrównana do lewej, większa i złota)
        ctx.fillStyle = '#b8860b';
        ctx.font = 'bold 70px sans-serif';
        ctx.fillText(`+${totalCoins} ZŁ`, startX, 380);

        return new AttachmentBuilder(await canvas.encode('png'), { name: 'payslip.png' });
    }
}

// Funkcja naprawy bazy (bezpieczna)
function checkDatabase() {
    try {
        const columns = db.prepare("PRAGMA table_info(economy)").all();
        if (!columns.find(c => c.name === 'xp')) {
            db.prepare("ALTER TABLE economy ADD COLUMN xp INTEGER DEFAULT 0").run();
        }
    } catch (e) { console.error("Błąd bazy:", e); }
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

        db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, xp) VALUES (?, ?, 0, 0)').run(userId, guildId);
        db.prepare('UPDATE economy SET coins = coins + ?, xp = xp + 10 WHERE userId = ? AND guildId = ?')
          .run(totalPay, userId, guildId);

        try {
            const image = await WorkCanvas.generatePaySlip(interaction.user.username, totalPay, job);
            await interaction.editReply({ files: [image] });
        } catch (e) {
            console.error(e);
            await interaction.editReply("Wystąpił błąd podczas generowania obrazka.");
        }
    }
};
