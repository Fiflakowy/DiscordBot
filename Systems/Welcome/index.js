const { EmbedBuilder, Events, AttachmentBuilder } = require('discord.js');
const db = require('../../db.js'); // Podłączamy bazę, by dać złoto na start
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

// ==========================================
// ⚙️ KONFIGURACJA ZAKONU
// ==========================================
const CONFIG = {
    WELCOME_CHANNEL_ID: '1503163604378063038',
    RULES_CHANNEL_ID: '1503163452326416444',
    AUTO_ROLE_ID: 'TUTAJ_WPISZ_ID_ROLI_STARTOWEJ', // Wklej ID roli, np. "Nowicjusz" (zostaw puste '', żeby wyłączyć)
    STARTING_COINS: 250, // Złoto na start
    COLORS: {
        primary: '#D4AF37', // Imperialne Złoto
        bgDark: '#0a0a0f',
        bgLight: '#1a1405'
    }
};

// ==========================================
// 🎨 CANVAS ENGINE (BANER POWITALNY)
// ==========================================
class WelcomeCanvas {
    static async generateImage(member) {
        const W = 900;
        const H = 300;
        const canvas = createCanvas(W, H);
        const ctx = canvas.getContext('2d');

        // --- TŁO ---
        const bgGrad = ctx.createLinearGradient(0, 0, W, H);
        bgGrad.addColorStop(0, CONFIG.COLORS.bgDark);
        bgGrad.addColorStop(1, CONFIG.COLORS.bgLight);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // Imperialna Ramka
        ctx.strokeStyle = CONFIG.COLORS.primary;
        ctx.lineWidth = 6;
        ctx.strokeRect(15, 15, W - 30, H - 30);

        // Geometria w tle
        ctx.beginPath();
        ctx.moveTo(300, 40);
        ctx.lineTo(300, 260);
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // --- AVATAR ---
        const avatarSize = 180;
        const avatarX = 70;
        const avatarY = (H - avatarSize) / 2;

        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        try {
            const avatarImg = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
            ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
        } catch (e) {
            ctx.fillStyle = '#2c2f33';
            ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
        }
        ctx.restore();

        // Złoty pierścień wokół avatara
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.lineWidth = 8;
        ctx.strokeStyle = CONFIG.COLORS.primary;
        ctx.stroke();

        // --- TEKST ---
        // Główny nagłówek
        ctx.font = 'bold 50px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(212, 175, 55, 0.6)';
        ctx.shadowBlur = 10;
        ctx.fillText('WITAJ W ZAKONIE!', 330, 110);
        ctx.shadowBlur = 0; // reset

        // Nazwa użytkownika
        ctx.font = 'bold 40px sans-serif';
        ctx.fillStyle = CONFIG.COLORS.primary;
        let username = member.user.username.toUpperCase();
        if (username.length > 15) username = username.substring(0, 15) + '...';
        ctx.fillText(username, 330, 170);

        // Podtytuł (Numer członka)
        ctx.font = '24px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(`Jesteś naszym wojownikiem nr #${member.guild.memberCount}`, 330, 220);

        const buffer = await canvas.encode('png');
        return new AttachmentBuilder(buffer, { name: 'welcome_banner.png' });
    }
}

// ==========================================
// 🚀 GŁÓWNY MODUŁ ZDARZENIA
// ==========================================
module.exports = (client) => {
    client.on(Events.GuildMemberAdd, async (member) => {
        const channel = member.guild.channels.cache.get(CONFIG.WELCOME_CHANNEL_ID);
        if (!channel) return;

        // 1. Inicjalizacja w Bazie Danych (Złoto na start)
        try {
            db.prepare('INSERT OR IGNORE INTO economy (userId, guildId, coins, boostMultiplier, boostExpires, lastDaily, xp) VALUES (?, ?, ?, 1, 0, 0, 0)')
              .run(member.id, member.guild.id, CONFIG.STARTING_COINS);
        } catch (dbErr) {
            console.error('❌ [WELCOME] Błąd przy dodawaniu portfela:', dbErr);
        }

        // 2. Nadanie automatycznej Roli (Auto-Role)
        if (CONFIG.AUTO_ROLE_ID) {
            try {
                const role = member.guild.roles.cache.get(CONFIG.AUTO_ROLE_ID);
                if (role) await member.roles.add(role);
            } catch (roleErr) {
                console.error('❌ [WELCOME] Błąd nadawania roli startowej (Brak uprawnień lub rola bota jest za nisko):', roleErr);
            }
        }

        // 3. Generowanie Baneru Powitalnego
        const welcomeImage = await WelcomeCanvas.generateImage(member);

        // 4. Budowa Głównego Embedu
        const welcomeEmbed = new EmbedBuilder()
            .setColor(CONFIG.COLORS.primary)
            .setAuthor({ 
                name: `NOWA KREW W ZAKONIE FIFLAKA!`, 
                iconURL: member.guild.iconURL({ dynamic: true }) 
            })
            .setTitle(`⚔️ Brama się otwiera, ${member.user.username}!`)
            .setDescription(
                `> **Niech żyje Zakon!** Wrota rozwarły się z hukiem, a w nich stanął nowy rekrut.\n\n` +
                `Zajmij miejsce przy ognisku, napełnij kufel i przygotuj się na niesamowitą przygodę. Jesteśmy tu braćmi, a honor stawiamy ponad wszystko. 🍻`
            )
            .addFields(
                { 
                    name: '📜 Pierwszy krok (Prawo Zakonu)', 
                    value: `Koniecznie odwiedź <#${CONFIG.RULES_CHANNEL_ID}>. Straż nie ma litości dla ignorantów.`,
                    inline: false 
                },
                { 
                    name: '💰 Dar od Karczmarza', 
                    value: `Jako że jesteś tu nowy, otrzymujesz **${CONFIG.STARTING_COINS} Złotych Monet** na start. Wpisz \`/portfel\`, aby je obejrzeć, i udaj się do \`/sklep\`.`,
                    inline: false 
                }
            )
            .setImage('attachment://welcome_banner.png')
            .setFooter({ 
                text: `Zakon Fiflaka • Dołącza jako #${member.guild.memberCount}`, 
                iconURL: client.user.displayAvatarURL()
            })
            .setTimestamp();

        // 5. Wysłanie na główny kanał
        try {
            await channel.send({
                content: `Zróbcie hałas dla nowego brata! 👋 <@${member.id}>`,
                embeds: [welcomeEmbed],
                files: [welcomeImage]
            });
        } catch (err) {
            console.error('❌ [WELCOME] Błąd przy wysyłaniu powitania:', err);
        }

        // 6. Prywatna Wiadomość (DM) do użytkownika
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor(CONFIG.COLORS.primary)
                .setTitle('🏰 Witaj w murach Zakonu Fiflaka!')
                .setDescription(`Cieszymy się, że dołączyłeś do naszej społeczności!\n\n**Oto Twoja lista startowa:**\n1️⃣ Przeczytaj zasady.\n2️⃣ Zajrzyj na kanały głosowe, by poznać braci.\n3️⃣ Pamiętaj, że za aktywność dostajesz monety i doświadczenie!\n\nNiech Moc i Złoto będą z Tobą!`);
            
            await member.send({ embeds: [dmEmbed] });
        } catch (dmErr) {
            // Ignorujemy ten błąd - wielu użytkowników ma zablokowane DM na Discordzie
            // console.log(`[WELCOME] Nie udało się wysłać DM do ${member.user.username}`);
        }
    });

    console.log('🏰 [SYSTEM] Zaawansowane Powitania RPG załadowane!');
};