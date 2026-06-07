const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../db.js');
const { createCanvas } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

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
        .addIntegerOption(o => o.setName('liczba').setDescription('Liczba 0-36 (tylko przy zakładzie na liczbę)').setMinValue(0).setMaxValue(36)),

    async execute(interaction) {
        const stake = interaction.options.getInteger('stawka');
        const betType = interaction.options.getString('zaklad');
        const numberInput = interaction.options.getInteger('liczba');

        if (betType === 'number' && numberInput === null) {
            return interaction.reply({ content: '❌ Przy zakładzie na konkretną liczbę musisz podać wartość 0-36.', ephemeral: true });
        }

        const user = db.prepare('SELECT coins FROM economy WHERE userId = ? AND guildId = ?').get(interaction.user.id, interaction.guild.id);
        if (!user || user.coins < stake) {
            return interaction.reply({ content: `❌ Nie masz wystarczająco monet.`, ephemeral: true });
        }

        // Komunikat startowy
        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor('#d4af37')
                .setTitle('🎰 Ruletka Zakonu Fiflaka')
                .setDescription(`**${interaction.user.username}** postawił **${stake} ZŁ** na **${betType.toUpperCase()}**\n\nTrwa losowanie...`)]
        });

        // Losowanie
        const result = Math.floor(Math.random() * 37);
        const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(result);
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

        // Czekamy ~28 sekund
        await new Promise(resolve => setTimeout(resolve, 28000));

        // ==================== RYSOWANIE SIATKI RULETKI ====================
        const canvas = createCanvas(1100, 520);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#0f0f17';
        ctx.fillRect(0, 0, 1100, 520);

        const cellWidth = 58;
        const cellHeight = 52;
        const startX = 80;
        const startY = 80;

        // Nagłówek 0
        ctx.fillStyle = '#1e8c4e';
        ctx.fillRect(startX, startY, cellWidth * 1.5, cellHeight * 3);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 32px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText('0', startX + (cellWidth * 1.5) / 2, startY + cellHeight * 1.5 + 10);

        // Siatka 1-36 (3 kolumny)
        const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

        for (let row = 0; row < 12; row++) {
            for (let col = 0; col < 3; col++) {
                const num = 36 - (row * 3 + col);
                const x = startX + cellWidth * 1.5 + col * cellWidth;
                const y = startY + row * cellHeight;

                const isRedNum = redNumbers.includes(num);
                ctx.fillStyle = isRedNum ? '#c0392b' : '#2c3e50';
                ctx.fillRect(x, y, cellWidth, cellHeight);

                // Wyróżnij zwycięski numer
                if (num === result) {
                    ctx.strokeStyle = '#f1c40f';
                    ctx.lineWidth = 5;
                    ctx.strokeRect(x + 2, y + 2, cellWidth - 4, cellHeight - 4);
                }

                ctx.fillStyle = '#fff';
                ctx.font = num === result ? 'bold 22px Georgia' : 'bold 18px Georgia';
                ctx.textAlign = 'center';
                ctx.fillText(num.toString(), x + cellWidth / 2, y + cellHeight / 2 + 8);
            }
        }

        // Tekst wyniku na dole
        ctx.fillStyle = won ? '#27ae60' : '#e74c3c';
        ctx.font = 'bold 42px Georgia';
        ctx.textAlign = 'center';
        ctx.fillText(won ? `WYGRAŁEŚ ${payout} ZŁ` : 'PRZEGRAŁEŚ...', 550, 480);

        ctx.fillStyle = '#aaa';
        ctx.font = '20px Georgia';
        ctx.fillText(`Zakład: ${stake} ZŁ  •  Typ: ${betType.toUpperCase()}  •  Wynik: ${result}`, 550, 510);

        const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'ruletka.png' });

        // Finalna wiadomość
        await interaction.editReply({
            content: won ? `🎉 Gratulacje <@${interaction.user.id}>!` : `Niestety... <@${interaction.user.id}>`,
            embeds: [],
            files: [attachment]
        });
    }
};
