const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-regulamin')
        .setDescription('Wysyła potężny i oficjalny regulamin Zakonu na obecny kanał')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const rulesEmbed = new EmbedBuilder()
            .setColor('#D4AF37') // Imperialne złoto
            .setAuthor({ 
                name: 'ZAKON FIFLAKA - OFICJALNY KODEKS (WYDANIE ROZSZERZONE)', 
                iconURL: interaction.guild.iconURL({ dynamic: true }) 
            })
            .setTitle('📜 Święte Prawo naszej Twierdzy i Karczmy')
            .setDescription(
                `>>> **Witaj, Szlachetny Wędrowcze!**\nPrzekraczając bramy naszego Zakonu, automatycznie składasz przysięgę przestrzegania poniższych praw. Straż pilnuje porządku z mieczem w ręku, a magia Karczmarza (Auto-Mod) nigdy nie śpi. \n\n*Przeczytaj ten zwój uważnie, by Twoja przygoda nie zakończyła się w wilgotnych lochach!*`
            )
            .addFields(
                { 
                    name: '§1. Braterstwo i Szacunek 🤝', 
                    value: 'Wszyscy jesteśmy tu braćmi i siostrami. Bezwzględnie zakazuje się nękania, wyzywania, gróźb, dyskryminacji, rasizmu i ataków personalnych. Toksyczność jest zwalczana bez litości.',
                    inline: false 
                },
                { 
                    name: '§2. Język i Maniery Karczemne 🗣️', 
                    value: 'Atmosfera jest luźna, mowa bywa ostra, ale **nadmierne przeklinanie i omijanie cenzury** natychmiast aktywuje nasz system ostrzeżeń (Warnów). Używaj słów z rozwagą.',
                    inline: false 
                },
                { 
                    name: '§3. Zakazane Zaklęcia i Artefakty (Reklamy) 🔗', 
                    value: 'Surowy zakaz wysyłania zaproszeń do obcych serwerów (discord.gg). Promowanie własnych projektów czy Twitch/YouTube bez uprzedniej zgody Mistrzów jest zabronione. System automatycznie pacyfikuje wszelkie podejrzane linki.',
                    inline: false 
                },
                { 
                    name: '§4. Mroczna Magia (NSFW & Gore) 🔞', 
                    value: 'Całkowity zakaz wysyłania treści pornograficznych, erotycznych, brutalnych, obrzydliwych i gore. Przestrzeń Zakonu to miejsce bezpieczne. Złamanie tego punktu kończy się natychmiastowym, permanentnym **Banem**.',
                    inline: false 
                },
                { 
                    name: '§5. Karczemne Rozróby (Spam & Flood) 📜', 
                    value: 'Nie krzycz i nie zalewaj czatu! Zabrania się spamu, floodu (wysyłania wielu wiadomości pod rząd), nadużywania Caps Locka, masowego oznaczania (pingowania) Administracji oraz tzw. ghost-pingów.',
                    inline: false 
                },
                { 
                    name: '§6. Dźwięki z Głębin (Kanały Głosowe) 🎧', 
                    value: 'Szanuj uszy współbiesiadników. Puszczanie głośnej muzyki (earrape), nadużywanie soundpadów bez zgody innych, przestery z mikrofonu oraz nagrywanie rozmów bez zgody obecnych na kanale to prosta droga do wyciszenia (Mute).',
                    inline: false 
                },
                { 
                    name: '§7. Fałszywe Tożsamości (Konta i Awatary) 🎭', 
                    value: 'Zakazane jest posiadanie avatarów, bannerów oraz nicków wulgarnych, prowokujących lub zawierających reklamy. **Surowo zabrania się podszywania pod Strażników i Mistrzów Zakonu!** Posiadanie multikont w celu omijania kar grozi wygnaniem.',
                    inline: false 
                },
                { 
                    name: '§8. Porządek w Komnatach 📚', 
                    value: 'Każda sala ma swoje przeznaczenie. Używaj komend bota tylko na dedykowanych kanałach, memy wrzucaj do sekcji z memami, a dyskusje prowadź tam, gdzie ich miejsce. Czytaj opisy kanałów!',
                    inline: false 
                },
                { 
                    name: '§9. Prawo Trzech Ostrzeżeń ⚖️', 
                    value: 'Nasz Karczmarz (Bot) liczy wasze błędy. Złamanie regulaminu oznacza warna. **3 ostrzeżenia = Timeout na 10 minut. 5 ostrzeżeń = Timeout na 24 godziny**. Straż może nadać karę bez ostrzeżenia, zależnie od powagi czynu.',
                    inline: false 
                },
                { 
                    name: '§10. Słowo Mistrzów jest ostateczne 👑', 
                    value: 'Straż i Administracja Zakonu dbają o porządek i mają prawo zinterpretować regulamin wedle własnego uznania, by chronić serwer. Ich decyzje są niepodważalne. Luki w prawie nie chronią przed karą.',
                    inline: false 
                }
            )
            .setImage('https://i.imgur.com/lr2a9gN.png') // Twój epicki baner
            .setFooter({ 
                text: 'Zakon Fiflaka • Dołączenie na serwer jest równoznaczne z akceptacją powyższych zasad.', 
                iconURL: interaction.guild.iconURL() 
            })
            .setTimestamp();

        // Ozdobny przycisk akceptacji pod spodem
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('rules_accepted_dummy')
                .setLabel('Zrozumiałem i Przysięgam Przestrzegać Kodeksu')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🛡️')
                .setDisabled(true) // Przycisk jest nieaktywny, służy jako wizualny znak przysięgi
        );

        // Usuń starą wiadomość na której użyto komendy (jeśli używasz jako prefix, w slash nie trzeba, ale reply i tak robimy)
        await interaction.channel.send({ embeds: [rulesEmbed], components: [row] });

        // Cicha odpowiedź zwrotna dla admina
        await interaction.reply({ content: '✅ Rozszerzony Kodeks Zakonu został wywieszony!', ephemeral: true });
    }
};