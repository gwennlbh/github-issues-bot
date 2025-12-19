import DiscordJS from "discord.js"
import dotenv from "dotenv"
import { Octokit } from "@octokit/rest"
import { getModal } from "./utils"
import express from "express"
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

app.get("/", (req, res) => {
  res.send("Github issues bot!")
})

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`)
})

const client = new DiscordJS.Client({
  intents: ["Guilds", "GuildMessages"],
})

client.on("ready", () => {
  console.log("issue bot ready")
  const guildId = process.env.GUILD_ID || ""

  const guild = client.guilds.cache.get(guildId)

  let commands:
    | DiscordJS.GuildApplicationCommandManager
    | DiscordJS.ApplicationCommandManager
    | undefined

  if (guild) {
    commands = guild.commands
  } else {
    commands = client.application?.commands
  }

  commands?.create({
    name: "Open github issue",
    type: 3,
  })
})

client.on("interactionCreate", async (interaction) => {
  if (interaction.isMessageContextMenuCommand()) {
    const { commandName, targetMessage } = interaction
    if (commandName === "Open github issue") {
      const modal = getModal(targetMessage)
      interaction.showModal(modal)
    }
  } else if (interaction.isModalSubmit()) {
    const { fields } = interaction
    const title = fields.getTextInputValue("issueTitle")
    const body = fields.getTextInputValue("issueDescription")
    const octokit = new Octokit({
      auth: process.env.GITHUB_ACCESS_TOKEN,
      baseUrl: "https://api.github.com",
    })

    let [owner, repo] = (process.env.GITHUB_REPOSITORY || "").split("/", 2)
    if (!repo) {
      repo = owner
      owner = process.env.GITHUB_USERNAME || ""
    }

    octokit.rest.issues.create({ owner, repo, title, body }).then((res) => {
      interaction.reply(`Issue created: ${res.data.html_url}`)
    })
  }
})

client.login(process.env.BOT_TOKEN)
