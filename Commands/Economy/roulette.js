const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../db.js');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// Rejestracja fonta
GlobalFonts.registerFromPath(path.join(__dirname, 'JetBrainsMono-ExtraBold.ttf'), 'JetBrainsMono');

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
        .addIntegerOption(o => o.setName('liczba').setDescription('Wpisz liczbę 0-36 (tylko jeśli wybrałeś typ zakładu: Liczba)')),

    async execute(interaction) {
        await interaction.deferReply();
        const stake = interaction.options.getInteger('stawka');
        const betType = interaction.options.getString('zaklad');
        const numberInput = interaction.options.getInteger('liczba');
        
        const user = db.prepare('SELECT coins FROM economy WHERE userId = ? AND guildId = ?').get(interaction.user.id, interaction.guild.id);
        if (!user || user.coins < stake) return interaction.editReply('❌ Nie masz wystarczająco monet.');

        // Mechanika ruletki
        const result = Math.floor(Math.random() * 37); // 0-36
        const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(result);
        const color = result === 0 ? 'green' : (isRed ? 'red' : 'black');

        let won = false;
        let multiplier = 0;

        if (betType === 'red' && color === 'red') { won = true; multiplier = 2; }
        else if (betType === 'black' && color === 'black') { won = true; multiplier = 2; }
        else if (betType === 'even' && result !== 0 && result % 2 === 0) { won = true; multiplier = 2; }
        else if (betType === 'odd' && result % 2 !== 0) { won = true; multiplier = 2; }
        else if (betType === 'number' && numberInput === result) { won = true; multiplier = 35; }

        const payout = won ? stake * multiplier : 0;
        db.prepare('UPDATE economy SET coins = coins + ? - ? WHERE userId = ? AND guildId = ?').run(payout, stake, interaction.user.id, interaction.guild.id);

        // Wizualizacja Canvas
        const canvas = createCanvas(800, 400);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#101018'; ctx.fillRect(0, 0, 800, 400);
        
        // Stylizacja
        ctx.fillStyle = color === 'red' ? '#E74C3C' : (color === 'black' ? '#2F3640' : '#27AE60');
        ctx.beginPath(); ctx.arc(400, 200, 100, 0, Math.PI * 2); ctx.fill();
        
        ctx.fillStyle = '#FFFFFF'; ctx.font = '80px JetBrainsMono';
        ctx.textAlign = 'center'; ctx.fillText(result.toString(), 400, 230);
        
        ctx.font = '30px JetBrainsMono';
        ctx.fillText(won ? `WYGRAŁEŚ ${payout}!` : 'PRZEGRAŁEŚ...', 400, 350);

        const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'ruletka.png' });
        await interaction.editReply({ files: [attachment] });
    }
};
