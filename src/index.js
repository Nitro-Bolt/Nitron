const {
    Events,
    AuditLogEvent,
    ActivityType,
    ChannelType
} = require('discord.js');

const token = process.env.token;
const cloneDeep = require("lodash.clonedeep");

const client = require('./client');
const metrics = require('./metrics');

const tryRequire = (path) => {
    try {
        return require(path);
    } catch (e) {
        if (e.code === 'MODULE_NOT_FOUND') {
            return null;
        } else {
            throw e;
        }
    }
};

const starBoard = require('./modules/star-board');
const contactMods = require('./modules/contact-mods');
const purgeMessages = require('./modules/purge-messages');
const thread = require('./modules/thread');
const logging = require('./modules/logging');
const slowmode = require('./modules/slowmode');
const timeout = require('./modules/timeout');
const dmMail = require('./modules/dm-mail');
const hashImages = require('./modules/hash-images');
const bigBrother = tryRequire('./modules/big-brother');

const activityMessages = [
    'watching for thoughtcrime committers',
    'uncubester behaviour detected',
    'evilness soon',
    'Hi',
    'zap',
    'lat',
    'hello bolt',
    '💎',
    'eat lasagna',
    'nitrobolt soon',
    'nitrobort',
    '[4 attachments]'
];

client.once(Events.ClientReady, (client) => {
    console.log(`Logged in as ${client.user.tag}`);

    const setActivity = () => {
        client.user.setActivity({
            type: ActivityType.Custom,
            name: activityMessages[Math.floor(Math.random() * activityMessages.length)]
        });
    };
    setInterval(setActivity, 1000 * 60 * 60);
    setActivity();
});

let invites;

client.on(Events.ClientReady, async (client) => {
    setInterval(contactMods.ticketActivity, 1 * 60 * 1000);
    invites = await client.guilds.cache.first().invites.fetch();
});

metrics.on(Events.MessageCreate, async (message) => {
    try {
        if (message.partial) {
            await message.fetch();
        }

        if (message.author.id === client.user.id) {
            return;
        }

        if (bigBrother) await bigBrother.checkThoughtcrime(message);

        await dmMail.handleDirectMessage(message);

        if (message.channel.type !== ChannelType.DM) {
            await hashImages.checkInputAttachments(message);
        }

        await starBoard.autoReact(message);
    } catch (e) {
        console.error(e);
    }
});

metrics.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    try {
        if (newMessage.partial) {
            await newMessage.fetch();
        }

        if (newMessage.author.id === client.user.id) {
            return;
        }

        if (bigBrother) await bigBrother.checkThoughtcrime(newMessage);
        await logging.editedMessage(oldMessage, newMessage);
        await starBoard.onEditMessage(newMessage);
    } catch (e) {
        console.error(e);
    }
});

metrics.on(Events.MessageDelete, async (message) => {
    try {
        await logging.deletedMessage(message);
        await starBoard.onDeleteMessage(message);
    } catch (e) {
        console.error(e);
    }
});

metrics.on(Events.ThreadCreate, async (thread) => {
    try {
        await logging.createdThread(thread);
    } catch (e) {
        console.error(e);
    }
});

metrics.on(Events.ThreadUpdate, async (thread) => {
    try {
        if (thread.locked) await logging.closedThread(thread);
    } catch (e) {
        console.error(e);
    }
});

metrics.on(Events.ThreadDelete, async (thread) => {
    try {
        await logging.deletedThread(thread);
    } catch (e) {
        console.error(e);
    }
});

metrics.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    try {
        await logging.voiceChat(oldState, newState);
    } catch (e) {
        console.error(e);
    }
});

metrics.on(Events.InteractionCreate, async (interaction) => {
    try {
        if (!interaction.isCommand() && interaction.customId) {
            // for components and other non-slash commands
            // MODULE-NAME_INPUT_WITH_UNDERSCORES
            // the module should export runComponent(interaction, input) which is automatically handled here
            const commandModule = interaction.customId.split("_", 1);
            const moduleInput = interaction.customId.split("_").slice(1).join("_");
            const tempRequire = tryRequire(`./modules/${commandModule}`);

            if (!tempRequire) {
                console.error(`Attempted to use runComponent on module ${commandModule} but no such module was found.`);
            } else if (!tempRequire.runComponent) {
                console.error(`Attempted to use runComponent on module ${commandModule} but that function wasn't exported.`);
            } else {
                await tempRequire.runComponent(interaction, moduleInput);
            }
            return;
        }

        switch (interaction.commandName) {
            case 'contactmods':
                await contactMods.contactMods(interaction);
                break;
            case 'purge':
                await purgeMessages.purgeMessages(interaction);
                break;
            case 'closethread':
                await thread.close(interaction);
                break;
            case 'slowmode':
                await slowmode.slowmode(interaction);
                break;
            case 'timeout':
                await timeout.timeout(interaction);
                break;
            case 'botdm':
                await dmMail.handleSendDirectMessage(interaction);
                break;
            case 'mutedm':
                await dmMail.handleMuteDirectMessage(interaction);
                break;
            case 'hashimages':
                await hashImages.hashNewAttachment(interaction);
                break;
            case 'Report User':
                await contactMods.reportUser(interaction);
                break;
            case 'Report Message':
                await contactMods.reportMessage(interaction);
                break;
            case 'Thread owner: Pin':
                await thread.pin(interaction);
                break;
            case 'Thread owner: Unpin':
                await thread.unpin(interaction);
                break;
        }
    } catch (e) {
        console.error(e);
    }
});

metrics.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
        await starBoard.onReaction(reaction, user);
    } catch (e) {
        console.error(e);
    }
});

metrics.on(Events.MessageReactionRemove, async (reaction, user) => {
    try {
        await logging.onReactionRemove(reaction, user);
    } catch (e) {
        console.error(e);
    }
});

metrics.on(Events.MessageReactionRemoveEmoji, async (reaction) => {
    try {
        await logging.onReactionRemovedByModerator(reaction);
    } catch (e) {
        console.error(e);
    }
});

metrics.on(Events.MessageReactionRemoveAll, async (message) => {
    try {
        await logging.onAllReactionsRemovedByModerator(message);
    } catch (e) {
        console.error(e);
    }
});

metrics.on(Events.GuildMemberAdd, async (member) => {
    try {
        await logging.userJoin(member,cloneDeep(invites));
    } catch (e) {
        console.error(e);
    }
});

metrics.on(Events.GuildMemberRemove, async (member) => {
    try {
        await logging.userLeave(member);
    } catch (e) {
        console.error(e);
    }
});

metrics.on(Events.GuildAuditLogEntryCreate, async (auditLog) => {
    try {
        await logging.auditLogs(auditLog);
        if (auditLog.action == AuditLogEvent.InviteCreate) {
            invites = await client.guilds.cache.first().invites.fetch();
        };
    } catch (e) {
        console.error(e);
    }
});

metrics.listen();
client.login(token);
