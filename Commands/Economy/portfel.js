const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../db.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

// ─────────────────────────────────────────────
// 📊 1. SYSTEM POZIOMÓW (RPG LOGIC)
// ─────────────────────────────────────────────
class LevelSystem {
    static getLevelData(xp) {
        const currentXP = xp || 0;
        // Prosta formuła: Level = pierwiastek z XP * 0.1 (Zmieniaj do woli)
        // Lvl 1 = 0 XP, Lvl 2 = 100 XP, Lvl 3 = 400 XP, Lvl 4 = 900 XP...
        const level = Math.floor(Math.sqrt(currentXP) * 0.1) + 1;
        const xpForCurrentLevel = Math.pow((level - 1) * 10, 2);
        const xpForNextLevel = Math.pow(level * 10, 2);
        const xpInCurrentLevel = currentXP - xpForCurrentLevel;
        const xpNeeded = xpForNextLevel - xpForCurrentLevel;
        const progress = Math.min(Math.max(xpInCurrentLevel / xpNeeded, 0), 1); // 0.0 do 1.0

        return { level, currentXP, xpForNextLevel, progress };
    }
}

// ─────────────────────────────────────────────
// 🛠️ 2. BAZA DANYCH (DATA MANAGER & AUTO-FIX)
// ─────────────────────────────────────────────
class ProfileDatabase {
    static init(userId, guildId) {
        // --- AUTOMATYCZNA AKTUALIZACJA BAZY DANYCH ---
        // Próbujemy dodać kolumnę 'xp'. Jeśli już istnieje, kod po prostu to zignoruje.
        try {
            db.prepare('ALTER TABLE economy ADD COLUMN xp INTEGER DEFAULT 0').run();
            console.log('✅ [Baza Danych] Pomyślnie zaktualizowano tabelę economy o kolumnę XP!');
        } catch (err) {
            // Kolumna istnieje, błąd ignorowany
        }
        // ----------------------------------------------

        db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, boostMultiplier, boostExpires, lastDaily, xp) VALUES (?, ?, 0, 1, 0, 0, 0)').run(userId, guildId);
        db.prepare('INSERT OR IGNORE INTO warnings (userId, guildId, warnCount) VALUES (?, ?, 0)').run(userId, guildId);
    }

    static getFullProfile(userId, guildId) {
        const eco = db.prepare('SELECT * FROM economy WHERE userId = ? AND guildId = ?').get(userId, guildId);
        const warn = db.prepare('SELECT warnCount FROM warnings WHERE userId = ? AND guildId = ?').get(userId, guildId);
        
        // Wyliczanie miejsca w rankingu na serwerze (kto ma więcej monet)
        const rankObj = db.prepare('SELECT COUNT(*) as rank FROM economy WHERE guildId = ? AND coins > ?').get(guildId, eco.coins);
        
        return {
            coins: eco.coins,
            xp: eco.xp || 0,
            boostMult: eco.boostMultiplier,
            boostExp: eco.boostExpires,
            warns: warn ? warn.warnCount : 0,
            serverRank: rankObj.rank + 1
        };
    }
}

// ─────────────────────────────────────────────
// 🎨 3. CANVAS ENGINE (KARTA POSTACI)
// ─────────────────────────────────────────────
class ProfileCanvas {
    static async generateCard(user, profileData, levelData) {
        const W = 800;
        const H = 250;
        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext('2d');

        // --- TŁO ---
        const bgGrad = ctx.createLinearGradient(0, 0, W, H);
        bgGrad.addColorStop(0, '#11111a');
        bgGrad.addColorStop(1, '#1a1a2e');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // Dekory
        ctx.strokeStyle = 'rgba(241, 196, 15, 0.15)'; // Złotawe linie
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, W - 20, H - 20);
        
        ctx.beginPath();
        ctx.moveTo(220, 75);
        ctx.lineTo(750, 75);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.stroke();

        // --- AVATAR (Z kołowym maskowaniem) ---
        const avatarSize = 140;
        const avatarX = 40;
        const avatarY = (H - avatarSize) / 2 - 10;

        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        
        try {
            // Pobieramy avatar z Discorda w formacie PNG
            const avatarImg = await loadImage(user.displayAvatarURL({ extension: 'png', size: 256 }));
            ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
        } catch (e) {
            console.error('[Canvas] Nie udało się załadować avatara:', e);
            ctx.fillStyle = '#2c2f33';
            ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
        }
        ctx.restore();

        // Obramowanie avatara
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#F1C40F';
        ctx.stroke();

        // --- TEKST ---
        // Nazwa użytkownika
        ctx.font = 'bold 42px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(user.username.toUpperCase(), 220, 60);

        // Ranga na serwerze
        ctx.font = '22px sans-serif';
        ctx.fillStyle = '#F1C40F';
        ctx.fillText(`Miejsce w rankingu: #${profileData.serverRank}`, 220, 105);

