require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType, EmbedBuilder, Events } = require('discord.js');
const http = require('http');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

let lastServerStatus = null;

client.once(Events.ClientReady, () => {
    console.log(`🤖 Bot conectado exitosamente como: ${client.user.tag}`);
    console.log('📡 Monitoreando servidor de Minecraft...');
    
    checkMinecraftServer();
    setInterval(checkMinecraftServer, 60000); // Consulta cada 60 segundos
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
    const port = process.env.MC_PORT || '25565';
    const statusChannelId = process.env.CHANNEL_STATUS_ID;

    if (!host) {
        console.error('❌ Error: MC_HOST no está configurado en las variables de entorno.');
        return;
    }

    try {
        const address = `${host}:${port}`;
        console.log(`🔎 Consultando estado de Minecraft para: ${address}...`);
        
        // Petición a API pública segura
        const apiRes = await fetch(`https://api.mcsrvstat.us/v3/${address}`);
        const data = await apiRes.json();

        if (data && data.online) {
            const playersOnline = data.players ? data.players.online : 0;
            const playersMax = data.players ? data.players.max : 0;

            console.log(`✅ Conexión exitosa. Jugadores: ${playersOnline}/${playersMax}`);
            client.user.setActivity(`🟢 En línea (${playersOnline}/${playersMax})`, { type: ActivityType.Custom });

            if (lastServerStatus === false || lastServerStatus === null) {
                if (lastServerStatus === false) {
                    await sendStateChangeNotice(statusChannelId, true, playersOnline, playersMax);
                }
                lastServerStatus = true;
            }
        } else {
            console.log('⚠️ El servidor de Minecraft figura como apagado/offline.');
            await setOfflineState(statusChannelId);
        }
    } catch (error) {
        console.log(`❌ Error al consultar la API: ${error.message}`);
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
