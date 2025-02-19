// -----------------------IMPORTS-----------------------
const { CommandInteraction, Guild } = require('discord.js');
const { readFileSync, writeFileSync } = require('node:fs');
const { getPrettyTime } = require(`./general_helper`);
const { MessageFlags } = require('discord.js');

/**
 * Gets the bot's token from `./main_config.json`.
 * @returns {String}
 */
function getToken() {
    return JSON.parse(readFileSync(`./main_config.json`)).token;
}

/**
 * Gets the client ID from `./main_config.json`.
 * @returns {String}
 */
function getClientId() {
    return JSON.parse(readFileSync(`./main_config.json`)).clientId;
}

/**
 * Get's the relevant user info stated in the return statement.
 * This is invoked from the `who-am-i` command.
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @returns {{age: Number, name: String, id: String}}
 */
function getUserInfoJson(interaction) {
    const info = {};
    info.age = getPrettyTime(new Date().getTime() - interaction.user.createdAt.getTime());
    info.name = interaction.user.usename;
    info.id = interaction.user.id;
    return info;
}

/**
 * Get's the relevant guild info stated in the return statement.
 * This is invoked from the `where-am-i` command.
 * @param {(CommandInteraction|Guild)} interaction The command interaction invoked by a user or the Discord bot client.
 * @param {Boolean} guild_only Indicates whether `interaction` is a guild or not.
 * @returns {{age: Number, id: Number, name: String, number_of_members: Number, 
 *            description: String, emoji_cont: Number, joined_for?: Number,
 *            role_count: Number, scheduled_events_count: Number, sticker_count: Number
 *            verified: Boolean}}
 */
function getGuildInfoJson(interaction, guild_only=false) {
    const guild = (guild_only) ? interaction : interaction.guild;
    const info = {};
    info.age = getPrettyTime(new Date().getTime() - guild.createdAt.getTime());
    info.id = guild.id;
    info.name = guild.name;
    info.number_of_members = guild.memberCount;
    // info.owner_id = guild.ownerId;
    info.description = (guild.description == null) ? 'EMPTY' : guild.description;
    info.emoji_count = guild.emojis.cache.length;
    if (!guild_only) info.joined_for = getPrettyTime(new Date().getTime() - interaction.member.joinedAt.getTime());
    info.role_count = guild.roles.cache.length;
    info.scheduled_events_count = guild.scheduledEvents.cache.length;
    info.sticker_count = guild.stickers.cache.length;
    info.verified = guild.verified;
    return info;
}

/**
 * Generates a message link from the `info` parameter.
 * @param {{guild_id: String, info_id: String, message_id: String}} info The information reqiured to assemble a message link.
 * @returns {String}
 */
function generateLink(info) {
    return `https://discord.com/channels/${info.guild_id}/${info.channel_id}/${info.message_id}`;
}

/**
 * Checks whether a user is in a guild or not.
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @param {String} user_id The user ID of some user.
 * @returns {Boolean} `true` means that the user indexed by `user_id` is in the server.
 */
function isUserInGuild(interaction, user_id) {
    return interaction.guild.members.cache.has(toString(user_id));
}

/**
 * Checks whether a user is in the guild the `interaction` was sent from or not.
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @param {String} role_id The role ID of a role in the guild the user who sent `interaction` is in.
 * @returns {Boolean} `true` means that the role indexed by `role_id` is in the server.
 */
function isRoleInGuild(interaction, role_id) {
    return interaction.guild.roles.cache.has(toString(role_id));
}

/**
 * Checks a message is a Discord message link or not.
 * @param {String} message The message to be checked.
 * @returns {Boolean} `true` means it is a message link.
 */
function isMessageUrl(message) {
    return /https:\/\/discord\.com\/channels\/(.*)\/(\d*)\/(\d*)/.test(message);
}

/**
 * Gets the guild ID, channel Id, and message Id from a message link.
 * @param {String} message The message to be parsed.
 * @returns {[String]} The elements are `[guild_id, channel_id, message_id]` every time.
 */
function getMessageUrlInfo(message) {
    return message.match(/https:\/\/discord\.com\/channels\/(.*)\/(\d*)\/(\d*)/).slice(1, 4);
}

