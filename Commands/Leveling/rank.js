const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const db = require('../../db.js');
const path = require('path');

module.exports = {
    // ==========================================
    // 1. DANE KOMENDY
    // ==========================================
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Sprawdź swoją legendarną kartę profilu w karczmie!')
        .addUserOption(option => 
            option.setName('uzytkownik')
            .setDescription('Sprawdź profil innego bywalca karczmy')
            .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply(); 

        const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;

        if (targetUser.bot) {
            return interaction.editReply({ content: '🤖 Boty piją tylko olej. Nie mają wstępu do naszej karczmy!' });
        }

        try {
            // ==========================================
            // 2. LOGIKA I BAZA DANYCH
            // ==========================================
            const userProfile = db.prepare('SELECT * FROM levels WHERE userId = ? AND guildId = ?').get(targetUser.id, interaction.guild.id);

            if (!userProfile) {
                return interaction.editReply({ 
                    content: `📭 **${targetUser.username}** nie wypił jeszcze z nami ani jednego piwa (brak danych)!`
                });
            }

            const rankPosData = db.prepare('SELECT COUNT(*) as rankPosition FROM levels WHERE guildId = ? AND xp > ?').get(interaction.guild.id, userProfile.xp);
            const rankPosition = rankPosData.rankPosition + 1; 

            const currentLevelXpStart = Math.pow(userProfile.level, 2) * 100; 
            const nextLevelXp = Math.pow(userProfile.level + 1, 2) * 100;     
            
            const xpInCurrentLevel = userProfile.xp - currentLevelXpStart;
            const xpNeededForNext = nextLevelXp - currentLevelXpStart;
            const progressPercent = Math.min(Math.max(xpInCurrentLevel / xpNeededForNext, 0), 1);

            // ==========================================
            // 3. WYGLĄD KARTY - IDEALNE DOPASOWANIE
            // ==========================================
            const style = {
                // Obniżamy lekko awatar, by zrobić miejsce na górze i uniknąć kolizji z nickiem
                avatar: { x: 350, y: 85, radius: 52 },
                textName: { x: 350, y: 178 }, // Nick idealnie pod awatarem
                
                // Pozycje dla tekstów "przytulonych" do awatara
                textLeftX: 275,   // Oś X dla tekstów po lewej (równane do prawej)
                textRightX: 425,  // Oś X dla tekstów po prawej (równane do lewej)
                textTopY: 75,     // Wysokość górnego rzędu tekstów
                textBottomY: 115, // Wysokość dolnego rzędu tekstów
                
                // Kolory z logo
                colorText: '#d8cba8',           
                colorName: '#e4c464',           
                colorShadow: '#0a0a0a',         
                colorBarBg: 'rgba(21, 28, 23, 0.8)', 
                colorBarFill: '#e4c464'         
            };

            const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

            // ==========================================
            // 4. GENERATOR GRAFIKI (CANVAS)
            // ==========================================
            const canvas = createCanvas(700, 200);
            const ctx = canvas.getContext('2d');

            const bgPath = path.join(process.cwd(), 'tlo.jpg');
            const background = await loadImage(bgPath); 
            ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

            // --- AWATAR ---
            ctx.save();
            ctx.beginPath();
            ctx.arc(style.avatar.x, style.avatar.y, style.avatar.radius, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip(); 

            const avatarURL = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
            const avatar = await loadImage(avatarURL);
            
            ctx.drawImage(avatar, style.avatar.x - style.avatar.radius, style.avatar.y - style.avatar.radius, style.avatar.radius * 2, style.avatar.radius * 2);
            ctx.restore(); 

            // --- ZŁOTA RAMKA ---
            ctx.beginPath();
            ctx.arc(style.avatar.x, style.avatar.y, style.avatar.radius, 0, Math.PI * 2, true);
            ctx.lineWidth = 6; 
            ctx.strokeStyle = style.colorName; 
            ctx.stroke();

            // --- TEKSTY I CIENIE ---
            ctx.shadowColor = style.colorShadow;
            ctx.shadowBlur = 8;        
            ctx.shadowOffsetX = 3;     
            ctx.shadowOffsetY = 3;     

            // 1. LEWA STRONA (Miejsce i Poziom)
            ctx.textAlign = 'right'; // Równamy do prawej (w stronę awatara)
            
            ctx.fillStyle = style.colorText;
            ctx.font = 'bold 18px sans-serif';
            ctx.fillText(`MIEJSCE: #${rankPosition}`, style.textLeftX, style.textTopY);
            
            ctx.fillStyle = style.colorName; // Poziom na złoto!
            ctx.font = 'bold 30px sans-serif';
            ctx.fillText(`POZIOM: ${userProfile.level}`, style.textLeftX, style.textBottomY);

            // 2. PRAWA STRONA (XP)
            ctx.textAlign = 'left'; // Równamy do lewej (od awatara na zewnątrz)
            
            ctx.fillStyle = style.colorText;
            ctx.font = 'bold 18px sans-serif';
            ctx.fillText(`DOŚWIADCZENIE`, style.textRightX, style.textTopY);

            ctx.fillStyle = style.colorText;
            ctx.font = 'bold 24px sans-serif';
            ctx.fillText(`${formatNumber(userProfile.xp)} / ${formatNumber(nextLevelXp)}`, style.textRightX, style.textBottomY);

            // 3. NICK GRACZA (Środek dół)
            ctx.textAlign = 'center';
            ctx.font = 'bold 32px sans-serif'; // Zmniejszony z 36px
            ctx.fillStyle = style.colorName; 
            ctx.shadowBlur = 12; 
            ctx.fillText(targetUser.username.toUpperCase(), style.textName.x, style.textName.y);

            // --- PASEK POSTĘPU XP ---
            ctx.shadowBlur = 0; 
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            const barHeight = 8;
            const barY = canvas.height - barHeight;

            ctx.fillStyle = style.colorBarBg;
            ctx.fillRect(0, barY, canvas.width, barHeight);
            
            ctx.fillStyle = style.colorBarFill;
            ctx.fillRect(0, barY, canvas.width * progressPercent, barHeight);

            // ==========================================
            // 5. WYSYŁANIE
            // ==========================================
            const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'karta-karczma.png' });
            await interaction.editReply({ files: [attachment] });

        } catch (error) {
            console.error('❌ [CANVAS ERROR - KARTA RANK]:', error);
            await interaction.editReply({ content: '🔥 Karczmarz rozlał piwo na płótno...' });
        }
    }
};