const db = require('../db-bots');
const imghash = require('imghash');

// if an invite link contains these, it's deleted and the user is kicked
const terms = ["NSFW", "+18", "18+", "🔞"]

async function kickMember(message) {
    db.prepare(`
        INSERT OR IGNORE INTO tracked_ids (user_id, created) VALUES (?, ?)    
    `).run(message.author.id, Date.now());

    await message.delete();
    try {
        await message.member.send("You have been automatically kicked for suspicion of being a bot. Please rejoin later.");
        await message.member.kick("Automatic bot kick.");
    } catch (err) { console.error(`Could not kick suspected bot: ${err}`) };
}

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

async function checkMessage(message) {
    // hashed images
    if (message.attachments.size > 0) {
        Array.from(message.attachments.values()).forEach(attachment => {
            try {
                const res = await fetch(attachment.url);
                const buffer = await res.arrayBuffer();
                const hash = await imghash.hash(Buffer.from(buffer), 16);
                for (const row of db.prepare(`SELECT hash FROM image_hashes`).all()) {
                    if (hammingDistance(row.hash, hash) <= 8) {
                        kickMember(message); break;
                    }
                }
            } catch (err) {
                console.warn("Failed to hash image")
            }
        });
    }

    // links
    for (const row of db.prepare(`SELECT link FROM scam_links`).all()) {
        if (message.content.contains(row)) {
            kickMember(message); break;
        }
    }

    // invites
    if (message.content.includes("discord.gg/")) {
        console.log("detected invite")
        const code = message.content.split("discord.gg/")[1].split(" ")[0]; // get before space incase there's anything before or after the invite code
        const build = `https://discord.com/api/v10/invites/${code}`;
        const res = await fetch(build);
        const data = await res.json();
        console.log(build, data)
        for (const term of terms) {
            if (data.profile.name.toUpperCase().includes(term) || data.channel.name.toUpperCase().includes(term)) {
                kickMember(message); break;
            }
        };
    }
}

module.exports = { checkMessage };