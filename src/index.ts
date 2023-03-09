import { Context, Logger, Schema } from 'koishi'

import { } from '@koishijs/plugin-adapter-onebot'
import { Config } from './config/config'
import { coc } from './module/coc'
import { bot_off_on } from './split/trivial'

export const name = 'norn-dice'

export { Config }

const log_send = new Logger("Bot：")

const debug = new Logger("debug")

export function apply(ctx: Context, config: Config) {

  ctx.plugin(coc)
  ctx.i18n.define("zh", require('./locales/zh'))

  // 来了！修改输出层面的东西来了！！
  // 还有日志！
  
  // ctx.on('before-send', (_, session) => {
  //   if (!_.content)
  //     return

  //   var json = { "said": "" }

  //   // 输出句子的修改
  //   try {
  //     if (typeof JSON.parse(_.content) == "object") {
  //       json = JSON.parse(_.content)
  //       // debug.info("parse")

  //     }else{
  //       json['said'] = _.content
  //       // debug.info("if else?")
  //     }

  //   } catch (error) {
  //     json['said'] = _.content
  //     // debug.info("content")
  //   }

  //   // debug.info("ready to eval " + json)

  //   try {
  //     _.content = eval(json.said)
  //     // debug.info("eval")

  //   } catch (err) {
  //     _.content = json.said
  //     // debug.info("eval err")

  //   }

  //   for (const key in json) {
  //     if (key == 'said')
  //       continue

  //     _.content = _.content.replace("{" + key + "}", json[key])
  //   }

  //   // {player}
  //   _.content = _.content.replace("{player}", session.session.username)

  //   // \n
  //   _.content = _.content.replace(/\\n/g, "\n")

  //   // {SPLIT}
  //   if (_.content.indexOf("{SPLIT}") != -1) {
  //     var said = _.content.split("{SPLIT}")
  //     said.forEach(e => {
  //       _.send(e)
  //     });
  //     return true
  //   }

  //   log_send.info(_.cid + "\n" + _.content)
  // })


  ctx.command("test")
    .action((_) => _.session.text("Norn_Dice.骰子开关.成功开启"))

  // 检测关没关
  ctx.on('command/before-execute', async (session) => {
    // 私聊不管 || bot on 指令也不管
    if (session.session.guildId == undefined ||
      session.command.displayName == 'bot' ||
      session.command.displayName.match(/^bot.*[on|off]/))
      return

    else {
      var prom = await ctx.database.get('group_setting_v2', { group_id: session.session.guildId }, ['bot_on'])

      if (!(prom.length == 0 || prom[0].bot_on))
        return ''

    }
  })

  ctx.command('bot', "骰子信息")
    .action((_, args) => {

      var said = "Norn Dice."

      if (args == "on")
        return bot_off_on(ctx, _.session, true)
      else if (args == "off")
        return bot_off_on(ctx, _.session, false)

      else {

        for (let i = 0; i < config.Bot_Info.length; i++) {
          if (said != "")
            said += "\n"
          said += config.Bot_Info[i]
        }
        // return said
        return JSON.stringify({ 'said': said })
      }
    })

  ctx.command('bot.off', "关闭骰子功能")
    .action((_) => bot_off_on(ctx, _.session, false))

  ctx.command('bot.on', '开启骰子功能')
    .action((_) => bot_off_on(ctx, _.session, true))

  ctx.command('dismiss', '退群')
    .action(async ({ session }) => {
      var prom = await session.onebot.getGroupMemberInfo(session.guildId, session.userId).then(res => res)

      if (prom.role == 'member') {
        return JSON.stringify({ 'said': "权限不足" })

      } else {
        await session.send(JSON.stringify({ 'said': "正在退群……" }))
        session.onebot.setGroupLeave(session.guildId)
      }
    })
}
