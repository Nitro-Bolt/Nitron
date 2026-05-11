const { MessageFlags, PermissionsBitField } = require('discord.js');
const db = require('../db-bots');
const imghash = require('imghash');
const { modChannelId } = require('../../config.js');

// copied lazily from scan-messages.js
function hammingDistance(hash1, hash2) {
    const big1 = BigInt('0x' + hash1);
    const big2 = BigInt('0x' + hash2);
    let biggest = big1 ^ big2;
    let dist = 0;
    while (biggest) {
        dist += Number(biggest & 1n);
        biggest >>= 1n;
    }
    return dist;
}

const hash = async (interaction) => {
    if (interaction.channel.id !== modChannelId) {
        interaction.reply({
            content: `/hashes must be used in <#${modChannelId}> to ensure that other moderators are aware`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const action = interaction.options.getString("action");
    const image = interaction.options.getAttachment('image');
    const res = await fetch(image.url);
    const buffer = await res.arrayBuffer();
    const hash = await imghash.hash(Buffer.from(buffer), 16);
    await interaction.deferReply();
    switch (action) {
        case "add": {
            db.prepare(`
                INSERT OR IGNORE INTO image_hashes (hash) VALUES (?)    
            `).run(hash);
            await interaction.editReply({ content:"Successfully hashed the given image:", files:[{ attachment:Buffer.from(buffer), name:"SPOILER_hashed.png" }] });
            break;
        }
        case "del": {
            let deleted = 0;
            for (const row of db.prepare(`SELECT hash FROM image_hashes`).all()) {
                if (hammingDistance(row.hash, hash) <= 8) {
                    deleted = db.prepare(`
                        DELETE FROM image_hashes WHERE hash = ?
                    `).run(hash); break;
                }
            }
            if (deleted) {
                return interaction.editReply("Successfully deleted image from hash list.");
            };
            await interaction.editReply("No image was found to delete.");
            break;
        }
    };
}

module.exports = {
  hash
};