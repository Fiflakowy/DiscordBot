const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../db.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

// ==========================================
// ⚙️ KONFIGURACJA SYSTEMU AKTYWNOŚCI
// ==========================================
const CONFIG = {
    LEVEL_UP_CHANNEL_ID: '1503163821324501022', // Kanał chwały i awansów
    COOLDOWN_MS: 60000, // 60 sekund między nagrodami
    XP_RANGE: [15, 25], // Min i Max XP za wiadomość
    COIN_RANGE: [1, 3], // Min i Max Monet za wiadomość
    BOOSTER_BONUS: 1.2, // +20% więcej dla Server Boosterów (Nitro)
    
    // System Nagród - Rangi automatyczne za poziomy
    // Format: Poziom: 'ID_ROLI'
    ROLE_REWARDS: {
        5: '1476000458987278397',
        15: '1476000995501670534',
        30: '1476000459595448442'
    }
};

const cooldowns = new Set();

// ==========================================
// 🎨 CANVAS ENGINE (BANER AWANSU)
// ==========================================
class LevelUpCanvas {
    static async generate(user, newLevel, coinReward) {
        const W = 700, H = 200;
        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext('2d');

        // Tło
        const bgGrad = ctx.createLinearGradient(0, 0, W, H);
        bgGrad.addColorStop(0, '#1a1005');
        bgGrad.addColorStop(1, '#2b1a0a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // Dekory i siatka
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.1)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        // Imperialne paski
        ctx.fillStyle = '#D4AF37';
        ctx.fillRect(0, 0, W, 5);
        ctx.fillRect(0, H - 5, W, 5);

        // Avatar
        const aSize = 120, aX = 40, aY = 40;
        ctx.save();
        ctx.beginPath();
        ctx.arc(aX + aSize / 2, aY + aSize / 2, aSize / 2, 0, Math.PI * 2);
        ctx.clip();
        
        try {
            const avatarImg = await loadImage(user.displayAvatarURL({ extension: 'png', size: 256 }));
            ctx.drawImage(avatarImg, aX, aY, aSize, aSize);
        } catch (e) {
            ctx.fillStyle = '#333';
            ctx.fillRect(aX, aY, aSize, aSize);
        }
        ctx.restore();

        // Ramka Avatara
        ctx.beginPath();
        ctx.arc(aX + aSize / 2, aY + aSize / 2, aSize / 2, 0, Math.PI * 2);
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#D4AF37';
        ctx.stroke();

        // Teksty
        ctx.font = 'bold 45px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(212, 175, 55, 0.8)';
        ctx.shadowBlur = 15;
        ctx.fillText('LEVEL UP!', 190, 80);
        ctx.shadowBlur = 0;

        ctx.font = 'bold 28px sans-serif';
        ctx.fillStyle = '#D4AF37';
        ctx.fillText(`OSIĄGNIĘTO POZIOM ${newLevel}`, 190, 125);

        ctx.font = '20px monospace';
        ctx.fillStyle = '#A8A8A8';
        ctx.fillText(`Nagroda od Karczmarza: +${coinReward} Monet`, 190, 160);

        const buffer = await canvas.encode('png');
        return new AttachmentBuilder(buffer, { name: 'levelup.png' });
    }
}

// ==========================================
// 🛠️ BAZA DANYCH & LOGIKA (ENGINE)
// ==========================================
class ExperienceManager {
    static initDB() {
        // Zabezpieczenie przed brakiem tabel i kolumn
        db.prepare('CREATE TABLE IF NOT EXISTS economy (userId TEXT, guildId TEXT, coins INTEGER, boostMultiplier REAL, boostExpires INTEGER, lastDaily INTEGER, xp INTEGER, PRIMARY KEY (userId, guildId))').run();
        db.prepare('CREATE TABLE IF NOT EXISTS levels (userId TEXT, guildId TEXT, xp INTEGER, level INTEGER, PRIMARY KEY (userId, guildId))').run();
    }

    static processRewards(member) {
        const userId = member.user.id;
        const guildId = member.guild.id;
        const now = Date.now();

        // Ustawienia początkowe
        db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, boostMultiplier, boostExpires, lastDaily, xp) VALUES (?, ?, 0, 1, 0, 0, 0)').run(userId, guildId);
        db.prepare('INSERT OR IGNORE INTO levels (userId, guildId, xp, level) VALUES (?, ?, 0, 0)').run(userId, guildId);

        // Bazowe wartości
        let gainedXP = Math.floor(Math.random() * (CONFIG.XP_RANGE[1] - CONFIG.XP_RANGE[0] + 1)) + CONFIG.XP_RANGE[0];
        let gainedCoins = Math.floor(Math.random() * (CONFIG.COIN_RANGE[1] - CONFIG.COIN_RANGE[0] + 1)) + CONFIG.COIN_RANGE[0];

        // Mnożniki (Sklep)
        const userEco = db.prepare('SELECT boostMultiplier, boostExpires FROM economy WHERE userId = ? AND guildId = ?').get(userId, guildId);
        let multiplier = 1;

        if (userEco.boostExpires > now) {
            multiplier = userEco.boostMultiplier;
        } else if (userEco.boostMultiplier > 1) {
            db.prepare('UPDATE economy SET boostMultiplier = 1, boostExpires = 0 WHERE userId = ? AND guildId = ?').run(userId, guildId);
        }

