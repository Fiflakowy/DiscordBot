const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const db = require('../../db.js');
const { createCanvas } = require('@napi-rs/canvas');

// ==========================================
// 🎨 ZAAWANSOWANY ENGINE CANVAS (PRZYWRÓCONY)
// ==========================================
class WorkCanvas {
    static async generatePaySlip(username, baseCoins, totalCoins, roleMult, jobText) {
        const W = 750, H = 250;
        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext('2d');

        // Tło
        const bgGrad = ctx.createLinearGradient(0, 0, W, H);
        bgGrad.addColorStop(0, '#101018'); 
        bgGrad.addColorStop(1, '#1a1a24');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // Obramowanie
        ctx.strokeStyle = '#D4AF37'; ctx.lineWidth = 2;
        ctx.strokeRect(15, 15, W - 30, H - 30);
        
        // Nagłówek
        ctx.fillStyle = '#D4AF37'; ctx.fillRect(20, 20, W - 40, 45);
        ctx.fillStyle = '#101018'; ctx.font = 'bold 24px serif';
        ctx.fillText('OFICJALNY KWIT WYPŁATY', 35, 52);

        // Dane
        ctx.fillStyle = '#A8A8B8'; ctx.font = 'bold 18px monospace';
        ctx.fillText(`ZLECENIOBIORCA: ${username.toUpperCase()}`, 35, 105);
        ctx.fillText(`ZADANIE: ${jobText.length > 50 ? jobText.substring(0, 47) + '...' : jobText}`, 35, 135);
        
        // Wypłata
        ctx.textAlign = 'right';
        ctx.fillStyle = '#F1C40F'; ctx.font = 'bold 60px sans-serif';
        ctx.fillText(`+${totalCoins}`, 710, 180);
        
        const buffer = await canvas.encode('png');
        return new AttachmentBuilder(buffer, { name: 'payslip.png' });
    }
}

// Funkcja naprawcza bazy
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

        // Logika wypłaty
        const totalPay = Math.floor(Math.random() * 60) + 20;
        
        // Aktualizacja (z uwzględnieniem xp)
        db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, xp) VALUES (?, ?, 0, 0)').run(userId, guildId);
        db.prepare('UPDATE economy SET coins = coins + ?, xp = xp + 10 WHERE userId = ? AND guildId = ?')
          .run(totalPay, userId, guildId);

        // Renderowanie pięknego canvasa
        const image = await WorkCanvas.generatePaySlip(interaction.user.username, 20, totalPay, 1.0, "Rąbanie drewna w lesie");

        await interaction.editReply({
            files: [image]
        });
    }
};
