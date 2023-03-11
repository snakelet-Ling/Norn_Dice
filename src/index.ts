import { Context, Logger, Schema } from 'koishi'

import { } from '@koishijs/plugin-adapter-onebot'
import { Config } from './config/config'
import { coc } from './module/coc'
import group_set, { bot_off_on } from './split/trivial'
import PC from './split/pc'
import group_log from './split/log'

export const name = 'norn-dice'

export { Config }

const log_send = new Logger("Bot：")
const debug = new Logger("debug")

export function apply(ctx: Context, config: Config) {

  ctx.plugin(coc)
  ctx.i18n.define("zh", require('./locales/zh'))

  // 
  // 
  // 创建Table
  // 
  // 
  const trival = new group_set(ctx, config.open_default)
  const pc = new PC(ctx)
  const log = new group_log(ctx)

  // 来了！修改输出层面的东西来了！！
  // 还有日志！
  ctx.on('before-send', (_, session) => {
    if (!_.content)
      return

    var json = { "said": "" }

    // 输出句子的修改
    try {
      if (typeof JSON.parse(_.content) == "object") {
        json = JSON.parse(_.content)
        // debug.info("parse")

      }else{
        json['said'] = _.content
        // debug.info("if else?")
      }

    } catch (error) {
      json['said'] = _.content
      // debug.info("content")
    }

    json["player"] = session.session.username

    _.content = session.session.text(json.said, json)

    _.content 
      = _.content.replace(/&gt;;|&amp;gt;/g, ">")
        .replace(/\\n/g, "\n")

    // {SPLIT}
    if (_.content.indexOf("{SPLIT}") != -1) {
      var said = _.content.split("{SPLIT}")
      said.forEach(e => {
        _.send(e)
      });
      return true
    }

    log_send.info(_.cid + "\n" + _.content)
  })

  // 检测关没关
  ctx.on('command/before-execute', async (session) => {
    // 私聊不管 || bot on 指令也不管
    if (session.session.guildId == undefined ||
      session.command.displayName == 'bot' ||
      session.command.displayName.match(/^bot.*[on|off]/))
      return

    else {
      var prom = await ctx.database.get('group_setting_v2', { group_id: session.session.guildId }, ['bot_on'])
        .then(res => res.length == 0? config.open_default: res[0].bot_on)
        .catch(err => config.open_default)

      if (!prom)
        return ''

    }
  })

  ctx.command('bot', "骰子信息")
    .action((_) => "Norn Dice.\n" + _.session.text("Norn_Dice.骰子信息"))

  ctx.command('bot.off', "关闭骰子功能")
    .action((_) => bot_off_on(ctx, _.session, false))

  ctx.command('bot.on', '开启骰子功能')
    .action((_) => bot_off_on(ctx, _.session, true))

  ctx.command('dismiss', '退群')
    .action(async ({ session }) => {
      var prom = await session.onebot.getGroupMemberInfo(session.guildId, session.userId).then(res => res)

      if (prom.role == 'member') {
        return session.text("Norn_Dice.骰子开关.退群失败")

      } else {
        await session.send(session.text("Noen_Dice.骰子开关.退群成功"))
        session.onebot.setGroupLeave(session.guildId)
      }
    })
}
