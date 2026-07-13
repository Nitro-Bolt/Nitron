const {PermissionsBitField, MessageType, DMChannel} = require('discord.js');
const client = require('../client');
const db = require('../db');
const config = require('../../config');

const isPublicChannel = (channel) => {
    if (channel instanceof DMChannel) return false;

    const DISABLED_CHANNELS = [
        config.starboardChannelId,
        '1202712912783999067', // #updates
        '1202712865887494234', // #readme

        '1349407494501568603', // ?? Deleted channels, most likely old wayback machines
        '1349407854108479528',
    ];
    if (DISABLED_CHANNELS.includes(channel.id)) return false;

    const guild = channel.guild;
    const everyone = guild.roles.everyone;
    const permissions = channel.permissionsFor(everyone);
    return [
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.AddReactions
    ].every(i => permissions.has(i));
};

/**
 * @param {import('discord.js').Message} message
 * @returns {string|null}
 */
const stringifyMessageContent = (message) => {
    if (message.system) {
        switch (message.type) {
            case MessageType.UserJoin:
                return 'Joined the server';
            case MessageType.GuildBoost:
                return 'Boosted the server';
            case MessageType.GuildBoostTier1:
                return 'Boosted the server and made it reach level 1';
            case MessageType.GuildBoostTier2:
                return 'Boosted the server and made it reach level 2';
            case MessageType.GuildBoostTier3:
                return 'Boosted the server and made it reach level 3';
            case MessageType.PollResult:
                return `Poll ended with ${message.embeds[0].data.fields[4] ? "winner: " + message.embeds[0].data.fields[4].value : "no winner"}`;
            case MessageType.ChannelPinnedMessage:
                return 'Pinned a message to this channel';
            case MessageType.ThreadCreated:
                return 'Created a thread';
            case MessageType.RecipientAdd:
                return `Added <@${message.mentions.users.first().id}> to a thread`;
            case MessageType.RecipientRemove:
                return `Removed <@${message.mentions.users.first().id}> from a thread`;
            default:
                return `!!!!! Unknown message type ${message.type} !!!!!`;
        }
    }

    let content = message.content;
    if (message.messageSnapshots.size > 0) {
        content = `-# *↱ Forwarded message:*\n${message.messageSnapshots.first().content}`;
    } else if (message.poll) {
        content = `-# *Poll*\n${message.poll.question.text}`;
        let answers = message.poll.answers.map(answer => answer);
        for (let i = 0; i < answers.length; i++) {
            content += `\n${message.poll.allowMultiselect ? "☐" : "◯"} `;
            if (answers[i].emoji) {
                if (answers[i].emoji && answers[i].emoji.id) {
                    content += `:${answers[i].emoji.name}: `;
                } else if (answers[i].emoji) {
                    content += answers[i].emoji.name + " ";
                }
            }
            content += answers[i].text;
        }
    }

    return content;
};

class Board {
    constructor(options) {
        this.name = options.name;
        this.table = options.table;
        this.emoji = options.emoji;
        this.threshold = options.threshold;
        this.colors = options.colors;
        this.channelId = options.channelId ?? config.starboardChannelId;

        db.exec(`
            CREATE TABLE IF NOT EXISTS ${this.table} (
                original_message_id TEXT NOT NULL UNIQUE,
                starboard_message_id TEXT NOT NULL,
                count INT NOT NULL
            );
        `);
        db.exec(`CREATE INDEX IF NOT EXISTS ${this.table}_index ON ${this.table} (original_message_id);`);

        this.addNew = db.prepare(`
            INSERT OR IGNORE INTO ${this.table} (
                original_message_id,
                starboard_message_id,
                count
            ) VALUES (?, -1, 0);
        `);

        this.get = db.prepare(`SELECT starboard_message_id, count FROM ${this.table} WHERE original_message_id = ?;`);
        this.setId = db.prepare(`UPDATE ${this.table} SET starboard_message_id = ? WHERE original_message_id = ?;`);
        this.setCount = db.prepare(`UPDATE ${this.table} SET count = ? WHERE original_message_id = ?;`);
    }