        // Monety
        ctx.font = 'bold 30px sans-serif';
        ctx.fillStyle = '#e4c464';
        ctx.fillText(`💰 ${profileData.coins.toLocaleString('pl-PL')} Złotych Monet`, 220, 150);

        // --- PASEK DOŚWIADCZENIA (XP BAR) ---
        const barX = 220;
        const barY = 180;
        const barW = 530;
        const barH = 24;
        const radius = 12;

        // Tło paska
        ctx.fillStyle = '#0a0a0f';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, radius);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#333344';
        ctx.stroke();

        // Wypełnienie paska (Postęp XP)
        const fillW = Math.max(barW * levelData.progress, radius * 2); // Zabezpieczenie przed ujemnym zaokrągleniem
        if (levelData.progress > 0) {
            const xpGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
            xpGrad.addColorStop(0, '#E67E22');
            xpGrad.addColorStop(1, '#F1C40F');
            ctx.fillStyle = xpGrad;
            ctx.beginPath();
            ctx.roundRect(barX, barY, fillW, barH, radius);
            ctx.fill();
        }

        // Tekst na pasku XP
        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`POZIOM ${levelData.level}  [ ${levelData.currentXP} / ${levelData.xpForNextLevel} XP ]`, barX + barW / 2, barY + 17);
        ctx.textAlign = 'left'; // Reset

        // Zwracamy bufor
        const buffer = await canvas.encode('png');
        return new AttachmentBuilder(buffer, { name: 'profile_card.png' });
    }
}

// ─────────────────────────────────────────────
// 🚀 4. GŁÓWNA KOMENDA (EXECUTE)
// ─────────────────────────────────────────────
module.exports = {
    data: new SlashCommandBuilder()
        .setName('portfel')
        .setDescription('Sprawdź status swojej postaci, doświadczenie i skarbiec.')
        .addUserOption(option => 
            option.setName('uzytkownik')
            .setDescription('Zajrzyj komuś do kieszeni (opcjonalnie)')
            .setRequired(false)
        ),

    async execute(interaction) {
        // Natychmiastowe wstrzymanie odpowiedzi (Canvas potrzebuje ułamka sekundy na wyrenderowanie)
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('uzytkownik') || interaction.user;

        if (targetUser.bot) {
            return interaction.editReply({ content: '🤖 Boty posługują się wyłącznie kodem, nie złotem.' });
        }

        const userId = targetUser.id;
        const guildId = interaction.guild.id;

        // Inicjalizacja i pobranie danych
        ProfileDatabase.init(userId, guildId);
        const profile = ProfileDatabase.getFullProfile(userId, guildId);
        const levelData = LevelSystem.getLevelData(profile.xp);

        // Generowanie Karty Profilowej (Canvas)
        const profileCard = await ProfileCanvas.generateCard(targetUser, profile, levelData);

        // Przygotowanie Statusu Boosta
        const now = Date.now();
        let boostStatus = '`⬛ ZWYKŁY ŚMIERTELNIK`\n> Brak aktywnych mutacji. Odwiedź sklep!';
        
        if (profile.boostExp > now) {
            boostStatus = `\`🟢 AKTYWNY WYWAR (x${profile.boostMult})\`\n> Moc wygaśnie: <t:${Math.floor(profile.boostExp / 1000)}:R>`;
        } else if (profile.boostMult > 1) {
            // Czyszczenie wygasłego boosta w bazie, żeby utrzymać porządek
            db.prepare('UPDATE economy SET boostMultiplier = 1, boostExpires = 0 WHERE userId = ? AND guildId = ?').run(userId, guildId);
        }

        // Kartoteka (Ostrzeżenia)
        const warnText = profile.warns > 0 
            ? `\`\`\`diff\n- Posiada ${profile.warns} ostrzeżeń\`\`\`` 
            : `\`\`\`diff\n+ Czysta kartoteka\`\`\``;

        // Budowanie głównego Embedu (opisowego)
        const embed = new EmbedBuilder()
            .setColor('#F1C40F')
            .setTitle(`📜 Karta Obywatela: ${targetUser.username}`)
            .setDescription(`Szczegółowy raport z Gidii Alchemików i Skarbca Zakonu.`)
            .addFields(
                { name: '🧪 Alchemia & Modyfikacje', value: boostStatus, inline: false },
                { name: '⚖️ Prawo & Reputacja', value: warnText, inline: false }
            )
            .setImage('attachment://profile_card.png')
            .setFooter({ text: 'Zakon Fiflaka • System Ekonomii', iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined })
            .setTimestamp();

        // Wysyłanie
        await interaction.editReply({
            embeds: [embed],
            files: [profileCard]
        });
    }
};