        // Bonus za Server Boost (Nitro)
        if (member.premiumSince) {
            multiplier *= CONFIG.BOOSTER_BONUS;
        }

        // Finalna kalkulacja
        const finalXP = Math.floor(gainedXP * multiplier);
        const finalCoins = Math.floor(gainedCoins * multiplier);

        // Zapis do bazy
        db.prepare('UPDATE economy SET coins = coins + ?, xp = COALESCE(xp, 0) + ? WHERE userId = ? AND guildId = ?').run(finalCoins, finalXP, userId, guildId);
        db.prepare('UPDATE levels SET xp = xp + ? WHERE userId = ? AND guildId = ?').run(finalXP, userId, guildId);

        return this.checkLevelUp(member, guildId);
    }

    static checkLevelUp(member, guildId) {
        const userId = member.user.id;
        const userProfile = db.prepare('SELECT xp, level FROM levels WHERE userId = ? AND guildId = ?').get(userId, guildId);
        
        let currentLevel = userProfile.level;
        let currentXP = userProfile.xp;
        let leveledUp = false;
        let totalReward = 0;

        // Formuła wymagająca coraz więcej XP
        let xpNeeded = (currentLevel + 1) * (currentLevel + 1) * 100;

        while (currentXP >= xpNeeded) {
            currentLevel++;
            leveledUp = true;
            totalReward += currentLevel * 50; // Nagroda za każdy przeskoczony poziom
            xpNeeded = (currentLevel + 1) * (currentLevel + 1) * 100; 
        }

        if (leveledUp) {
            db.prepare('UPDATE levels SET level = ? WHERE userId = ? AND guildId = ?').run(currentLevel, userId, guildId);
            db.prepare('UPDATE economy SET coins = coins + ? WHERE userId = ? AND guildId = ?').run(totalReward, userId, guildId);
            return { leveledUp: true, newLevel: currentLevel, reward: totalReward, xpNeeded };
        }

        return { leveledUp: false };
    }

    static async applyRoleRewards(member, newLevel) {
        const roleId = CONFIG.ROLE_REWARDS[newLevel];
        if (roleId) {
            try {
                const role = member.guild.roles.cache.get(roleId);
                if (role) await member.roles.add(role);
                return role.name;
            } catch (err) {
                console.error(`[XP SYSTEM] Nie udało się nadać roli za poziom ${newLevel}:`, err);
            }
        }
        return null;
    }
}

// ==========================================
// 🚀 GŁÓWNY MODUŁ ZDARZENIA
// ==========================================
module.exports = (client) => {
    ExperienceManager.initDB();

    client.on('messageCreate', async (message) => {
        // Ignoruj boty, wiadomości z DM i puste
        if (!message.guild || message.author.bot || message.content.length < 2) return;

        const cooldownKey = `${message.guild.id}-${message.author.id}`;
        if (cooldowns.has(cooldownKey)) return;

        try {
            // Przetwarzanie nagród i sprawdzenie awansu
            const result = ExperienceManager.processRewards(message.member);

            if (result.leveledUp) {
                const levelUpChannel = message.guild.channels.cache.get(CONFIG.LEVEL_UP_CHANNEL_ID);
                
                if (levelUpChannel) {
                    // Sprawdzanie, czy odblokowano rangę
                    const rewardedRoleName = await ExperienceManager.applyRoleRewards(message.member, result.newLevel);
                    
                    // Generowanie obrazu Canvas
                    const canvasImage = await LevelUpCanvas.generate(message.author, result.newLevel, result.reward);

                    // Budowa Embedu
                    const embed = new EmbedBuilder()
                        .setColor('#D4AF37') // Imperialne złoto
                        .setTitle('🎉 Awans w Hierarchii Zakonu!')
                        .setDescription(`Chwała i cześć! Wędrowiec <@${message.author.id}> ciężko trenował na kanałach i osiągnął **${result.newLevel} poziom**!`)
                        .addFields(
                            { name: '💰 Nagroda', value: `W Twoje ręce wpada **${result.reward} monet**!`, inline: true },
                            { name: '📈 Następny cel', value: `Wymaga **${result.xpNeeded} XP**`, inline: true }
                        )
                        .setImage('attachment://levelup.png')
                        .setFooter({ text: 'Zakon Fiflaka rośnie w siłę!', iconURL: message.guild.iconURL({ dynamic: true }) })
                        .setTimestamp();

                    if (rewardedRoleName) {
                        embed.addFields({ name: '🎖️ Nowa Ranga', value: `Odblokowano tytuł: **${rewardedRoleName}**!`, inline: false });
                    }

                    await levelUpChannel.send({ 
                        content: `Gratulacje, <@${message.author.id}>! 🍻`, 
                        embeds: [embed],
                        files: [canvasImage]
                    });
                }
            }

            // Aplikowanie Cooldownu
            cooldowns.add(cooldownKey);
            setTimeout(() => cooldowns.delete(cooldownKey), CONFIG.COOLDOWN_MS);

        } catch (error) {
            console.error('❌ [SYSTEM XP & ECO] Błąd krytyczny przy wiadomości:', error);
        }
    });

    console.log('📈 [SYSTEM] Enterprise XP, Ekonomia i Awanse załadowane!');
};