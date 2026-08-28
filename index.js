require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType, EmbedBuilder, Events } = require('discord.js');
const util = require('minecraft-server-util');
const http = require('http');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

let lastServerStatus = null;

// Usamos Events.ClientReady para evitar el DeprecationWarning
client.once(Events.ClientReady, () => {
    console.log(`🤖 Bot conectado exitosamente como: ${client.user.tag}`);
    console.log('📡 Monitoreando servidor de Minecraft...');
    
    checkMinecraftServer();
    setInterval(checkMinecraftServer, 60000);
});

client.on(Events.GuildMemberAdd, async (member) => {
    const welcomeMode = process.env.WELCOME_MODE || 'CHANNEL';
    const welcomeChannelId = process.env.CHANNEL_WELCOME_ID;

    const embedBienvenida = new EmbedBuilder()
        .setColor('#55FF55')
        .setTitle(`¡Bienvenido/a a ${member.guild.name}!`)
        .setDescription(`Hola ${member}, ¡nos alegra tenerte aquí! Revisa los canales del servidor antes de comenzar a jugar.`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: 'Bot de Estado Minecraft' })
        .setTimestamp();

    if (welcomeMode === 'DM') {
        try {
            await member.send({ embeds: [embedBienvenida] });
            console.log(`✉️ Bienvenida enviada por MD a ${member.user.tag}`);
        } catch (error) {
            console.log(`⚠️ No se pudo enviar MD a ${member.user.tag} (mensajes privados desactivados).`);
        }
    } else {
        const channel = member.guild.channels.cache.get(welcomeChannelId);
        if (channel) {
            await channel.send({ content: `${member}`, embeds: [embedBienvenida] });
            console.log(`📢 Bienvenida enviada al canal para ${member.user.tag}`);
        } else {
            console.log('⚠️ Canal de bienvenida no encontrado. Revisa CHANNEL_WELCOME_ID.');
        }
    }
});

async function checkMinecraftServer() {
    const host = process.env.MC_HOST;
    const port = parseInt(process.env.MC_PORT) || 25565;
    const statusChannelId = process.env.CHANNEL_STATUS_ID;

    if (!host) {
        console.error('❌ Error: MC_HOST no está configurado en las variables de entorno.');
        return;
    }

    try {
        console.log(`🔎 Intentando conectar a Minecraft: ${host}:${port}...`);
        
        // Usamos minecraft-server-util en lugar de mcstatus.js
        const response = await util.status(host, port, { timeout: 5000 });
        
        // Si no lanza error (catch), el servidor está online
        const playersOnline = response.players ? response.players.online : 0;
        const playersMax = response.players ? response.players.max : 0;

        console.log(`✅ Conexión exitosa. Jugadores: ${playersOnline}/${playersMax}`);
        client.user.setActivity(`🟢 En línea (${playersOnline}/${playersMax})`, { type: ActivityType.Custom });

        if (lastServerStatus === false || lastServerStatus === null) {
            if (lastServerStatus === false) {
                await sendStateChangeNotice(statusChannelId, true, playersOnline, playersMax);
            }
            lastServerStatus = true;
        }
        
    } catch (error) {
        console.log(`❌ Error al conectar con Minecraft: ${error.message}`);
        await setOfflineState(statusChannelId);
    }
}

async function setOfflineState(channelId) {
    client.user.setActivity('🔴 Servidor apagado', { type: ActivityType.Custom });

    if (lastServerStatus === true) {
        await sendStateChangeNotice(channelId, false);
    }
    lastServerStatus = false;
}

async function sendStateChangeNotice(channelId, isOnline, onlinePlayers = 0, maxPlayers = 0) {
    const channel = client.channels.cache.get(channelId);
    if (!channel) {
        console.log(`⚠️ No se pudo enviar el mensaje Embed. Revisa el CHANNEL_STATUS_ID (${channelId})`);
        return;
    }

    if (isOnline) {
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🟢 Servidor Encendido')
            .setDescription(`El servidor de Minecraft ya está encendido y listo para jugar.`)
            .addFields(
                { name: 'IP del Servidor', value: `\`${process.env.MC_HOST}:${process.env.MC_PORT || 25565}\``, inline: false },
                { name: 'Jugadores Conectados', value: `${onlinePlayers}/${maxPlayers}`, inline: true }
            )
            .setTimestamp();

        await channel.send({ embeds: [embed] });
        console.log('📢 Mensaje de SERVIDOR ENCENDIDO enviado correctamente al canal.');
    } else {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🔴 Servidor Apagado')
            .setDescription('El servidor de Minecraft se encuentra actualmente fuera de línea.')
            .setTimestamp();

        await channel.send({ embeds: [embed] });
        console.log('📢 Mensaje de SERVIDOR APAGADO enviado correctamente al canal.');
    }
}

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot de Discord activo 24/7');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌐 Servidor HTTP activo en el puerto ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);