    isOnOtherBoard(messageId) {
        if (!this.otherBoard) return false;
        const row = this.otherBoard.get.get(messageId);
        return row && BigInt(row.starboard_message_id) > 0;
    }

    async updateMessage(message) {
        await message.fetch();
        const boardChannel = await client.channels.fetch(this.channelId);

        const starting = this.get.get(message.id);
        const content = stringifyMessageContent(message);

        const embedMessage = {
            allowedMentions: {},
            content: `${this.emoji} **${starting.count}** - ${message.url} (<@${message.author.id}>)`,
            embeds: [
                {
                    color: this.colors[BigInt(message.id) % BigInt(this.colors.length)],
                    author: {
                        name: message.author.displayName,
                        url: message.url,
                        icon_url: message.author.displayAvatarURL()
                    },
                    ...(content ? { description: content } : {}),
                    timestamp: new Date(message.createdTimestamp).toISOString()
                }
            ]
        };

        const attachments = message.messageSnapshots.size > 0
            ? message.messageSnapshots.first().attachments
            : message.attachments;

        if (BigInt(starting.starboard_message_id) < 0) {
            embedMessage.files = attachments.map(i => ({ name: i.name, attachment: i.url }));

            const posted = await boardChannel.send(embedMessage);
            this.setId.run(posted.id, message.id);

            const ending = this.get.get(message.id);
            if (BigInt(ending.starboard_message_id) < 0) {
                await posted.delete();
            } else if (ending.count !== starting.count) {
                await this.updateMessage(message);
            }
        } else {
            const posted = await boardChannel.messages.fetch(starting.starboard_message_id).catch(() => null);
            if (posted) await posted.edit(embedMessage);
        }
    }

    async onReaction(reaction) {
        await reaction.fetch();
        if (reaction.emoji.name !== this.emoji) return;

        const message = reaction.message;

        if (this.isOnOtherBoard(message.id)) return;

        const existing = this.get.get(message.id);

        if (existing) {
            // only store the largest count
            if (reaction.count > existing.count) {
                this.setCount.run(reaction.count, message.id);
                // if it hasn't been posted yet, don't do anything, the new count will be picked up automatically
                // if the message is still valid
                if (BigInt(existing.starboard_message_id) > 0) {
                    await this.updateMessage(message);
                }
            }
        } else if (reaction.count >= this.threshold) {
            this.addNew.run(message.id);

            const channel = message.channel;
            await channel.fetch();
            if (!isPublicChannel(channel)) return;

            this.setCount.run(reaction.count, message.id);
            await this.updateMessage(message);
        }
    }

    async onDeleteMessage(message) {
        // delete the starboard message if the original got deleted
        const existing = this.get.get(message.id);
        if (!existing) return;

        this.setId.run(-1, message.id);

        if (BigInt(existing.starboard_message_id) > 0) {
            const boardChannel = await client.channels.fetch(this.channelId);
            const posted = await boardChannel.messages.fetch(existing.starboard_message_id).catch(() => null);
            if (posted) await posted.delete();
        }
    }

    async onEditMessage(message) {
        const existing = this.get.get(message.id);
        if (existing && BigInt(existing.starboard_message_id) > 0) {
            await this.updateMessage(message);
        }
    }
}

const starboard = new Board({
    name: "starboard",
    table: "starboard",
    emoji: "⚡",
    threshold: 7,
    colors: [0xfe5726, 0xffa126, 0xff2626],
    channelId: config.starboardChannelId
});

const evilboard = new Board({
    name: "evilboard",
    table: "evilboard",
    emoji: "🌱",
    threshold: 7,
    colors: [0x99F762, 0x88DB57, 0x77C04C],
    channelId: config.evilboardChannelId
});

starboard.otherBoard = evilboard;
evilboard.otherBoard = starboard;

module.exports = {
    stringifyMessageContent,
    onReaction: async (reaction) => {
        await starboard.onReaction(reaction);
        await evilboard.onReaction(reaction);
    },
    onDeleteMessage: async (message) => {
        await starboard.onDeleteMessage(message);
        await evilboard.onDeleteMessage(message);
    },
    onEditMessage: async (message) => {
        await starboard.onEditMessage(message);
        await evilboard.onEditMessage(message);
    }
};

