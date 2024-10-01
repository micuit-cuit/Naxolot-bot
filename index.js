require('json5/lib/register');
require('dotenv').config();
const { Client, Events, GatewayIntentBits } = require('discord.js');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const config = require('./config.json5');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
class serverMc {
    constructor(craftyToken, serverData) {
        this.craftyToken = craftyToken;
        this.serverId = serverData.id;
        this.serverName = serverData.name;
        this.serverActions = serverData.action;
    }
    action() {
        //convertir serverActions en un objet
        let actions = {};
        for (const action of this.serverActions) {
            actions[action.name] = action;
            //ajouter une fonction pour chaque action qui execute la fonction executeServerAction
            actions[action.name] = () => {
                this.executeServerAction(action);
            }
        }
        return actions;
    }
    executeServerAction(action) {
        if (action.type == 'command') {
            fetch(config.baseUrl+'/api/v2/servers/'+this.serverId+'/stdin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer '+this.craftyToken
                },
                body: action.command,
                rejectUnauthorized: false // Si vous avez un certificat SSL non valide (pour localhost)
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'error') {
                    console.error(data.message);
                    return;
                }
            });
            return;
        }
        fetch(config.baseUrl+'/api/v2/servers/'+this.serverId+'/action/'+action.command, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer '+this.craftyToken
            },
            body: JSON.stringify({
                action: action
            }),
            rejectUnauthorized: false // Si vous avez un certificat SSL non valide (pour localhost)
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'error') {
                console.error(data.message);
                return;
            }
        });
    }
}
//initialisation des servers



fetch(config.baseUrl+'/api/v2/auth/login', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        username: process.env.USERNAME_CRAFTY,
        password: process.env.PASSWORD_CRAFTY
    }),
    rejectUnauthorized: false // Si vous avez un certificat SSL non valide (pour localhost)
})
.then(response => response.json())
.then(data => {
    if (data.status === 'error') {
        console.error(data.message);
        return;
    }
    const craftyToken = data.data.token;
    let servers = []
    for (const server of config.servers) {
        servers.push(new serverMc(craftyToken, server))
        }
    startBot(servers);
})
function startBot(servers) {
    console.log('Bot starting...');
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });

    client.once(Events.ClientReady, readyClient => {
        console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    });
    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isCommand()) return;

        const { commandName } = interaction;

        if (commandName === 'execute') {
            //récupérer le serveur
            let serverName = interaction.options.getSubcommandGroup();
            let server = servers.find(server => server.serverName.toLowerCase() === serverName);
            //récupérer l'action
            let actionName = interaction.options.getSubcommand();
            let action = server.serverActions.find(action => action.name.toLowerCase() === actionName);
            server.action()[action.name]()
            interaction.reply('la commande a été executée sur le serveur '+serverName+', veuillez patienter quelques secondes')
        }
    });

    client.on(Events.ClientReady, async () => {
        let commands = [];
        commands.push(
            {
                name: 'execute',
                description: 'permer de controler un serveur',
                default_member_permissions: 8,//PermissionFlagsBits.ADMINISTRATOR,
                options: 
                    //pour chaque server on ajoute une option
                    servers.map(server => {
                        return {
                            name: server.serverName.toLowerCase(),
                            description: 'controler le serveur '+server.serverName,
                            type: 2,
                            options: server.serverActions.map(action => {
                                return {
                                    name: action.name.toLowerCase(),
                                    description: "executer l'action "+action.name,
                                    type: 1
                                }
                            })
                        }
                    })
                
            }
        );

        const guild = client.guilds.cache.get(config.guildId);
        await guild.commands.set(commands);

    });



    client.login(process.env.TOKEN_DISCORD);
}