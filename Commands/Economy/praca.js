const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../db.js');
const { createCanvas } = require('@napi-rs/canvas');

// ==========================================
// ⚙️ KONFIGURACJA SYSTEMU PRACY
// ==========================================
const WORK_CONFIG = {
    BASE_PAY_MIN: 20, // Minimalna bazowa wypłata
    BASE_PAY_MAX: 80, // Maksymalna bazowa wypłata
    
    // Mapowanie Ról -> Mnożnik Wypłaty
    ROLE_MULTIPLIERS: {
        '1486888577165037600': 3.0,
        '1476000992351879229': 35.0,
        '1476000459595448442': 2.0,
        '1476000995501670534': 1.5
    },

    // Mini historyjki co gracz robił w pracy
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

// Mapa zapamiętująca cooldown
const workCooldowns = new Map();

// ==========================================
// 🎨 CANVAS ENGINE (NOWY PASEK WYPŁATY)
// ==========================================
class WorkCanvas {
    static async generatePaySlip(username, baseCoins, totalCoins, roleMult, jobText) {
        const W = 750, H = 250;
        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext('2d');

        // 1. Tło - Ciemny pergamin / stal
        const bgGrad = ctx.createLinearGradient(0, 0, W, H);
        bgGrad.addColorStop(0, '#101018'); 
        bgGrad.addColorStop(1, '#1a1a24');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // 2. Znak wodny w tle
        ctx.font = 'bold 130px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.textAlign = 'center';
        ctx.fillText('ZAKON', W / 2, H / 2 + 45);
        ctx.textAlign = 'left'; // Resetujemy wyrównanie

        // 3. Podwójne obramowanie
        ctx.strokeStyle = '#D4AF37'; // Imperialne złoto
        ctx.lineWidth = 2;
        ctx.strokeRect(15, 15, W - 30, H - 30);
        
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(20, 20, W - 40, H - 40);

        // 4. Złoty pasek nagłówka
        ctx.fillStyle = '#D4AF37';
        ctx.fillRect(20, 20, W - 40, 45);
        
        // Tytuł na pasku
        ctx.font = 'bold 24px serif';
        ctx.fillStyle = '#101018'; // Ciemny tekst dla kontrastu
        ctx.fillText('OFICJALNY KWIT WYPŁATY', 35, 52);

        // 5. Dane Pracownika
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = '#A8A8B8';
        ctx.fillText(`ZLECENIOBIORCA:`, 35, 105);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(username.toUpperCase(), 205, 105);

        // 6. Praca Wykonana
        ctx.fillStyle = '#A8A8B8';
        ctx.fillText(`ZADANIE:`, 35, 135);
        
        ctx.font = 'italic 17px serif';
        ctx.fillStyle = '#E0E0E0';
        let job = jobText;
        if (job.length > 55) job = job.substring(0, 52) + '...';
        ctx.fillText(job, 125, 135);

        // 7. Statystyki bazowe (Lewy dół)
        ctx.font = '15px monospace';
        ctx.fillStyle = '#888898';
        if (roleMult > 1) {
            ctx.fillText(`STAWKA BAZOWA: ${baseCoins}  |  PREMIA RANGI: x${roleMult.toFixed(1)}`, 35, 185);
        } else {
            ctx.fillText(`STAWKA BAZOWA: ${baseCoins}`, 35, 185);
        }

        // 8. Całkowita wypłata (Prawa strona)
        ctx.textAlign = 'right';
        ctx.font = '16px monospace';
        ctx.fillStyle = '#A8A8B8';
        ctx.fillText('DO WYPŁATY:', 710, 110);
        
        ctx.font = 'bold 60px sans-serif';
        ctx.fillStyle = '#F1C40F';
        ctx.shadowColor = 'rgba(241, 196, 15, 0.6)';
        ctx.shadowBlur = 20;
        ctx.fillText(`+${totalCoins}`, 670, 180);
        ctx.shadowBlur = 0; // Reset cienia

        // 9. Ręcznie rysowana złota moneta zamiast emoji
        ctx.beginPath();
        ctx.arc(695, 160, 20, 0, Math.PI * 2);
        ctx.fillStyle = '#F1C40F';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#D4AF37';
        ctx.stroke();
        
        // Detal wewnątrz monety
        ctx.beginPath();
        ctx.arc(695, 160, 13, 0, Math.PI * 2);
        ctx.strokeStyle = '#D4AF37';
        ctx.stroke();
        
        ctx.textAlign = 'center';
        ctx.fillStyle = '#D4AF37';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('Z', 695, 166);

        // 10. Pieczęć / Podpis na samym dole
        ctx.textAlign = 'left';
        ctx.font = 'italic 13px serif';
        ctx.fillStyle = 'rgba(212, 175, 55, 0.5)';
        ctx.fillText('Dokument zatwierdzony przez Skarbnika Zakonu.', 35, 220);

        const buffer = await canvas.encode('png');
        return new AttachmentBuilder(buffer, { name: 'payslip.png' });
    }
}

// ==========================================
// 🚀 GŁÓWNA KOMENDA (EXECUTE)
// ==========================================
module.exports = {
    data: new SlashCommandBuilder()
        .setName('praca')
        .setDescription('Podejmij się dorywczej pracy w Zakonie i zarób trochę Złotych Monet.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        const member = interaction.member;

        // 1. Sprawdzenie Cooldownu
        const now = Date.now();
        const cooldownEndTime = workCooldowns.get(`${guildId}-${userId}`);

        if (cooldownEndTime && now < cooldownEndTime) {
            const timeLeft = Math.ceil((cooldownEndTime - now) / 1000);
            const embed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('⏳ Jesteś zbyt zmęczony!')
                .setDescription(`Poprzednia praca mocno wdała Ci się we znaki. Musisz odpocząć.\n\nOdpoczynek potrwa jeszcze: **${timeLeft} sekund** (<t:${Math.floor(cooldownEndTime / 1000)}:R>).`);
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Czekanie (odpowiedź w trakcie generowania Canvasa)
        await interaction.deferReply();

        // 2. Weryfikacja bazy (zabezpieczenie)
        db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, boostMultiplier, boostExpires, lastDaily, xp) VALUES (?, ?, 0, 1, 0, 0, 0)').run(userId, guildId);

        // 3. Wyliczenie Mnożnika TYLKO z Ról
        let roleMultiplier = 1.0;
        for (const [roleId, multValue] of Object.entries(WORK_CONFIG.ROLE_MULTIPLIERS)) {
            if (member.roles.cache.has(roleId)) {
                if (multValue > roleMultiplier) {
                    roleMultiplier = multValue; // Bierzemy największy posiadany mnożnik
                }
            }
        }

        // 4. Kalkulacja Wypłaty (Baza * Ranga)
        const basePay = Math.floor(Math.random() * (WORK_CONFIG.BASE_PAY_MAX - WORK_CONFIG.BASE_PAY_MIN + 1)) + WORK_CONFIG.BASE_PAY_MIN;
        const totalPay = Math.floor(basePay * roleMultiplier);

        // 5. Dynamiczny Cooldown oparty na finalnej kwocie
        let calculatedCDSeconds = Math.max(30, Math.floor(totalPay * 1.5)); // Min 30 sek
        if (calculatedCDSeconds > 300) calculatedCDSeconds = 300; // Max 5 minut (300 sek)

        const expirationTime = now + (calculatedCDSeconds * 1000);
        workCooldowns.set(`${guildId}-${userId}`, expirationTime);

        setTimeout(() => workCooldowns.delete(`${guildId}-${userId}`), calculatedCDSeconds * 1000);

        // 6. Zapis do bazy
        db.prepare('UPDATE economy SET coins = coins + ? WHERE userId = ? AND guildId = ?').run(totalPay, userId, guildId);

        // 7. Generowanie Grafiki i Embedu
        const randomJob = WORK_CONFIG.JOBS[Math.floor(Math.random() * WORK_CONFIG.JOBS.length)];
        const paySlipImage = await WorkCanvas.generatePaySlip(interaction.user.username, basePay, totalPay, roleMultiplier, randomJob);

        const successEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('💼 Dobra robota!')
            .setDescription(`Zakończyłeś swoje zadanie i Karczmarz wypłacił Ci należne złoto.\n\n> *${randomJob}*`)
            .addFields(
                { name: '💰 Zarobiono', value: `**+${totalPay.toLocaleString('pl-PL')} Złotych Monet**`, inline: true },
                { name: '🎖️ Wpływ Rangi', value: `Mnożnik: x${roleMultiplier.toFixed(1)}`, inline: true },
                { name: '🛏️ Odpoczynek', value: `Gotowy do kolejnej pracy <t:${Math.floor(expirationTime / 1000)}:R>`, inline: false }
            )
            .setImage('attachment://payslip.png')
            .setFooter({ text: 'Gildia Rzemieślników i Robotników Zakonu' })
            .setTimestamp();

        // 8. Wysłanie
        await interaction.editReply({
            embeds: [successEmbed],
            files: [paySlipImage]
        });
    }
};