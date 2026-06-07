const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../db.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

class WorkCanvas {
    static async generatePaySlip(username, totalCoins, jobText) {
        const W = 1024, H = 576; // Wymiary tła
        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext('2d');

        // Wczytywanie tła z głównego folderu
        const bgPath = path.join(process.cwd(), 'praca.png');
        const bg = await loadImage(fs.readFileSync(bgPath));
        ctx.drawImage(bg, 0, 0, W, H);

        // Ustawienia stylu (Kolor "atramentu")
        const inkColor = '#2B1E10'; 
        ctx.fillStyle = inkColor;
        ctx.textBaseline = 'middle';

        // 1. Nagłówek (Wyśrodkowany na pergaminie)
        ctx.textAlign = 'center';
        ctx.font = 'bold 42px Georgia, serif';
        ctx.fillText('OFICJALNY KWIT WYPŁATY', W / 2, 160);

        // 2. Dane pracownika (Wyrównane do lewej, margines 270px)
        ctx.textAlign = 'left';
        ctx.font = '28px Georgia, serif';
        
        ctx.fillText(`Pracownik: ${username}`, 270, 220);
        ctx.fillText(`Zadanie: ${jobText.length > 30 ? jobText.substring(0, 27) + '...' : jobText}`, 270, 265);
        
        const date = new Date().toLocaleDateString('pl-PL');
        ctx.fillText(`Data: ${date}`, 270, 310);

        // 3. Kwota (Wyróżniona na dole)
        ctx.font = 'bold 45px Georgia, serif';
        ctx.fillText(`ZAROBEK: ${totalCoins} ZŁ`, 350, 390);

        return new AttachmentBuilder(await canvas.encode('png'), { name: 'payslip.png' });
    }
}

// Funkcja naprawy bazy
function checkDatabase() {
    try {
        const columns = db.prepare("PRAGMA table_info(economy)").all();
        if (!columns.find(c => c.name === 'xp')) {
            db.prepare("ALTER TABLE economy ADD COLUMN xp INTEGER DEFAULT 0").run();
        }
    } catch (e) { console.error(e); }
}
checkDatabase();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('praca')
        .setDescription('Podejmij się dorywczej pracy w Zakonie.'),

    async execute(interaction) {
        await interaction.deferReply();
        const userId = interaction.user.id;
        const totalPay = Math.floor(Math.random() * 60) + 20;
        const job = "Rąbanie drewna w lesie"; 

        db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, xp) VALUES (?, ?, 0, 0)').run(userId, interaction.guild.id);
        db.prepare('UPDATE economy SET coins = coins + ?, xp = xp + 10 WHERE userId = ? AND guildId = ?')
          .run(totalPay, userId, interaction.guild.id);

        try {
            const image = await WorkCanvas.generatePaySlip(interaction.user.username, totalPay, job);
            await interaction.editReply({ files: [image] });
        } catch (e) {
            console.error(e);
            await interaction.editReply("Wystąpił błąd podczas generowania kwitu.");
        }
    }
};
