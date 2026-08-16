const {
    MessageFlags,
    ContainerBuilder,
    ButtonBuilder,
    ButtonStyle,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    AttachmentBuilder,
    TextDisplayBuilder,
    ActionRowBuilder,
    Colors
} = require('discord.js');
const imghash = require('imghash');
const sharp = require('sharp');
const db = require('../db.js');
const { newHashedImage, deleteHashedImage, removeHashedImage } = require('./logging.js');
const { modChannelId } = process.env;

db.prepare(`
    CREATE TABLE IF NOT EXISTS attachmentHashes (
        id INTEGER PRIMARY KEY,
        hash TEXT NOT NULL,
        buffer BLOB NOT NULL
    )
`).run();

const getHashes = db.prepare(`SELECT id, hash, buffer FROM attachmentHashes`);
const removeHash = db.prepare(`
    DELETE FROM attachmentHashes
    WHERE id = ?
    RETURNING *
`);

async function normalizeBuffer(buffer) {
    const normalized = await sharp(buffer)
        .resize(256, 256, { fit: 'fill' })
        .grayscale()
        .flatten()
        .png()
        .toBuffer();
    
    return normalized;
}

function viewHashedImage(interaction, page) {
    page = Number.parseInt(page);
    const hashes = getHashes.all();
    const thisHash = hashes[page];

    const noImagesComponent = new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent("There are no hashed images to view. Add a hashed image by specifying the `adding` input on this command")
        )
        .setAccentColor(Colors.Orange);

    if (!thisHash) {
        return interaction.isButton()
        ? interaction.update({ components: [noImagesComponent], flags: MessageFlags.IsComponentsV2 })
        : interaction.reply({ components: [noImagesComponent], flags: MessageFlags.IsComponentsV2 });
    }

    const attachmentData = new AttachmentBuilder(thisHash.buffer, { name: `hashedAttachment_${thisHash.id}.png` });
    const pageComponent = new ContainerBuilder()
        .addMediaGalleryComponents(
            new MediaGalleryBuilder()
                .addItems(
                    new MediaGalleryItemBuilder()
                        .setURL(`attachment://hashedAttachment_${thisHash.id}.png`)
                        .setDescription("This is a hashed image!")
                )
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent(`ID: ${thisHash.id}`)
        );

    const row = new ActionRowBuilder();
    if (page > 0) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`hash-images_page_${page-1}`)
                .setEmoji("◀️")
                .setStyle(ButtonStyle.Primary)
        );
    }

    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`hash-images_delete_${thisHash.id}`)
            .setLabel("Delete Hash")
            .setStyle(ButtonStyle.Danger)
    );

    if (page < hashes.length - 1) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`hash-images_page_${page+1}`)
                .setEmoji("▶️")
                .setStyle(ButtonStyle.Primary)
        );
    }

    pageComponent.addActionRowComponents(row);
    interaction.isButton()
    ? interaction.update({ files: [ attachmentData ], components: [ pageComponent ], flags: MessageFlags.IsComponentsV2 })
    : interaction.reply({ files: [ attachmentData ], components: [ pageComponent ], flags: MessageFlags.IsComponentsV2 });
}

async function runComponent(interaction, input) {
    let [ op, page ] = input.split("_");

    switch (op) {
        case "page":
            break; // fall through
        case "delete":
            const removed = removeHash.get(page);
            await removeHashedImage(removed, interaction.user);
            page = Math.max(0, page - 1);
            break;
    }
    await viewHashedImage(interaction, page);
}

async function checkInputAttachments(message) {
    const attachments = message.attachments.values();
    const hashes = getHashes.all();
    const flagged = [];

    for (const attachment of attachments) {
        try {
            const urlFetch = await fetch(attachment.url);
            const buffer = Buffer.from(await urlFetch.arrayBuffer());
            const hashBuffer = await normalizeBuffer(buffer);
            const thisHash = String(await imghash.hash(hashBuffer, 16));

            for (const testHash of hashes) {
                const xor = BigInt("0x" + thisHash) ^ BigInt("0x" + testHash.hash);
                const difference = xor.toString(2)
                                    .split("")
                                    .filter(bit => bit === "1")
                                    .length;
                const similarity = (1 - difference / 16**2) * 100;

                if (similarity >= 85) { // 85% or more of the image matches this hash
                    flagged.push({ "flaggedAttachment": buffer, "flaggedId": testHash.id, "similarity": similarity });
                    break;
                }
            };
        } catch (err) {
            console.error(`Couldn't check attachment: ${err}`);
        }
    };

    if (flagged.length) {
        await deleteHashedImage(flagged, message);
        await message.delete();
    }
}

async function hashNewAttachment(interaction) {
    const attachment = interaction.options.getAttachment("adding");

    if (attachment) {
        if (![ "image/png", "image/jpeg" ].includes(attachment.contentType)) {
            return interaction.reply({ "content": "This command only accepts PNGs or JPEGs", flags: MessageFlags.Ephemeral });
        }

        const urlFetch = await fetch(attachment.url);
        const buffer = Buffer.from(await urlFetch.arrayBuffer());
        const hashBuffer = await normalizeBuffer(buffer);
        const hash = String(await imghash.hash(hashBuffer, 16));

        db.prepare(`
            INSERT INTO attachmentHashes (hash, buffer)
            VALUES (?, ?)
        `).run(hash, buffer);
        await newHashedImage(buffer, hash, interaction.user);
        return interaction.reply({ content: "Successfully hashed image", flags: MessageFlags.Ephemeral });
    } else {
    if (interaction.channel.id != modChannelId) {
        return interaction.reply({ "content": `This command can only be used in <#${modChannelId}>`, flags: MessageFlags.Ephemeral });
    }
    viewHashedImage(interaction, 0);
    }
}

module.exports = {
    checkInputAttachments, // actively used
    hashNewAttachment, // slash command
    runComponent // component of course
}