/**
 * Checks that if the bot sent the message and returns the relevant information.
 * If the bot didn't send the message, it calls {@link getMessageLocation} to find
 * the message. This is used for the `automated-message-editing` command group.
 * @todo maybe move this to be a method of a command in `automated-message-editing`
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @param {String} guild_id The ID of the guild the message is in.
 * @param {String} channel_id The ID indexing the channel the message to be searched for is in.
 * @param {String} message_id The ID indexing the message to be searched for.
 * @param {[String]} history Only use is to support recursion of {@link getMessageLocation}.
 * @returns {Promise<[String]>} The elements are `[guild_id, channel_id, message_id]` every time.
 */
async function findChainedMessage(interaction, guild_id, channel_id, message_id, history=[]) {
    if (interaction.client.user.id != interaction.client.guilds.cache.get(guild_id).channels.cache.get(channel_id).messages.cache.get(message_id).author.id) {
        return await getMessageLocation(interaction, {message_id: message_id, channel_id: channel_id, guild_id: guild_id}, history);
    } else {
        return [guild_id, channel_id, message_id];
    }
}

/**
 * Checks whether a message is a message ID or message link and recursively searches through
 * found message IDs/links to find the root message. The end goal is to find a message sent by
 * the bot. This is used for the `automated-message-editing` command group.
 * @todo maybe move this to be a method of a command in `automated-message-editing`
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @param {String} identifier The message identifier of message to search for.
 * @param {[String]} history Used for detecting infinite loops in recursion.
 * @returns {Promise<[String]>} The elements are `[guild_id, channel_id, message_id]` every time.
 */
async function getMessageLocation(interaction, identifier, history=[]) {
    console.log(identifier);
    const checkInfiniteLoop = (message_id) => { if (history.includes(message_id)) throw new Error("infinite loop detected >:("); };
    if (typeof identifier == 'object') {
        identifier = (await interaction.client.guilds.cache.get(identifier.guild_id).channels.cache.get(identifier.channel_id).messages.fetch(identifier.message_id)).content;
    }
    if (isMessageUrl(identifier)) {
        const [guild_id, channel_id, message_id] = getMessageUrlInfo(identifier);
        await interaction.client.guilds.cache.get(guild_id).channels.cache.get(channel_id).messages.fetch(message_id);
        checkInfiniteLoop(message_id);
        history.push(message_id);
        return await findChainedMessage(interaction, guild_id, channel_id, message_id, history);
    } else if (/(?:(?:.|\s)*?)\d+(?:(?:.|\s)*)/.test(identifier)) {
        const message_id = identifier.match(/(?:(?:.|\s)*?)\d+(?:(?:.|\s)*)/)[0];
        const channels = interaction.guild.channels.cache;
// STILL BOUND TO PRESENT GUILD
        for (const channel of channels) {
            let content = null;
            try {
                content = ((await channel[1]?.messages?.fetch(message_id))?.content);
            } catch (e) { e == e; }
            if (content != null && content != undefined) {
                checkInfiniteLoop(message_id);
                history.push(message_id);        
                return await findChainedMessage(interaction, interaction.guild.id, channel[0], message_id, history);
            }
        }
    }
    return [null, null, null];
}

/**
 * Checks whether a message is a message ID or message link and recursively searches through
 * found message IDs/links to find the root message. Once the message is no longer an identifier 
 * for another message, it is returned. \
 * **Note:** Message URLs can be cross-guild; Message IDs cannot.
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @param {String} message The message to be searched for or returned.
 * @param {[String]} history Used for detecting infinite loops in recursion.
 * @returns {Promise<String>}
 */
async function getMessageContent(interaction, message, history=[]) {
    if (isMessageUrl(message)) { // if message link
        const [guild_id, channel_id, message_id] = getMessageUrlInfo(message);
        if (history.includes(message_id)) throw new Error("infinite loop detected >:(");
        let content = null;
        try {
            history.push(message_id);
            await interaction.client.guilds.fetch();
            const guild = interaction.client.guilds.cache.get(guild_id);
            await guild.channels.fetch();
            const channel = guild.channels.cache.get(channel_id);
            content = (await channel.messages.fetch(message_id)).content;
        } catch (e) { e == e; return message; }
        return await getMessageContent(interaction, content, history);
    } else if (/(?:(?:.|\s)*?)\d+(?:(?:.|\s)*)/.test(message)) { // if message id
        const message_id = message.match(/(?:(?:.|\s)*?)\d+(?:(?:.|\s)*)/)[0];
        if (history.includes(message_id)) throw new Error("infinite loop detected >:(");
        history.push(message_id);
        if (interaction.guild == undefined || interaction.guild == null) return message_id;
        await interaction.client.guilds.fetch();
        const channels = interaction.guild.channels.cache;
        for (const channel of channels) {
            let content = null;
            try {
                content = ((await channel[1]?.messages?.fetch(message_id))?.content);
            } catch (e) { e == e; }
            if (content != null && content != undefined)
                return await getMessageContent(interaction, content, history);
        } 
    }
    return message;
}

