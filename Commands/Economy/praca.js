const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../db.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

// ====================== REJESTRACJA CZCIONKI ======================
const fontPath = path.join(process.cwd(), 'JetBrainsMono-ExtraBold.ttf');
if (fs.existsSync(fontPath)) {
    try {
        GlobalFonts.registerFromPath(fontPath, 'JetBrainsMono');
        console.log('✅ JetBrainsMono-ExtraBold załadowana');
    } catch (err) {
        console.error('❌ Błąd czcionki:', err);
    }
} else {
    console.warn('⚠️ Brak JetBrainsMono-ExtraBold.ttf');
}

// ====================== GENEROWANIE KWITU ======================
class WorkCanvas {
    static async generatePaySlip(username, totalCoins, jobText) {
        const W = 1024;
        const H = 576;
        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext('2d');

        const bgPath = path.join(process.cwd(), 'praca.png');
        if (!fs.existsSync(bgPath)) throw new Error('Brak pliku praca.png');

        const bg = await loadImage(fs.readFileSync(bgPath));
        ctx.drawImage(bg, 0, 0, W, H);

        const inkColor = '#2B1E10';
        ctx.fillStyle = inkColor;
        ctx.textBaseline = 'middle';

        const fontFamily = fs.existsSync(fontPath) ? 'JetBrainsMono' : 'Georgia, serif';

        // ====================== NAGŁÓWEK ======================
        ctx.textAlign = 'center';
        ctx.font = `bold 27px ${fontFamily}`;
        ctx.fillText('OFICJALNY KWIT WYPŁATY', W / 2, 172);

        // ====================== DANE ======================
        ctx.textAlign = 'left';
        ctx.font = `bold 20px ${fontFamily}`;

        const leftX = 275;
        let y = 245;

        ctx.fillText(`Pracownik: ${username}`, leftX, y);
        y += 47;

        const truncatedJob = jobText.length > 50 
            ? jobText.substring(0, 47) + '...' 
            : jobText;
        
        ctx.fillText(`Zadanie: ${truncatedJob}`, leftX, y);
        y += 47;

        const date = new Date().toLocaleDateString('pl-PL', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        ctx.fillText(`Data: ${date}`, leftX, y);

        // ====================== KWOTA ======================
        ctx.textAlign = 'center';
        ctx.font = `bold 34px ${fontFamily}`;
        
        const amount = `ZAROBEK: ${totalCoins} ZŁ`;

        // Cień
        ctx.fillStyle = '#1C1408';
        ctx.fillText(amount, W/2 + 3, 418);

        // Główny tekst
        ctx.fillStyle = inkColor;
        ctx.fillText(amount, W/2, 414);

        // Obrys
        ctx.strokeStyle = '#1C1408';
        ctx.lineWidth = 3;
        ctx.strokeText(amount, W/2, 414);

        return new AttachmentBuilder(await canvas.encode('png'), { 
            name: 'kwit_wyplaty.png' 
        });
    }
}

// ====================== BAZA ======================
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
