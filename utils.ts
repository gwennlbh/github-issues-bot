import { RestEndpointMethodTypes } from "@octokit/rest"
import * as DiscordJS from "discord.js"
import { TextInputStyle } from "discord.js"

export const getModal = ({
  id,
  user,
  message,
  labels,
  issueTypes,
  milestones,
  collaborators,
}: {
  id: string
  user: DiscordJS.User
  message: DiscordJS.Message<boolean>
  labels: RestEndpointMethodTypes["issues"]["listLabelsForRepo"]["response"]["data"]
  issueTypes: Array<{
    id: number
    name: string
    description: string
    color: string
    is_enabled: boolean
  }>
  milestones: RestEndpointMethodTypes["issues"]["listMilestones"]["response"]["data"]
  collaborators: RestEndpointMethodTypes["repos"]["listCollaborators"]["response"]["data"]
}) => {
  return createModal(id, "Create GitHub Issue", {
    Title: textInput("title*", TextInputStyle.Short),
    // Can't have more than 5 fields in a modal
    // Type: selectOneMenu("type*", issueTypes),
    Description: textInput("desc*", TextInputStyle.Paragraph, {
      default: [
        "---",
        `_Issue created by ${user.tag} [via Discord](${message.url}):_`,
        "",
        ...message.content.split("\n").map((line) => `> ${line}`),
        "",
        `— ${message.author.displayName} (${message.author.tag})`,
        "",
      ].join("\n"),
    }),
    Labels: selectMultipleMenu("labels", labels),
    Milestone: selectOneMenu("milestone", milestones),
    Assignee: selectOneMenu(
      "assignee",
      collaborators.map(({ login, name }) => ({
        name: login,
        description: name,
      }))
    ),
  })
}

function createModal(
  id: string,
  title: string,
  fields: Record<
    string,
    DiscordJS.StringSelectMenuBuilder | DiscordJS.TextInputBuilder | undefined
  >
): DiscordJS.ModalBuilder {
  return new DiscordJS.ModalBuilder()
    .setCustomId(id)
    .setTitle(title)
    .addLabelComponents(
      ...Object.entries(fields)
        .filter(([, field]) => field !== undefined)
        .map(([label, field]) => {
          const builtLabel = new DiscordJS.LabelBuilder().setLabel(label)

          if (field instanceof DiscordJS.StringSelectMenuBuilder) {
            builtLabel.setStringSelectMenuComponent(field)
          } else if (field instanceof DiscordJS.TextInputBuilder) {
            builtLabel.setTextInputComponent(field)
          }

          return builtLabel
        })
    )
}

function selectOneMenu(
  id: string,
  options: Parameters<typeof selectMenu>[2]
): DiscordJS.StringSelectMenuBuilder | undefined {
  return selectMenu(id, { multiple: false }, options)
}

function selectMultipleMenu(
  id: string,
  options: Parameters<typeof selectMenu>[2]
): DiscordJS.StringSelectMenuBuilder | undefined {
  return selectMenu(id, { multiple: true }, options)
}

/**
 * Returns undefined if there are no options
 */
function selectMenu(
  id: string,
  params: { multiple?: boolean },
  options: Array<
    | { name: string; description?: string | null }
    | { title: string; description?: string | null }
  >
): DiscordJS.StringSelectMenuBuilder | undefined {
  if (options.length === 0) {
    return undefined
  }

  const { customId, required } = parseFieldId(id)
  const menu = new DiscordJS.StringSelectMenuBuilder()
    .setCustomId(customId)
    .setRequired(required)

  options = options.slice(0, 25)

  if (params.multiple) {
    menu.setMaxValues(options.length)
  }

  menu.setMinValues(required ? 1 : 0)

  menu.addOptions(
    options.map(({ description, ...nameOrTitle }) => {
      const name = "name" in nameOrTitle ? nameOrTitle.name : nameOrTitle.title
      const menu = new DiscordJS.StringSelectMenuOptionBuilder()
        .setLabel(name)
        .setValue(name)
      if (description) menu.setDescription(description)
      return menu
    })
  )

  return menu
}

function textInput(
  id: string,
  style: DiscordJS.TextInputStyle,
  params: { default?: string } = {}
): DiscordJS.TextInputBuilder {
  const { customId, required } = parseFieldId(id)

  const input = new DiscordJS.TextInputBuilder()
    .setCustomId(customId)
    .setStyle(style)
    .setRequired(required)

  if (params.default) input.setValue(params.default)

  return input
}

function parseFieldId(id: string): { customId: string; required: boolean } {
  const [customId, _] = id.split("*")
  const required = id.endsWith("*")
  return { customId, required }
}
