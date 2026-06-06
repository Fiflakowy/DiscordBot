const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const db = require('../../db.js');
const { createCanvas } = require('@napi-rs/canvas');

// 1. DEFINICJA KLASY CANVAS - Musi być przed użyciem
class WorkCanvas {
    static async generatePaySlip(username, baseCoins, totalCoins, roleMult, jobText) {
        const W = 750, H = 250;
        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext('2d');
        const bgGrad = ctx.createLinearGradient(0, 0, W, H);
        bgGrad.addColorStop(0, '#101018'); 
        bgGrad.addColorStop(1, '#1a1a24');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);
        
        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = 2;
        ctx.strokeRect(15, 15, W - 30, H - 30);
        
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '24px sans-serif';
        ctx.fillText(`Wypłata dla: ${username}`, 35, 100);
        ctx.fillText(`Zarobek: ${totalCoins} monet`, 35, 150);

        const buffer = await canvas.encode('png');
        return new AttachmentBuilder(buffer, { name: 'payslip.png' });
    }
}

// 2. FUNKCJA NAPRAWCZA BAZY
function ensureDatabaseSchema() {
    try {
        const columns = db.prepare("PRAGMA table_info(economy)").all();
        const columnNames = columns.map(c => c.name);
        if (!columnNames.includes('xp')) {
            db.prepare("ALTER TABLE economy ADD COLUMN xp INTEGER DEFAULT 0").run();
        }
    } catch (e) { console.error("Błąd migracji bazy:", e); }
}
ensureDatabaseSchema();

// 3. KONFIGURACJA I EKSPORT
const WORK_CONFIG = { BASE_PAY_MIN: 20, BASE_PAY_MAX: 80, XP_REWARD: 10 };
const workCooldowns = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('praca')
        .setDescription('Podejmij się dorywczej pracy.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        const now = Date.now();
        if (workCooldowns.has(`${guildId}-${userId}`) && now < workCooldowns.get(`${guildId}-${userId}`)) {
            return interaction.reply({ 
                content: `⏳ Musisz odpocząć.`, 
                flags: [MessageFlags.Ephemeral] 
            });
        }

        await interaction.deferReply();

        // Zapis w bazie
        db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, xp) VALUES (?, ?, 0, 0)').run(userId, guildId);
        
        const totalPay = Math.floor(Math.random() * 60) + 20;
        db.prepare('UPDATE economy SET coins = coins + ?, xp = xp + ? WHERE userId = ? AND guildId = ?')
          .run(totalPay, WORK_CONFIG.XP_REWARD, userId, guildId);

        workCooldowns.set(`${guildId}-${userId}`, now + 30000);

        // Użycie WorkCanvas
        const paySlipImage = await WorkCanvas.generatePaySlip(interaction.user.username, 20, totalPay, 1, "Praca wykonana");

        await interaction.editReply({
            content: `Zarobiłeś ${totalPay} monet!`,
            files: [paySlipImage]
        });
    }
};
