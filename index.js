require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType, EmbedBuilder } = require('discord.js');
const { statusJava } = require('mcstatus.js');

// Crear cliente de Discord con permisos necesarios
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // Requerido para evento de bienvenida
        GatewayIntentBits.GuildMessages
    ]
});

// Guardar el estado previo para solo enviar mensajes al cambiar
let lastServerStatus = null;

client.once('ready', () => {
    console.log(`🤖 Bot conectado exitosamente como: ${client.user.tag}`);
    console.log('📡 Monitoreando servidor de Minecraft...');
    
    // Comprobar estado de inmediato y luego cada 60 segundos
    checkMinecraftServer();
    setInterval(checkMinecraftServer, 60000);
});

// Evento: Nuevo usuario se une al servidor
client.on('guildMemberAdd', async (member) => {
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

// Función para revisar estado del servidor de Minecraft
async function checkMinecraftServer() {
    const host = process.env.MC_HOST;
    const port = parseInt(process.env.MC_PORT) || 25565;
    const statusChannelId = process.env.CHANNEL_STATUS_ID;

    if (!host) {
        console.error('❌ Error: MC_HOST no está configurado en las variables de entorno.');
        return;
    }

    try {
        const response = await statusJava(host, port);
        const isOnline = response && response.online !== false;

        if (isOnline) {
            const playersOnline = response.players ? response.players.online : 0;
            const playersMax = response.players ? response.players.max : 0;

            // Actualizar presencia del bot
            client.user.setActivity(`🟢 En línea (${playersOnline}/${playersMax})`, { type: ActivityType.Custom });

            // Notificar cambio de APAGADO a ENCENDIDO
            if (lastServerStatus === false || lastServerStatus === null) {
                if (lastServerStatus === false) {
                    await sendStateChangeNotice(statusChannelId, true, playersOnline, playersMax);
                }
                lastServerStatus = true;
            }
        } else {
            await setOfflineState(statusChannelId);
        }
    } catch (error) {
        await setOfflineState(statusChannelId);
    }
}

// Cambiar estado a Offline y notificar caída si aplica
async function setOfflineState(channelId) {
    client.user.setActivity('🔴 Servidor apagado', { type: ActivityType.Custom });

    if (lastServerStatus === true) {
        await sendStateChangeNotice(channelId, false);
    }
    lastServerStatus = false;
}

// Enviar Embed al canal de estado
async function sendStateChangeNotice(channelId, isOnline, onlinePlayers = 0, maxPlayers = 0) {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;

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
    } else {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🔴 Servidor Apagado')
            .setDescription('El servidor de Minecraft se encuentra actualmente fuera de línea.')
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    }
}

// Conectar a Discord
client.login(process.env.DISCORD_TOKEN);
