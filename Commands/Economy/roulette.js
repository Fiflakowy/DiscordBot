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
        .setName('ruletka')
        .setDescription('Profesjonalna ruletka Zakonu')
        .addIntegerOption(o => o.setName('stawka').setDescription('Ilość monet').setRequired(true))
        .addStringOption(o => o.setName('zaklad')
            .setDescription('Typ zakładu')
            .setRequired(true)
            .addChoices(
                { name: 'Czerwone (x2)', value: 'red' },
                { name: 'Czarne (x2)', value: 'black' },
                { name: 'Parzyste (x2)', value: 'even' },
                { name: 'Nieparzyste (x2)', value: 'odd' },
                { name: 'Konkretna liczba (x35)', value: 'number' }
            ))
        .addIntegerOption(o => o.setName('liczba').setDescription('Wpisz liczbę 0-36 (tylko przy zakładzie na liczbę)')),

    async execute(interaction) {
        await interaction.deferReply();

        const stake = interaction.options.getInteger('stawka');
        const betType = interaction.options.getString('zaklad');
        const numberInput = interaction.options.getInteger('liczba');

        const user = db.prepare('SELECT coins FROM economy WHERE userId = ? AND guildId = ?')
            .get(interaction.user.id, interaction.guild.id);

        if (!user || user.coins < stake) {
            return interaction.editReply('❌ Nie masz wystarczająco monet.');
        }

        // ==================== MECHANIKA ====================
        const result = Math.floor(Math.random() * 37);
        const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(result);
        const color = result === 0 ? 'green' : (isRed ? 'red' : 'black');

        let won = false;
        let multiplier = 0;

        if (betType === 'red' && color === 'red') { won = true; multiplier = 2; }
        else if (betType === 'black' && color === 'black') { won = true; multiplier = 2; }
        else if (betType === 'even' && result !== 0 && result % 2 === 0) { won = true; multiplier = 2; }
        else if (betType === 'odd' && result % 2 !== 0 && result !== 0) { won = true; multiplier = 2; }
        else if (betType === 'number' && numberInput === result) { won = true; multiplier = 35; }

        const payout = won ? stake * multiplier : 0;

        db.prepare('UPDATE economy SET coins = coins - ? + ? WHERE userId = ? AND guildId = ?')
            .run(stake, payout, interaction.user.id, interaction.guild.id);

        // ==================== RYSOWANIE — WERSJA PREMIUM ====================
        const canvas = createCanvas(950, 580);
        const ctx = canvas.getContext('2d');

        // Tło
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, 950, 580);

        const cx = 475;
        const cy = 290;
        const radius = 195;

        // === Zewnętrzna obręcz ===
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 35, 0, Math.PI * 2);
        ctx.stroke();

        // === Główne koło ===
        ctx.save();
        ctx.translate(cx, cy);

        const numbers = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
        const angleStep = (Math.PI * 2) / numbers.length;

        for (let i = 0; i < numbers.length; i++) {
            const num = numbers[i];
            const startAngle = i * angleStep - Math.PI / 2;

            // Kolor sektora
            let sectorColor = num === 0 ? '#1e8c4e' : 
                [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(num) ? '#c0392b' : '#2c3e50';

            ctx.fillStyle = sectorColor;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, startAngle, startAngle + angleStep);
            ctx.closePath();
            ctx.fill();

            // Wyróżnienie zwycięskiego sektora
            if (num === result) {
                ctx.strokeStyle = '#f1c40f';
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.arc(0, 0, radius - 5, startAngle, startAngle + angleStep);
                ctx.stroke();
            }

            // Numer
            ctx.save();
            ctx.rotate(startAngle + angleStep / 2);
            ctx.fillStyle = '#fff';
            ctx.font = num === result ? 'bold 23px JetBrainsMono' : 'bold 18px JetBrainsMono';
            ctx.textAlign = 'right';
            ctx.fillText(num.toString(), radius - 28, 7);
            ctx.restore();
        }

        ctx.restore();

        // === Wskaźnik (strzałka) ===
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.moveTo(cx, cy - radius - 55);
        ctx.lineTo(cx - 22, cy - radius - 18);
        ctx.lineTo(cx + 22, cy - radius - 18);
        ctx.fill();

        // === Duża liczba w środku ===
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(cx, cy, 72, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(cx, cy, 72, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 78px JetBrainsMono';
        ctx.textAlign = 'center';
        ctx.fillText(result.toString(), cx, cy + 28);

        // === Tekst wyniku ===
        ctx.font = 'bold 36px JetBrainsMono';
        ctx.fillStyle = won ? '#27ae60' : '#e74c3c';
        ctx.fillText(won ? `WYGRAŁEŚ ${payout} ZŁ` : 'PRZEGRAŁEŚ...', cx, 530);

        // === Informacja o zakładzie ===
        ctx.font = '20px JetBrainsMono';
        ctx.fillStyle = '#aaa';
        ctx.fillText(`Zakład: ${stake} ZŁ | Typ: ${betType.toUpperCase()}`, cx, 560);

        const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'ruletka.png' });
        await interaction.editReply({ files: [attachment] });
    }
};
