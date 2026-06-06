const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../db.js');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// Rejestracja Twojego fonta (zrób to raz przy starcie komendy lub w głównym pliku)
try {
    GlobalFonts.registerFromPath(path.join(__dirname, 'JetBrainsMono-ExtraBold.ttf'), 'JetBrainsMono');
} catch (e) {
    console.error('Nie znaleziono fonta w ścieżce:', e);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ruletka')
        .setDescription('Zagraj w ruletkę w Zakonie')
        .addIntegerOption(o => o.setName('stawka').setDescription('Ile monet stawiasz?').setRequired(true))
        .addStringOption(o => o.setName('zaklad').setDescription('Kolor (czerwony/czarny) lub liczba (0-36)').setRequired(true)),

    async execute(interaction) {
        const stake = interaction.options.getInteger('stawka');
        const bet = interaction.options.getString('zaklad').toLowerCase();
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        const user = db.prepare('SELECT coins FROM economy WHERE userId = ? AND guildId = ?').get(userId, guildId);
        if (!user || user.coins < stake) return interaction.reply({ content: '❌ Nie masz wystarczająco monet.', ephemeral: true });

        const resultNumber = Math.floor(Math.random() * 37);
        const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(resultNumber);
        const resultColor = resultNumber === 0 ? 'zielony' : (isRed ? 'czerwony' : 'czarny');

        let won = false;
        if (bet === 'czerwony' && resultColor === 'czerwony') won = true;
        else if (bet === 'czarny' && resultColor === 'czarny') won = true;
        else if (parseInt(bet) === resultNumber) won = true;

        const payout = won ? (parseInt(bet) === resultNumber ? stake * 35 : stake * 2) : 0;
        
        db.prepare('UPDATE economy SET coins = coins + ? - ? WHERE userId = ? AND guildId = ?').run(payout, stake, userId, guildId);

        // Canvas z Twoim fontem
        const canvas = createCanvas(600, 200);
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#101018';
        ctx.fillRect(0, 0, 600, 200);
        
        ctx.fillStyle = '#D4AF37'; // Złoty
        ctx.font = '40px JetBrainsMono';
        ctx.textAlign = 'center';
        ctx.fillText(`WYNIK: ${resultNumber} (${resultColor})`, 300, 80);
        
        ctx.fillStyle = won ? '#2ECC71' : '#E74C3C';
        ctx.fillText(won ? `WYGRAŁEŚ ${payout} MONET!` : 'PRZEGRAŁEŚ!', 300, 140);

        const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'wynik.png' });
        
        await interaction.reply({
            files: [attachment]
        });
    }
};
