const { MessageFlags, PermissionsBitField } = require('discord.js');
const db = require('../db-bots');

const unblock = async (interaction) => {
    const user = interaction.options.getUser('user');
    const removed = db.prepare(`
        DELETE FROM tracked_ids WHERE userid = ?
    `).run(user.id);

    if (removed) {
        return interaction.reply({ content:`Successfully unblocked ${user.mention}.`, flags:MessageFlags.Ephemeral });
    };
    await interaction.reply({ content:"That user was already unblocked.", flags:MessageFlags.Ephemeral });
}

module.exports = {
  unblock
};