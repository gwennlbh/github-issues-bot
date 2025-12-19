import * as DiscordJS from "discord.js"
import dotenv from "dotenv"
import { App } from "octokit"
import { getModal } from "./utils.js"
import arkenv from "arkenv"
import express from "express"
import { regex } from "arktype"
dotenv.config()

const env = arkenv({
  "PORT?": "number.port",
  GITHUB_APP_ID: "string > 0",
  GITHUB_APP_INSTALLATION_ID: "string.integer.parse",
  GITHUB_USERNAME: "string > 0",
  BOT_TOKEN: "string > 0",
  GUILD_ID: "string.integer > 0",
  GITHUB_REPOSITORY: [
    regex("^(?<owner>[^/]+)/(?<repo>[^/]+)$"),
    "=>",
    (repoAndOwner) => {
      const [owner, repo] = repoAndOwner.split("/", 2)
      return { owner, repo }
    },
  ],
})

// const app = express()

// app.use(express.json())

// app.get("/", (_, res) => {
//   res.send("Github issues bot!")
// })

// app.listen(env.PORT ?? 3000, () => {
//   console.log(`Server is listening on port ${env.PORT ?? 3000}`)
// })

const reporter = new App({
  appId: env.GITHUB_APP_ID,
  privateKey: await Bun.file("./github-app-key.pem").text(),
  log: console,
})

const gh = await reporter.getInstallationOctokit(env.GITHUB_APP_INSTALLATION_ID)

const { owner, repo } = env.GITHUB_REPOSITORY

const { data: repository } = await gh.rest.repos.get({ owner, repo })
console.info(`Acting on ${repository.full_name}`)

const client = new DiscordJS.Client({
  intents: ["Guilds", "GuildMessages"],
})

client.on("clientReady", async () => {
  console.log("Bot is ready.")
  const guildId = process.env.GUILD_ID || ""

  const guild = client.guilds.cache.get(guildId)
  if (!guild) {
    throw new Error("Guild not found")
  }

  const commands = guild.commands

  for (const [, cmd] of await commands.fetch()) {
    await commands.delete(cmd.id)
  }

  await commands.create({
    name: "To Github Bug",
    type: 3,
  })

  await commands.create({
    name: "To Github Feature Request",
    type: 3,
  })

  await commands.create({
    name: "To Github Task",
    type: 3,
  })
})

client.on("interactionCreate", async (interaction) => {
  if (interaction.isMessageContextMenuCommand()) {
    const { commandName, targetMessage, user } = interaction
    console.log(`Received command ${commandName} from ${user.tag}`)
    const githubIssueCommand =
      /^To Github (?<type>Bug|Feature Request|Task)$/.exec(commandName)
    if (githubIssueCommand) {
      const { data: labels } = await gh.rest.issues
        .listLabelsForRepo({ owner, repo })
        .catch(() => ({ data: [] }))

      const { data: issueTypes } = await gh
        .request("GET /orgs/{org}/issue-types", { org: owner })
        .catch(() => ({ data: [] }))

      const { data: milestones } = await gh.rest.issues
        .listMilestones({ owner, repo })
        .catch(() => ({ data: [] }))

      const { data: collaborators } = await gh.rest.repos
        .listCollaborators({ owner, repo })
        .catch(() => ({ data: [] }))

      const modal = getModal({
        id: `create github issue ${githubIssueCommand.groups?.type}`,
        user,
        message: targetMessage,
        labels,
        issueTypes,
        milestones,
        collaborators,
      })
      interaction.showModal(modal)
    }
  } else if (interaction.isModalSubmit()) {
    const { fields, customId } = interaction
    console.log(
      `Received modal submit ${interaction.customId} from ${interaction.user.tag}`
    )
    const title = fields.getTextInputValue("title")
    const body = fields.getTextInputValue("desc")
    const labels = fields.fields.has("labels")
      ? fields.getStringSelectValues("labels")
      : []
    const [milestone] = fields.fields.has("milestone")
      ? fields.getStringSelectValues("milestone")
      : []
    const [assignee] = fields.fields.has("assignee")
      ? fields.getStringSelectValues("assignee")
      : []

    const type = {
      Task: "Task",
      Bug: "Bug",
      "Feature Request": "Feature",
      // "Dependencies",
    }[customId.replace("create github issue ", "")]

    console.log(`Creating issue with`, {
      title,
      body,
      labels,
      milestone,
      assignee,
      type,
    })

    const { data: issue } = await gh.rest.issues.create({
      owner,
      repo,
      title,
      body,
      milestone,
      assignee,
      labels: [...labels],
      type,
    })

    await interaction.reply(`[Created #${issue.number}](${issue.html_url})`)
  }
})

client.login(process.env.BOT_TOKEN)
