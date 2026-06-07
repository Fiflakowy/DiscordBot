const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../db.js');
const { createCanvas } = require('@napi-rs/canvas');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ruletka')
        .setDescription('Profesjonalna ruletka Zakonu Fiflaka')
        .addIntegerOption(o => o.setName('stawka').setDescription('Ilość monet').setRequired(true).setMinValue(10))
        .addStringOption(o => o.setName('zaklad')
            .setDescription('Na co stawiasz?')
            .setRequired(true)
            .addChoices(
                { name: '🔴 Czerwone (x2)', value: 'red' },
                { name: '⚫ Czarne (x2)', value: 'black' },
                { name: 'Parzyste (x2)', value: 'even' },
                { name: 'Nieparzyste (x2)', value: 'odd' },
                { name: '🎯 Konkretna liczba (x35)', value: 'number' }
            ))
        .addIntegerOption(o => o.setName('liczba').setDescription('Liczba 0-36').setMinValue(0).setMaxValue(36)),

    async execute(interaction) {
        const stake = interaction.options.getInteger('stawka');
        const betType = interaction.options.getString('zaklad');
        const numberInput = interaction.options.getInteger('liczba');

        if (betType === 'number' && numberInput === null) {
            return interaction.reply({ content: '❌ Podaj liczbę od 0 do 36.', ephemeral: true });
        }

        const user = db.prepare('SELECT coins FROM economy WHERE userId = ? AND guildId = ?').get(interaction.user.id, interaction.guild.id);
        if (!user || user.coins < stake) {
            return interaction.reply({ content: '❌ Nie masz wystarczająco monet.', ephemeral: true });
        }

        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor('#d4af37')
                .setTitle('🎰 Ruletka się kręci...')
                .setDescription(`**${interaction.user.username}** postawił **${stake} ZŁ** na **${betType.toUpperCase()}**`)]
        });

        // Losowanie
        const result = Math.floor(Math.random() * 37);
        const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(result);
        const color = result === 0 ? 'green' : (isRed ? 'red' : 'black');

        let won = false, multiplier = 0;
        if (betType === 'red' && color === 'red') { won = true; multiplier = 2; }
        else if (betType === 'black' && color === 'black') { won = true; multiplier = 2; }
        else if (betType === 'even' && result !== 0 && result % 2 === 0) { won = true; multiplier = 2; }
        else if (betType === 'odd' && result % 2 !== 0 && result !== 0) { won = true; multiplier = 2; }
        else if (betType === 'number' && numberInput === result) { won = true; multiplier = 35; }

        const payout = won ? stake * multiplier : 0;

        db.prepare('UPDATE economy SET coins = coins - ? + ? WHERE userId = ? AND guildId = ?')
            .run(stake, payout, interaction.user.id, interaction.guild.id);

        await new Promise(resolve => setTimeout(resolve, 28000));

        // ==================== POPRAWNA SIATKA RULETKI ====================
        const canvas = createCanvas(1150, 580);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#0f0f17';
        ctx.fillRect(0, 0, 1150, 580);

        const cellW = 62;
        const cellH = 55;
        const startX = 120;
        const startY = 90;

        // Kolory
        const red = '#c0392b';
        const black = '#2c3e50';
        const green = '#1e8c4e';
        const gold = '#f1c40f';

        // === 0 (zielone, duże) ===
        ctx.fillStyle = green;
        ctx.fillRect(startX, startY, cellW * 1.3, cellH * 3);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('0', startX + (cellW * 1.3) / 2, startY + cellH * 1.5 + 12);

        // === Siatka 1-36 (poprawna kolejność) ===
        // European Roulette Table layout (od góry do dołu)
        const table = [
            [3,  6,  9,  12, 15, 18, 21, 24, 27, 30, 33, 36],
            [2,  5,  8,  11, 14, 17, 20, 23, 26, 29, 32, 35],
            [1,  4,  7,  10, 13, 16, 19, 22, 25, 28, 31, 34]
        ];

        for (let col = 0; col < 3; col++) {
            for (let row = 0; row < 12; row++) {
                const num = table[col][row];
                const x = startX + cellW * 1.3 + col * cellW;
                const y = startY + row * cellH;

                const isRedNum = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(num);
                ctx.fillStyle = isRedNum ? red : black;
                ctx.fillRect(x, y, cellW, cellH);

                // Wyróżnij zwycięski numer
                if (num === result) {
                    ctx.strokeStyle = gold;
                    ctx.lineWidth = 5;
                    ctx.strokeRect(x + 3, y + 3, cellW - 6, cellH - 6);
                }

                ctx.fillStyle = '#fff';
                ctx.font = num === result ? 'bold 24px Georgia' : 'bold 20px Georgia';
                ctx.textAlign = 'center';
                ctx.fillText(num.toString(), x + cellW / 2, y + cellH / 2 + 9);
            }
        }

        // Tekst wyniku
        ctx.fillStyle = won ? '#27ae60' : '#e74c3c';
        ctx.font = 'bold 44px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText(won ? `WYGRAŁEŚ ${payout} ZŁ` : 'PRZEGRAŁEŚ...', 575, 530);

        ctx.fillStyle = '#aaa';
        ctx.font = '22px Georgia';
        ctx.fillText(`Zakład: ${stake} ZŁ  •  Typ: ${betType.toUpperCase()}  •  Wynik: ${result}`, 575, 565);

        const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'ruletka.png' });

        await interaction.editReply({
            content: won ? `🎉 Gratulacje <@${interaction.user.id}>!` : `Niestety... <@${interaction.user.id}>`,
            embeds: [],
            files: [attachment]
        });
    }
};
