const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../db.js');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

// Rejestracja czcionki
const fontPath = path.join(__dirname, 'JetBrainsMono-ExtraBold.ttf');
if (fs.existsSync(fontPath)) {
    GlobalFonts.registerFromPath(fontPath, 'JetBrainsMono');
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

        // === Poprawne zapytania ===
        // 1. Upewnij się, że rekord istnieje w economy
        db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins) VALUES (?, ?, 0)').run(userId, guildId);

        // 2. Dodaj monety do economy (bez xp!)
        db.prepare('UPDATE economy SET coins = coins + ? WHERE userId = ? AND guildId = ?')
            .run(totalPay, userId, guildId);

        // 3. Dodaj XP do tabeli levels (osobno)
        db.prepare('INSERT OR IGNORE INTO levels (userId, guildId, xp, level) VALUES (?, ?, 0, 0)').run(userId, guildId);
        db.prepare('UPDATE levels SET xp = xp + 10 WHERE userId = ? AND guildId = ?')
            .run(userId, guildId);

        // Generowanie kwitu (Twoja wersja canvas)
        try {
            // ... tutaj wklej cały kod generowania kwitu z poprzedniej wersji ...
            const image = await WorkCanvas.generatePaySlip(interaction.user.username, totalPay, job);

            await interaction.editReply({
                content: `**Kwit wypłaty gotowy, ${interaction.user}!** 🍺`,
                files: [image]
            });
        } catch (e) {
            console.error('Błąd generowania kwitu:', e);
            await interaction.editReply("❌ Błąd podczas generowania kwitu.");
        }
    }
};
