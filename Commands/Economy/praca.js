const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../db.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

// FUNKCJA NAPRAWCZA - ZAWSZE URUCHAMIANA
function checkDatabase() {
    try {
        const columns = db.prepare("PRAGMA table_info(economy)").all();
        const hasXp = columns.find(c => c.name === 'xp');
        if (!hasXp) {
            db.prepare("ALTER TABLE economy ADD COLUMN xp INTEGER DEFAULT 0").run();
            console.log("✅ Pomyślnie dodano kolumnę 'xp' do bazy.");
        }
    } catch (e) {
        console.error("Błąd przy sprawdzaniu tabeli economy:", e);
    }
}
checkDatabase(); // Uruchamiamy od razu przy wczytaniu pliku

class WorkCanvas {
    static async generatePaySlip(username, totalCoins, jobText) {
        const W = 1024, H = 555;
        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext('2d');

        const bgPath = path.join(process.cwd(), 'praca.png');
        const bg = await loadImage(fs.readFileSync(bgPath));
        ctx.drawImage(bg, 0, 0, W, H);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#2c2c2c';
        ctx.font = 'bold 40px sans-serif';
        ctx.fillText('OFICJALNY KWIT WYPŁATY', W / 2, 190);

        ctx.font = '28px sans-serif';
        ctx.fillText(`Zleceniobiorca: ${username}`, W / 2, 250);

        ctx.font = '24px sans-serif';
        const displayJob = jobText.length > 40 ? jobText.substring(0, 37) + '...' : jobText;
        ctx.fillText(`Zadanie: ${displayJob}`, W / 2, 290);

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

        // Upewnij się, że użytkownik istnieje
        db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, xp) VALUES (?, ?, 0, 0)').run(userId, guildId);
        
        // Teraz ta linia nie powinna wywalać błędu, bo kolumna na pewno istnieje
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
