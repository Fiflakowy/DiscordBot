const { EmbedBuilder } = require('discord.js');
const db = require('../../db.js');

module.exports = (client) => {
    // ==========================================
    // 1. KONFIGURACJA I ID
    // ==========================================
    const adminRoles = ['1475570484585168957', '1475572271446884535']; // Pełen immunitet (mogą wszystko)
    const bypassLinkRole = '1476000398107217980'; // Może wysyłać zwykłe linki, ale NIE invite'y do Discorda
    const autoRoleId = '1475572275095929022'; 
    const logChannelId = '1503164203488252014'; // Kanał do logów moderacji

    // --- USTAWIENIA OCHRONY ---
    const SPAM_LIMIT = 5;       // Max wiadomości
    const SPAM_TIME = 5000;     // w czasie 5 sekund (5000 ms)
    const MASS_MENTION_MAX = 4; // Max pingów w jednej wiadomości
    const CAPS_LOCK_MIN_LEN = 15; // Od ilu znaków sprawdzamy Caps Lock
    const CAPS_LOCK_RATIO = 0.7;  // 70% dużych liter = Warn

    const userSpamMap = new Map(); // Pamięć podręczna na wiadomości dla Anti-Spamu

    // Dwa osobne Regexy - jeden surowo na Discorda, drugi na resztę internetu
    const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[^\s/]+?(?=\b)/gi;
    const generalLinkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
    
    const allowedLinkDomains = ['tenor.com', 'giphy.com'];

    const forbiddenPatterns = [
        "nigg", "nger", "ngge", "kurw", "kurew", "jeb", "pierd", "pizd", "chuj", "huj", 
        "kutas", "shmat", "szmat", "cwel", "dupa", "fuc", "fck", "puss", "cunt"
    ];

    const badWords = [
        "nigger", "niggers", "niger", "nigery", "cwel", "cwela", "cwelu", "cwele",
        "chuj", "chuja", "chujek", "chujem", "chujnia", "chujowa", "chujowe", "chujowy", "chuju", "ciot", "ciota", "cip", "cipa", "cipach", "cipami", "cipce", "cipe", "cipek", "cipie", "cipka", "cipkach", "cipkami", "cipki", "cipko", "cipkom", "cipką", "cipkę", "cipo", "cipom", "cipy", "cipą", "cipę", "ciul", "debilu", "dojebac", "dojebal", "dojebala", "dojebalam", "dojebalem", "dojebać", "dojebał", "dojebała", "dojebałam", "dojebałem", "dojebie", "dojebię", "dopieprzac", "dopieprzać", "dopierdala", "dopierdalac", "dopierdalajacy", "dopierdalający", "dopierdalal", "dopierdalala", "dopierdalać", "dopierdalał", "dopierdalała", "dopierdole", "dopierdoli", "dopierdolic", "dopierdolil", "dopierdolić", "dopierdolił", "dopierdolę", "downie", "dupa", "dupcia", "dupe", "dupeczka", "dupie", "dupy", "dupą", "dzifka", "dzifko", "dziwka", "dziwko", "fiucie", "fiut", "fuck", "huj", "huja", "huje", "hujek", "hujem", "hujnia", "huju", "hój", "jebac", "jebak", "jebaka", "jebako", "jebal", "jebana", "jebane", "jebanej", "jebani", "jebanka", "jebankiem", "jebanko", "jebany", "jebanych", "jebanym", "jebanymi", "jebaną", "jebać", "jebał", "jebcie", "jebia", "jebiaca", "jebiacego", "jebiaceej", "jebiacy", "jebie", "jebią", "jebiąca", "jebiącego", "jebiącej", "jebiący", "jebię", "jebliwy", "jebna", "jebnac", "jebnal", "jebnać", "jebnela", "jebnie", "jebnij", "jebną", "jebnąc", "jebnąć", "jebnął", "jebnęła", "jebut", "koorwa", "korewko", "kurestwo", "kurew", "kurewko", "kurewska", "kurewski", "kurewskiej", "kurewsko", "kurewską", "kurewstwo", "kurwa", "kurwaa", "kurwach", "kurwami", "kurwe", "kurwiarz", "kurwic", "kurwica", "kurwidołek", "kurwie", "kurwik", "kurwiki", "kurwiska", "kurwiszcze", "kurwiszon", "kurwiszona", "kurwiszonem", "kurwiszony", "kurwiący", "kurwić", "kurwo", "kurwy", "kurwą", "kurwę", "kutas", "kutasa", "kutasach", "kutasami", "kutasem", "kutasie", "kutasow", "kutasy", "kutasów", "kórewko", "kórwa", "lesbijko", "matkojebca", "matkojebcach", "matkojebcami", "matkojebcy", "matkojebcą", "morde", "mordę", "nabarłożyć", "najebac", "najebal", "najebala", "najebana", "najebane", "najebany", "najebaną", "najebać", "najebał", "najebała", "najebia", "najebie", "najebią", "nakurwiac", "nakurwiamy", "nakurwiać", "nakurwiscie", "nakurwiście", "naopierdalac", "naopierdalal", "naopierdalala", "naopierdalać", "naopierdalał", "naopierdalała", "napierdalac", "napierdalajacy", "napierdalający", "napierdalać", "napierdolic", "napierdolić", "nawpierdalac", "nawpierdalal", "nawpierdalala", "nawpierdalać", "nawpierdalał", "nawpierdalała", "obsrywac", "obsrywajacy", "obsrywający", "obsrywać", "odpieprzac", "odpieprzać", "odpieprzy", "odpieprzyl", "odpieprzyla", "odpieprzył", "odpieprzyła", "odpierdalac", "odpierdalajaca", "odpierdalajacy", "odpierdalająca", "odpierdalający", "odpierdalać", "odpierdol", "odpierdoli", "odpierdolic", "odpierdolil", "odpierdolila", "odpierdolić", "odpierdolił", "odpierdoliła", "opieprzający", "opierdala", "opierdalac", "opierdalajacy", "opierdalający", "opierdalać", "opierdol", "opierdola", "opierdoli", "opierdolic", "opierdolić", "opierdolą", "pedale", "picza", "piczka", "piczo", "pieprz", "pieprzniety", "pieprznięty", "pieprzony", "pierdel", "pierdlu", "pierdol", "pierdola", "pierdolaca", "pierdolacy", "pierdole", "pierdolec", "pierdolenie", "pierdoleniem", "pierdoleniu", "pierdoli", "pierdolic", "pierdolicie", "pierdolil", "pierdolila", "pierdolisz", "pierdolić", "pierdolił", "pierdoliła", "pierdolnac", "pierdolnal", "pierdolnela", "pierdolnie", "pierdolniety", "pierdolnij", "pierdolnik", "pierdolnięty", "pierdolny", "pierdolnąć", "pierdolnął", "pierdolnęła", "pierdolona", "pierdolene", "pierdolony", "pierdolą", "pierdoląca", "pierdolący", "pierdolę", "pierdołki", "pierdziec", "pierdzieć", "pierdzący", "pizda", "pizde", "pizdnac", "pizdnąć", "pizdu", "pizdzie", "pizdą", "pizdę", "piździe", "podjebac", "podjebać", "podkurwic", "podkurwić", "podpierdala", "podpierdalac", "podpierdalajacy", "podpierdalający", "podpierdalać", "podpierdoli", "podpierdolic", "podpierdolić", "pojeb", "pojeba", "pojebac", "pojebalo", "pojebami", "pojebancu", "pojebane", "pojebanego", "pojebanemu", "pojebani", "pojebany", "pojebanych", "pojebanym", "pojebanymi", "pojebać", "pojebańcu", "pojebem", "popierdala", "popierdalac", "popierdalać", "popierdolencu", "popierdoleni", "popierdoleńcu", "popierdoli", "popierdolic", "popierdolić", "popierdolone", "popierdolonego", "popierdolonemu", "popierdolony", "popierdolonym", "porozpierdala", "porozpierdalac", "porozpierdalać", "poruchac", "poruchać", "przejebac", "przejebane", "przejebać", "przepierdala", "przepierdalac", "przepierdalajaca", "przepierdalajacy", "przepierdalająca", "przepierdalający", "przepierdalać", "przepierdolic", "przepierdolić", "przyjebac", "przyjebal", "przyjebala", "przyjebali", "przyjebać", "przyjebał", "przyjebała", "przyjebie", "przypieprzac", "przypieprzajaca", "przypieprzajacy", "przypieprzająca", "przypieprzający", "przypieprzać", "przypierdala", "przypierdalac", "przypierdalajacy", "przypierdalający", "przypierdalać", "przypierdoli", "przypierdolic", "przypierdolić", "qrwa", "rozjeb", "rozjebac", "rozjebali", "rozjebaliście", "rozjebaliśmy", "rozjebać", "rozjebał", "rozjebała", "rozjebałam", "rozjebałaś", "rozjebałem", "rozjebałeś", "rozjebało", "rozjebały", "rozjebałyście", "rozjebałyśmy", "rozjebcie", "rozjebie", "rozjebiecie", "rozjebiemy", "rozjebiesz", "rozjebią", "rozjebię", "rozjebmy", "rozpierdala", "rozpierdalac", "rozpierdalać", "rozpierdole", "rozpierdoli", "rozpierdolic", "rozpierdolić", "rozpierducha", "rucha", "ruchacie", "ruchaj", "ruchajcie", "ruchajmy", "ruchają", "ruchali", "ruchaliście", "ruchaliśmy", "rucham", "ruchamy", "ruchasz", "ruchać", "ruchał", "ruchała", "ruchałam", "ruchałaś", "ruchałem", "ruchałeś", "ruchało", "ruchałom", "ruchałoś", "ruchały", "ruchałyście", "ruchałyśmy", "ryj", "skurwic", "skurwiel", "skurwiela", "skurwielem", "skurwielu", "skurwić", "skurwysyn", "skurwysyna", "skurwysynem", "skurwysynow", "skurwysynski", "skurwysynstwo", "skurwysynu", "skurwysyny", "skurwysynów", "skurwysyński", "skurwysyństwo", "skutasiony", "spermosiorbacz", "spermosiorbaczem", "spieprza", "spieprzac", "spieprzaj", "spieprzaja", "spieprzajaca", "spieprzajacy", "spieprzajcie", "spieprzają", "spieprzająca", "spieprzający", "spieprzać", "spierdala", "spierdalac", "spierdalaj", "spierdalajacy", "spierdalający", "spierdalal", "spierdalala", "spierdalalcie", "spierdalać", "spierdalał", "spierdalała", "spierdola", "spierdolencu", "spierdoleńcu", "spierdoli", "spierdolic", "spierdolić", "spierdoliła", "spierdoliło", "spierdolą", "srac", "sraj", "srajac", "srajacy", "srając", "srający", "srać", "sukinsyn", "sukinsynom", "sukinsynow", "sukinsynowi", "sukinsyny", "sukinsynów", "szmata", "szmato", "udupić", "ujebac", "ujebal", "ujebala", "ujebana", "ujebany", "ujebać", "ujebał", "ujebała", "ujebie", "upierdala", "upierdalac", "upierdalać", "upierdol", "upierdola", "upierdoleni", "upierdoli", "upierdolic", "upierdolić", "upierdolą", "wjebac", "wjebać", "wjebia", "wjebie", "wjebiecie", "wjebiemy", "wjebią", "wkurwi", "wkurwia", "wkurwiac", "wkurwiacie", "wkurwiajaca", "wkurwiajacy", "wkurwiają", "wkurwiająca", "wkurwiający", "wkurwial", "wkurwiali", "wkurwiać", "wkurwiał", "wkurwic", "wkurwicie", "wkurwimy", "wkurwią", "wkurwić", "wpierdalac", "wpierdalajacy", "wpierdalający", "wpierdalać", "wpierdol", "wpierdolic", "wpierdolić", "wpizdu", "wyjebac", "wyjebali", "wyjebany", "wyjebać", "wyjebał", "wyjebała", "wyjebały", "wyjebia", "wyjebie", "wyjebiecie", "wyjebiemy", "wyjebiesz", "wyjebią", "wykurwic", "wykurwić", "wykurwiście", "wypieprza", "wypieprzac", "wypieprzal", "wypieprzala", "wypieprzać", "wypieprzał", "wypieprzała", "wypieprzy", "wypieprzyl", "wypieprzyla", "wypieprzył", "wypieprzyła", "wypierdal", "wypierdala", "wypierdalac", "wypierdalaj", "wypierdalal", "wypierdalala", "wypierdalać", "wypierdalał", "wypierdalała", "wypierdola", "wypierdoli", "wypierdolic", "wypierdolicie", "wypierdolil", "wypierdolila", "wypierdolili", "wypierdolimy", "wypierdolić", "wypierdolił", "wypierdoliła", "wypierdolą", "wypiździały", "zajebac", "zajebac", "zajebali", "zajebana", "zajebane", "zajebani", "zajebany", "zajebanych", "zajebanym", "zajebanymi", "zajebać", "zajebała", "zajebia", "zajebial", "zajebiala", "zajebiał", "zajebie", "zajebiscie", "zajebista", "zajebiste", "zajebisty", "zajebistych", "zajebistym", "zajebistymi", "zajebią", "zajebiście", "zapieprza", "zapieprzy", "zapieprzyc", "zapieprzycie", "zapieprzyl", "zapieprzyla", "zapieprzymy", "zapieprzysz", "zapieprzyć", "zapieprzył", "zapieprzyla", "zapieprzą", "zapierdala", "zapierdalac", "zapierdalaaj", "zapierdalaja", "zapierdalajacy", "zapierdalajcie", "zapierdalający", "zapierdalala", "zapierdalali", "zapierdalać", "zapierdalał", "zapierdalała", "zapierdola", "zapierdoli", "zapierdolic", "zapierdolil", "zapierdolila", "zapierdolić", "zapierdolił", "zapierdoliła", "zapierdolą", "zapierniczający", "zapierniczać", "zasranym", "zasrać", "zasrywający", "zasrywać", "zesrywający", "zesrywać", "zjebac", "zjebal", "zjebala", "zjebali", "zjebana", "zjebancu", "zjebane", "zjebać", "zjebał", "zjebała", "zjebańcu", "zjebią", "zjeby", "śmierdziel"
    ];

    // ==========================================
    // 2. AUTOROLE (Z powitaniem na DM)
    // ==========================================
    client.on('guildMemberAdd', async (member) => {
        try {
            const role = member.guild.roles.cache.get(autoRoleId);
            if (role) {
                await member.roles.add(role);
                console.log(`✅ [AUTOROLE] Nadano rolę dla: ${member.user.tag}`);

                // Piękny list powitalny od Karczmarza na DM!
                const welcomeEmbed = new EmbedBuilder()
                    .setColor('#D4AF37') // Złoto Karczmy
                    .setAuthor({ name: 'Zakon Fiflaka', iconURL: member.guild.iconURL({ dynamic: true }) })
                    .setTitle('🍻 Witaj w naszych progach, Wędrowcze!')
                    .setDescription(`Brama Zakonu została przed Tobą otwarta. Znajdź wolne miejsce przy kominku, napij się miodu i poznaj braci.`)
                    .addFields(
                        { name: '📜 Pierwszy Krok', value: 'Koniecznie zapoznaj się z kodeksem na kanale regulaminu.', inline: false },
                        { name: '💰 Nagrody', value: 'Pamiętaj o odbieraniu nagród za pisanie na czatach i komendach `/daily` oraz `/tablica`!', inline: false }
                    )
                    .setFooter({ text: 'Niech Twoja legenda rozpocznie się tutaj.' })
                    .setTimestamp();
                
                await member.send({ embeds: [welcomeEmbed] }).catch(() => {}); // Łapiemy błąd jeśli DM wyłączone
            }
        } catch (err) {
            console.error('❌ [AUTOROLE] Błąd:', err);
        }
    });

    // ==========================================
    // 3. LOGOWANIE ZMIAN RÓL (W tym odjęcie roli)
    // ==========================================
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        // Sprawdzamy, czy zmieniła się liczba ról
        if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
            const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
            const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

            const logChannel = newMember.guild.channels.cache.get(logChannelId);
            if (!logChannel) return;

            // Logowanie nadania ról
            if (addedRoles.size > 0) {
                const addEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('🎖️ Nadano nowe odznaczenia (Role)')
                    .addFields(
                        { name: '👤 Obywatel', value: `${newMember.user.tag}\n(<@${newMember.id}>)`, inline: true },
                        { name: '🛡️ Nadający', value: `${newMember.guild.me ? newMember.guild.me.user.tag : client.user.tag}`, inline: true },
                        { name: '➕ Otrzymane role', value: addedRoles.map(r => `<@&${r.id}>`).join('\n'), inline: false }
                    )
                    .setTimestamp();
                logChannel.send({ embeds: [addEmbed] });
            }

            // Logowanie zabrania ról (Odjęcie roli)
            if (removedRoles.size > 0) {
                const remEmbed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle('📉 Zabrano odznaczenia (Role)')
                    .addFields(
                        { name: '👤 Obywatel', value: `${newMember.user.tag}\n(<@${newMember.id}>)`, inline: true },
                        { name: '🛡️ Odbierający', value: `${newMember.guild.me ? newMember.guild.me.user.tag : client.user.tag}`, inline: true },
                        { name: '➖ Stracone role', value: removedRoles.map(r => `<@&${r.id}>`).join('\n'), inline: false }
                    )
                    .setTimestamp();
                logChannel.send({ embeds: [remEmbed] });
            }
        }
    });

    // ==========================================
    // 4. ZAAWANSOWANA MODERACJA (Wiadomości)
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (!message.guild || message.author.bot) return;

        const member = message.member;
        if (!member) return;

        const userId = message.author.id;

        // Czy użytkownik ma pełen immunitet (Administracja)?
        const isAdmin = member.roles.cache.some(r => adminRoles.includes(r.id));
        if (isAdmin) return; 

        // --- 0. ANTI-SPAM (FLOOD OCHRONA) ---
        if (!userSpamMap.has(userId)) {
            userSpamMap.set(userId, []);
        }
        
        const userTimestamps = userSpamMap.get(userId);
        const now = Date.now();
        userTimestamps.push(now);

        // Usuwamy stare logi (starsze niż 5 sekund)
        const recentTimestamps = userTimestamps.filter(time => now - time < SPAM_TIME);
        userSpamMap.set(userId, recentTimestamps);

        if (recentTimestamps.length > SPAM_LIMIT) {
            userSpamMap.set(userId, []); // Czyścimy limit żeby bot nie wysłał 10 warnów naraz
            return handleAutoWarn(message, "wywoływać rabanu i spamować na czacie");
        }

        // --- 1. SPRAWDZANIE ZAPROSZEŃ DISCORD ---
        if (message.content.match(inviteRegex)) {
            return handleAutoWarn(message, "reklamować obcych serwerów");
        }

        // --- 2. ZWYKŁE LINKI ---
        const canSendGeneralLinks = member.roles.cache.has(bypassLinkRole);
        if (!canSendGeneralLinks) {
            const links = message.content.match(generalLinkRegex);
            if (links) {
                const isDisallowedLink = links.some(url => {
                    const lowerUrl = url.toLowerCase();
                    return !allowedLinkDomains.some(domain => lowerUrl.includes(domain));
                });

                if (isDisallowedLink) {
                    return handleAutoWarn(message, "przemcać mrocznych artefaktów (wysyłać nieautoryzowanych linków)");
                }
            }
        }

        // --- 3. MASOWE OZNACZANIE (PINGS) ---
        if (message.mentions.users.size > MASS_MENTION_MAX) {
            return handleAutoWarn(message, `niepokoić wielu gości na raz (Max ${MASS_MENTION_MAX} pingów)`);
        }

        // --- 4. KRZYCZENIE (CAPS LOCK) ---
        if (message.content.length > CAPS_LOCK_MIN_LEN) {
            const letters = message.content.replace(/[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '');
            if (letters.length > 0) {
                const upperCaseLetters = letters.replace(/[^A-ZĄĆĘŁŃÓŚŹŻ]/g, '');
                if (upperCaseLetters.length / letters.length > CAPS_LOCK_RATIO) {
                    return handleAutoWarn(message, "krzyczeć w Karczmie (nadużywanie CAPS LOCKA)");
                }
            }
        }

        // --- 5. SPRAWDZANIE WULGARYZMÓW ---
        let rawContent = message.content.toLowerCase();
        let deduped = rawContent.replace(/(.)\1+/g, '$1');
        const leetMap = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 'u' };
        for (const [num, letter] of Object.entries(leetMap)) {
            deduped = deduped.replaceAll(num, letter);
        }
        const superClean = deduped.replace(/[^a-ząćęłńóśźż]/gi, '');

        const isToxicWord = badWords.some(word => superClean.includes(word));
        const isToxicPattern = forbiddenPatterns.some(pattern => superClean.includes(pattern));

        if (isToxicWord || isToxicPattern) {
            return handleAutoWarn(message, "rzucać rynsztokowymi obelgami (przeklinać)");
        }
    });

    // --- FUNKCJA AUTOMATYCZNEGO OSTRZEŻENIA I KARY ---
    async function handleAutoWarn(message, reason) {
        const userId = message.author.id;
        const guildId = message.guild.id;

        try {
            // 1. Kasujemy wiadomość naruszającą regulamin
            await message.delete().catch(() => {});

            // 2. Dodajemy warna do bazy danych
            db.prepare('INSERT OR IGNORE INTO warnings (userId, guildId, warnCount) VALUES (?, ?, 0)').run(userId, guildId);
            db.prepare('UPDATE warnings SET warnCount = warnCount + 1 WHERE userId = ? AND guildId = ?').run(userId, guildId);

            const data = db.prepare('SELECT warnCount FROM warnings WHERE userId = ? AND guildId = ?').get(userId, guildId);
            const warnCount = data.warnCount;

            let actionText = "Ostrzeżenie zostało wyrzeźbione w Twojej kartotece.";
            
            // 3. LOGIKA KAR AUTOMATYCZNYCH (TIMEOUT)
            if (warnCount === 3) {
                await message.member.timeout(10 * 60 * 1000, 'Automatyczna kara za 3 ostrzeżenia');
                actionText = "Ze względu na 3 ostrzeżenia, nakładamy na Ciebie **Knebel (Timeout) na 10 minut**.";
            } 
            else if (warnCount >= 5) {
                await message.member.timeout(24 * 60 * 60 * 1000, 'Automatyczna kara za 5 ostrzeżeń');
                actionText = "Uzbierałeś 5 ostrzeżeń! Zostajesz odesłany do lochu na **24 godziny**. Twój licznik win został zresetowany.";
                db.prepare('UPDATE warnings SET warnCount = 0 WHERE userId = ? AND guildId = ?').run(userId, guildId);
            }

            // 4. Powiadomienie na kanale publicznym (znika po 7 sekundach)
            const warningEmbed = await message.channel.send({
                content: `⚠️ <@${userId}>, Straż Zakonu nie pozwala tutaj **${reason}**! To Twoje **${warnCount}** ostrzeżenie.`
            });
            setTimeout(() => warningEmbed.delete().catch(() => {}), 7000);

            // 5. WYSYŁANIE WIADOMOŚCI PRYWATNEJ (DM) DO UŻYTKOWNIKA
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle(`⚔️ Złamanie Kodeksu: ${message.guild.name}`)
                    .setDescription(`Magia Strażników wykryła, że łamiesz zasady Zakonu!`)
                    .addFields(
                        { name: '📜 Powód ostrzeżenia', value: reason },
                        { name: '🛑 Twoje Akta', value: `To jest Twoje **${warnCount}** ostrzeżenie.` },
                        { name: '🔨 Konsekwencje', value: actionText },
                        { name: '📄 Spalona treść', value: `\`\`\`${message.content.slice(0, 500) || '[Brak treści]'}\`\`\`` }
                    )
                    .setFooter({ text: 'Szanuj braci i pilnuj języka!' })
                    .setTimestamp();
                
                await message.author.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                // Użytkownik zablokował DM
            }

            // 6. Logowanie do kanału administracyjnego (Strażnica)
            const logChannel = message.guild.channels.cache.get(logChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor('#FF4500')
                    .setTitle('👁️ Magiczny System Ostrzeżeń (Auto-Mod)')
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                    .addFields(
                        { name: '👤 Winny', value: `${message.author.tag} (<@${userId}>)`, inline: true },
                        { name: '📈 Warny', value: `**${warnCount}**`, inline: true },
                        { name: '📜 Powód', value: reason },
                        { name: '🔨 Wymierzona kara', value: actionText },
                        { name: '📄 Złapana wiadomość', value: `\`\`\`${message.content.slice(0, 500) || '[Tylko załącznik]'}\`\`\`` }
                    )
                    .setTimestamp();
                logChannel.send({ embeds: [logEmbed] });
            }

        } catch (err) {
            console.error('❌ [AUTO-WARN ERROR]:', err);
        }
    }

    console.log('🛡️ [SYSTEM] Potężna Moderacja (Spam, Caps, Pingi, Wulgaryzmy) załadowana!');
};