/**
 * Sends a reply to an interaction. If the response has been replied to already or is deferred,
 * it sends a follow up instead.
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @param {String} body The message content.
 * @param {Boolean} ephemerality Whether the message should be ephemeral (visible to only the sender) or not. `true` means ephemeral.
 */
async function reply(interaction, body, ephemerality=null) {
    if (ephemerality == null) ephemerality = !(await interaction.client.global_databases.get('preferences').getSetting(interaction, 'are_messages_visible'));
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: body.content, flags: ((ephemerality) ? MessageFlags.Ephemeral : undefined) });
    } else {
        await interaction.reply({ content: body.content, flags: ((ephemerality) ? MessageFlags.Ephemeral : undefined) });
    }
}

/**
 * Defers a response.
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @param {String} body The message content.
 * @param {Boolean} ephemerality Whether the message should be ephemeral (visible to only the sender) or not. `true` means ephemeral.
 */
async function deferReply(interaction, body, ephemerality=null) {
    if (ephemerality == null) ephemerality = !(await interaction.client.global_databases.get('preferences').getSetting(interaction, 'are_messages_visible'));
    await interaction.deferReply({ content: body.content, flags: ((ephemerality) ? MessageFlags.Ephemeral : undefined) });
}

/**
 * Edits a response.
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @param {String} body The message content.
 * @param {Boolean} ephemerality Whether the message should be ephemeral (visible to only the sender) or not. `true` means ephemeral.
 */
async function editReply(interaction, body, ephemerality=null) {
    if (ephemerality == null) ephemerality = !(await interaction.client.global_databases.get('preferences').getSetting(interaction, 'are_messages_visible'));
    await interaction.editReply({ content: body.content, flags: ((ephemerality) ? MessageFlags.Ephemeral : undefined) });
}

/**
 * Checks whether a message is a user id, role id, channel id, or guild id based 
 * on the `type` passed.
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @param {String} id the ID to be checked. 
 * @param {("user_id"|"role_id"|"channel_id"|"message_id"|"guild_id")} type the type of id to check for.
 * @returns {Promise<Boolean>} 
 */
async function checkId(interaction, id, type) {
    let channels = null;
    let content = null;
    switch (type) {
        case "user_id":
            return await interaction.guild.members.cache.has(id);
        case "role_id":
            return await interaction.guild.roles.cache.has(id);
        case "channel_id":
            return await interaction.guild.channels.cache.has(id);
        case "message_id":
            channels = interaction.guild.channels.cache;
            content = undefined;
            for (const channel of channels) {
                try {
                    content = ((await channel[1]?.messages?.has(id)));
                    break;
                } catch (e) { e == e; }
            } 
            return (content == undefined);
            case "guild_id":
                return interaction.client.guilds.cache.has(id);
        default:
            return false;
    }
}

/**
 * Changes the internally stored bot name. The returned name should be what the new
 * bot nickname should be changed to.
 * @param {CommandInteraction} interaction The command interaction invoked by a user.
 * @param {String} name The nickname the bot should be changed to.
 * @returns {String}
 */
function changeBotName(interaction, name='') {
    if (name == null || name == undefined || name == '') {
        name = interaction.client.user.username;
    }
    const settings = JSON.parse(readFileSync(`./guilds/${interaction.guild.id}/jsons/settings.json`, 'utf8'));
    settings.bot_name = name;
    writeFileSync(`./guilds/${interaction.guild.id}/jsons/settings.json`, JSON.stringify(settings, null, 2));
    return name;
}

// -----------------------EXPORTS-----------------------
module.exports = { 
                    getToken,
                    getClientId,
                    getUserInfoJson,
                    getGuildInfoJson,
                    generateLink,
                    isUserInGuild,
                    isRoleInGuild,
                    getMessageContent,
                    getMessageLocation,
                    reply,
                    deferReply,
                    editReply,
                    checkId,
                    changeBotName
                };