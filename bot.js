require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ==========================================
// 1. INICJALIZACJA KLIENTA
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,   // Czytanie treści (XP, Moderacja, Logi)
        GatewayIntentBits.GuildMembers,    // Powitania, Autorole, Logi wejść
        GatewayIntentBits.GuildVoiceStates, // Nagrody Voice i Logi Voice
        GatewayIntentBits.GuildModeration   // Logi zmian ról i kar
    ],
    // Partials pozwalają botowi reagować na wiadomości i zdarzenia, 
    // które miały miejsce przed jego uruchomieniem (ważne dla logów)
    partials: [
        Partials.Message, 
        Partials.Channel, 
        Partials.Reaction, 
        Partials.GuildMember, 
        Partials.User
    ]
});

client.commands = new Collection();
const commandsArray = [];

// ==========================================
// 2. ŁADOWANIE SYSTEMÓW (Eventy i logika w tle)
// ==========================================
console.log('--- ŁADOWANIE SYSTEMÓW ---');
const systemsPath = path.join(__dirname, 'Systems');

if (fs.existsSync(systemsPath)) {
    const systemFolders = fs.readdirSync(systemsPath);
    for (const folder of systemFolders) {
        const systemFilePath = path.join(systemsPath, folder, 'index.js');
        if (fs.existsSync(systemFilePath)) {
            const systemInit = require(systemFilePath);
            systemInit(client); 
            console.log(`✅ [SYSTEM] Załadowano: ${folder}`);
        }
    }
} else {
    console.log('⚠️ Brak folderu Systems!');
}

// ==========================================
// 3. ŁADOWANIE KOMEND (Slash Commands)
// ==========================================
console.log('--- ŁADOWANIE KOMEND ---');
const commandsPath = path.join(__dirname, 'Commands');

if (fs.existsSync(commandsPath)) {
    const commandFolders = fs.readdirSync(commandsPath);
    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const command = require(path.join(folderPath, file));
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                commandsArray.push(command.data.toJSON());
                console.log(`✅ [KOMENDA] Załadowano: /${command.data.name}`);
            } else {
                console.log(`⚠️ [BŁĄD] W komendzie: ${file} brakuje właściwości 'data' lub 'execute'`);
            }
        }
    }
}

// ==========================================
// 4. OBSŁUGA WYKONYWANIA KOMEND
// ==========================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction, client);
    } catch (error) {
        console.error(`❌ Błąd przy wykonywaniu komendy /${interaction.commandName}:`, error);
        const errorMsg = { content: 'Wystąpił błąd podczas wykonywania tej komendy!', ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(errorMsg);
        else await interaction.reply(errorMsg);
    }
});

// ==========================================
// 5. REJESTRACJA API I LOGOWANIE BOTA
// ==========================================
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        client.once('ready', async () => {
            console.log(`🚀 Bot jest online jako ${client.user.tag}`);
            try {
                // Rejestracja komend globalnie
                await rest.put(
                    Routes.applicationCommands(client.user.id),
                    { body: commandsArray },
                );
                console.log(`🚀 Pomyślnie zarejestrowano ${commandsArray.length} komend!`);
            } catch (err) {
                console.error('❌ Błąd rejestracji komend:', err);
            }
        });

        await client.login(process.env.TOKEN);
    } catch (error) {
        console.error('❌ Błąd krytyczny:', error);
    }
})();
