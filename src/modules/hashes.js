const { MessageFlags, PermissionsBitField } = require('discord.js');
const db = require('../db-bots');
const imghash = require('imghash');

const hash = async (interaction) => {
    const action = interaction.options.getString("action");
    const image = interaction.options.getAttachment('image');
    const res = await fetch(image.url);
    const buffer = await res.arrayBuffer();
    const hash = await imghash.hash(Buffer.from(buffer), 16);
    await interaction.deferReply();
    if (action == "add") {
        db.prepare(`
            INSERT OR IGNORE INTO image_hashes (hash) VALUES (?)    
        `).run(hash);
        await interaction.editReply({ content:"Successfully hashed the given image:", files:[{ attachment:Buffer.from(buffer), name:"SPOILER_hashed.png" }] })
    } else if (action == "del") {
        const deleted = db.prepare(`
            DELETE FROM image_hashes WHERE hash = ?
        `).run(hash);
        if (deleted) {
            return interaction.editReply("Successfully deleted image from hash list.");
        };
        await interaction.editReply("No image was found to delete.")
    }
}

module.exports = {
  hash
};