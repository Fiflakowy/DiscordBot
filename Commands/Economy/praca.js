const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../db.js');
const { createCanvas } = require('@napi-rs/canvas');

const WORK_CONFIG = {
    BASE_PAY_MIN: 20,
    BASE_PAY_MAX: 80,
    XP_REWARD: 10, // Dodano: XP za pracę
    ROLE_MULTIPLIERS: {
        '1486888577165037600': 3.0,
        '1476000992351879229': 5.0,
        '1476000459595448442': 2.0,
        '1476000995501670534': 1.5
    },
    JOBS: [
        "Rąbałeś drwa w lesie na opał do karczmy.",
        "Pomagałeś kowalowi wykuwać podkowy dla straży.",
        "Pilnowałeś wozu kupieckiego na trakcie.",
        "Zamiatałeś rozlane piwo w piwnicy.",
        "Szlifowałeś miecze w zbrojowni Zakonu.",
        "Tropiłeś bestie nękające rolników.",
        "Układałeś księgi w bibliotece gildii."
    ]
};

const workCooldowns = new Map();

// Funkcja naprawcza bazy danych (automatyczne dodanie kolumn)
function ensureDatabaseSchema() {
    const columns = db.prepare("PRAGMA table_info(economy)").all();
    const columnNames = columns.map(c => c.name);
    
    if (!columnNames.includes('xp')) {
        db.prepare("ALTER TABLE economy ADD COLUMN xp INTEGER DEFAULT 0").run();
    }
}
ensureDatabaseSchema();

// ... (Klasa WorkCanvas pozostaje bez zmian) ...

module.exports = {
    data: new SlashCommandBuilder()
        .setName('praca')
        .setDescription('Podejmij się dorywczej pracy w Zakonie.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const member = interaction.member;

        const now = Date.now();
        const cooldownEndTime = workCooldowns.get(`${guildId}-${userId}`);

        if (cooldownEndTime && now < cooldownEndTime) {
            return interaction.reply({ content: `⏳ Odpocznij chwilę! (<t:${Math.floor(cooldownEndTime / 1000)}:R>)`, ephemeral: true });
        }

        await interaction.deferReply();

        // 1. Inicjalizacja użytkownika (bez xp w zapytaniu, bo dodaliśmy go wyżej przez ALTER TABLE)
        db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, boostMultiplier, boostExpires, lastDaily, xp) VALUES (?, ?, 0, 1, 0, 0, 0)').run(userId, guildId);

        // 2. Kalkulacje
        let roleMultiplier = 1.0;
        for (const [roleId, multValue] of Object.entries(WORK_CONFIG.ROLE_MULTIPLIERS)) {
            if (member.roles.cache.has(roleId)) roleMultiplier = Math.max(roleMultiplier, multValue);
        }

        const basePay = Math.floor(Math.random() * (WORK_CONFIG.BASE_PAY_MAX - WORK_CONFIG.BASE_PAY_MIN + 1)) + WORK_CONFIG.BASE_PAY_MIN;
        const totalPay = Math.floor(basePay * roleMultiplier);

        // 3. Aktualizacja bazy (Coins + XP)
        db.prepare('UPDATE economy SET coins = coins + ?, xp = xp + ? WHERE userId = ? AND guildId = ?')
          .run(totalPay, WORK_CONFIG.XP_REWARD, userId, guildId);

        // 4. Cooldown
        const calculatedCD = Math.min(300, Math.max(30, Math.floor(totalPay * 1.5))) * 1000;
        workCooldowns.set(`${guildId}-${userId}`, now + calculatedCD);

        // 5. Grafika i odpowiedź
        const randomJob = WORK_CONFIG.JOBS[Math.floor(Math.random() * WORK_CONFIG.JOBS.length)];
        const paySlipImage = await WorkCanvas.generatePaySlip(interaction.user.username, basePay, totalPay, roleMultiplier, randomJob);

        const successEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('💼 Dobra robota!')
            .setDescription(`Zakończyłeś zadanie: *${randomJob}*`)
            .addFields(
                { name: '💰 Zarobiono', value: `**+${totalPay}** Monet`, inline: true },
                { name: '⭐ Doświadczenie', value: `**+${WORK_CONFIG.XP_REWARD} XP**`, inline: true }
            )
            .setImage('attachment://payslip.png');

        await interaction.editReply({ embeds: [successEmbed], files: [paySlipImage] });
    }
};
