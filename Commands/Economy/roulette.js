const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../db.js');
const { createCanvas } = require('@napi-rs/canvas');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ruletka')
        .setDescription('Profesjonalna ruletka Zakonu Fiflaka')
        .addIntegerOption(o => o.setName('stawka')
            .setDescription('Ilość monet do postawienia')
            .setRequired(true)
            .setMinValue(10))
        .addStringOption(o => o.setName('zaklad')
            .setDescription('Na co chcesz postawić?')
            .setRequired(true)
            .addChoices(
                { name: 'Czerwone (x2)', value: 'red' },
                { name: 'Czarne (x2)', value: 'black' },
                { name: 'Parzyste (x2)', value: 'even' },
                { name: 'Nieparzyste (x2)', value: 'odd' },
                { name: 'Konkretna liczba (x35)', value: 'number' }
            ))
        .addIntegerOption(o => o.setName('liczba')
            .setDescription('Liczba 0-36 (tylko przy zakładzie na liczbę)')
            .setMinValue(0)
            .setMaxValue(36)),

    async execute(interaction) {
        const stake = interaction.options.getInteger('stawka');
        const betType = interaction.options.getString('zaklad');
        const numberInput = interaction.options.getInteger('liczba');

        // Walidacja
        if (betType === 'number' && numberInput === null) {
            return interaction.reply({ 
                content: '❌ Przy zakładzie na konkretną liczbę musisz podać wartość od 0 do 36.', 
                ephemeral: true 
            });
        }

        // Sprawdzenie monet
        const user = db.prepare('SELECT coins FROM economy WHERE userId = ? AND guildId = ?')
            .get(interaction.user.id, interaction.guild.id);

        if (!user || user.coins < stake) {
            return interaction.reply({ 
                content: `❌ Nie masz wystarczająco monet. Potrzebujesz minimum **${stake} ZŁ**.`, 
                ephemeral: true 
            });
        }

        // Komunikat startowy
        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor('#d4af37')
                .setTitle('🎰 Ruletka Zakonu Fiflaka')
                .setDescription(`**${interaction.user.username}** postawił **${stake} ZŁ** na **${betType.toUpperCase()}**\n\nTrwa losowanie...`)]
        });

        // Losowanie wyniku
        const result = Math.floor(Math.random() * 37);
        const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(result);
        const color = result === 0 ? 'green' : (isRed ? 'red' : 'black');

        let won = false;
        let multiplier = 0;

        if (betType === 'red' && color === 'red') { won = true; multiplier = 2; }
        else if (betType === 'black' && color === 'black') { won = true; multiplier = 2; }
        else if (betType === 'even' && result !== 0 && result % 2 === 0) { won = true; multiplier = 2; }
        else if (betType === 'odd' && result % 2 !== 0 && result !== 0) { won = true; multiplier = 2; }
        else if (betType === 'number' && numberInput === result) { won = true; multiplier = 35; }

        const payout = won ? stake * multiplier : 0;

        // Aktualizacja monet
        db.prepare('UPDATE economy SET coins = coins - ? + ? WHERE userId = ? AND guildId = ?')
            .run(stake, payout, interaction.user.id, interaction.guild.id);

        // Czekamy ~28 sekund
        await new Promise(resolve => setTimeout(resolve, 28000));

        // ==================== PROFESJONALNA SIATKA ====================
        const canvas = createCanvas(1050, 620);
        const ctx = canvas.getContext('2d');

        // Tło
        ctx.fillStyle = '#0d0d14';
        ctx.fillRect(0, 0, 1050, 620);

        const cellW = 72;
        const cellH = 55;
        const startX = 200;
        const startY = 85;

        const redColor = '#b71c1c';
        const blackColor = '#1a1a24';
        const greenColor = '#1b5e20';
        const goldColor = '#d4af37';
        const white = '#f5f5f5';

        // === 0 (zielone, wysokie) ===
        ctx.fillStyle = greenColor;
        ctx.fillRect(startX - 95, startY, 90, cellH * 3);
        ctx.strokeStyle = goldColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(startX - 95, startY, 90, cellH * 3);

        ctx.fillStyle = white;
        ctx.font = 'bold 42px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('0', startX - 50, startY + cellH * 1.5 + 14);

        // === Siatka 1-36 ===
        const table = [
            [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
            [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
            [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]
        ];

        for (let col = 0; col < 3; col++) {
            for (let row = 0; row < 12; row++) {
                const num = table[col][row];
                const x = startX + col * cellW;
                const y = startY + row * cellH;

                // Kolor pola
                const isRedNum = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(num);
                ctx.fillStyle = isRedNum ? redColor : blackColor;
                ctx.fillRect(x, y, cellW, cellH);

                // Złota ramka przy wygranym numerze
                if (num === result) {
                    ctx.strokeStyle = goldColor;
                    ctx.lineWidth = 5;
                    ctx.strokeRect(x + 3, y + 3, cellW - 6, cellH - 6);
                } else {
                    ctx.strokeStyle = '#3a3a4a';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x, y, cellW, cellH);
                }

                // Numer
                ctx.fillStyle = white;
                ctx.font = num === result ? 'bold 26px Georgia' : 'bold 22px Georgia';
                ctx.textAlign = 'center';
                ctx.fillText(num.toString(), x + cellW / 2, y + cellH / 2 + 10);
            }
        }

        // === Tekst wyniku ===
        ctx.fillStyle = won ? '#4caf50' : '#e53935';
        ctx.font = 'bold 52px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText(won ? `WYGRAŁEŚ ${payout} ZŁ` : 'PRZEGRAŁEŚ...', 525, 565);

        ctx.fillStyle = '#b0b0b0';
        ctx.font = '22px Georgia';
        ctx.fillText(`Zakład: ${stake} ZŁ   •   Typ: ${betType.toUpperCase()}   •   Wynik: ${result}`, 525, 600);

        const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'ruletka.png' });

        // Finalna wiadomość
        await interaction.editReply({
            content: won 
                ? `🎉 Gratulacje <@${interaction.user.id}>! Wygrałeś **${payout} ZŁ**!` 
                : `Niestety... <@${interaction.user.id}>, przegrałeś **${stake} ZŁ**.`,
            embeds: [],
            files: [attachment]
        });
    }
};
