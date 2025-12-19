import DiscordJS from "discord.js"
import {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from "discord.js";

export const getModal = (message: DiscordJS.Message<boolean>) => {
    const modal = new ModalBuilder()
        .setTitle("Create github issue")
        .setCustomId("AwesomeForm");

    const issueTitle = new TextInputBuilder()
        .setStyle(TextInputStyle.Short)
        .setCustomId("issueTitle")
        .setLabel("Issue title");

    const issueDescription = new TextInputBuilder()
        .setStyle(TextInputStyle.Paragraph)
        .setCustomId("issueDescription")
        .setLabel("Issue description")
        .setValue(`${message}\n\n---\n_Issue created by ${message.author.tag} [via Discord](${message.url})_`);

    const rows = [issueTitle, issueDescription].map((component) =>
        new ActionRowBuilder<TextInputBuilder>().addComponents([component])
    );

    // Add action rows to form
    modal.addComponents(rows);

    return modal;
};
