import { Context, Logger, sleep } from 'koishi'

import { } from '@koishijs/plugin-adapter-onebot'
import { Config } from './config/config'
import { coc } from './module/coc'
import group_set, { bot_off_on } from './split/trivial'
import PC, { getCard } from './split/pc'
import group_log from './split/log'

export const name = 'norn-dice'

export { Config }

const log_send = new Logger("Bot：")
const debug = new Logger("debug")

export let isHidden = false

export function apply(ctx: Context, config: Config) {

  isHidden = config.hidden_command

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
  ctx.on('before-send', async (_) => {
    if (!_.content)
      return

    var json = { "said": "" }

    // 输出句子的修改
    try {
      if (typeof JSON.parse(_.content) == "object") {
        json = JSON.parse(_.content)
        // debug.info("parse")

      } else {
        json['said'] = _.content
        // debug.info("if else?")
      }

    } catch (error) {
      json['said'] = _.content
      // debug.info("content")
    }

    _.content = _.text(json.said, json)

    var player = await getCard(ctx, _).then(res => res[0] + "")

    _.content
      = _.content
        .replace(/{player}/g, player)
        .replace(/{user}/g, _.username)
        .replace(/&gt;;|&amp;gt;/g, ">")
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

  // 申请审核
  // 好友申请
  ctx.on('friend-request', async (_) => {
    // 向骰主发送消息
    config.master_qq.forEach(async qq => {
      await _.bot.sendPrivateMessage(qq + "", "好友申请：\nQQ：" + _.userId)
    });

    var send = "根据配置，已自动"
    // 判断config
    if (config.req.friend_req) {
      send += "同意"
      await _.bot.handleFriendRequest(_.messageId, true)
      await _.bot.sendPrivateMessage(_.userId, _.text("Norn_Dice.通过好友消息"))

    } else {
      send += "无视"
    }

    config.master_qq.forEach(async qq => {
      await _.bot.sendPrivateMessage(qq + "", send)
    });

  })

  // 群组申请
  ctx.on('guild-request', async (_) => {

    // 如果本来就是骰主干的就直接入了
    if (config.master_qq.includes(Number(_.userId))) {
      await _.bot.handleGuildRequest(_.messageId, true)
    }

    // 向骰主发送消息
    config.master_qq.forEach(async qq => {
      await _.bot.sendPrivateMessage(qq + "", "群聊申请：\n操作人：" + _.userId + "\n群号：" + _.guildId)
    });

    var send = "根据配置，已自动"
    // 判断config
    if (config.req.friend_req) {
      send += "同意"
      await _.bot.handleGuildRequest(_.messageId, true)

    } else {
      send += "无视"
    }

    config.master_qq.forEach(async qq => {
      await _.bot.sendPrivateMessage(qq + "", send)
    });

  })

  // 入群说话
  ctx.on('guild-added', async (_) => {
    sleep(2000)
    return await _.bot.sendMessage(_.guildId, _.text("Norn_Dice.入群消息"))
  })

  // 检测关没关
  ctx.on('command/before-execute', async (argv) => {

    var ele = argv.session.elements[0]

    // 不是艾特自己直接走
    if (ele.type == 'at' && ele.attrs.id != argv.session.selfId)
      return ''


    // 私聊不管 || bot on 指令不管 || 不是艾特自己也不管
    if (argv.session.guildId == undefined ||
      argv.command.displayName == 'bot' ||
      argv.command.displayName.match(/^bot.*[on|off]/))
      return

    else {
      var prom = await ctx.database.get('group_setting_v2', { group_id: argv.session.guildId }, ['bot_on'])
        .then(res => res.length == 0 ? config.open_default : res[0].bot_on)
        .catch(err => config.open_default)

      if (!prom)
        return ''

    }
  })

  ctx.command('bot', "骰子信息", { hidden: isHidden })
    .action((_, args) => {
      if (args == "off")
        return bot_off_on(ctx, _.session, false)
      else if (args == "on")
        return bot_off_on(ctx, _.session, true)
      else
        return "Norn Dice. v0.2.3\n" + _.session.text("Norn_Dice.骰子信息", { 'SPLIT': "{SPLIT}" })
    })

  ctx.command('bot.off', "关闭骰子功能", { hidden: isHidden })
    .action((_) => bot_off_on(ctx, _.session, false))

  ctx.command('bot.on', '开启骰子功能', { hidden: isHidden })
    .action((_) => bot_off_on(ctx, _.session, true))

  ctx.command('dismiss', '退群', { hidden: isHidden })
    .action(async ({ session }) => {
      var prom = await session.onebot.getGroupMemberInfo(session.guildId, session.userId).then(res => res)

      if (prom.role == 'member') {
        return session.text("Norn_Dice.骰子开关.退群失败")

      } else {
        await session.send(session.text("Norn_Dice.骰子开关.退群成功"))
        session.onebot.setGroupLeave(session.guildId)
      }
    })

  ctx.command('send', "联系骰主", { hidden: isHidden })
    .example("send 你好")
    .action((_, ...args) => {
      var arg = args.join(" ")
      config.master_qq.forEach(async qq => {
        await _.session.bot.sendPrivateMessage(qq + "", "接收到来自" + _.session.userId + "的消息：\\n" + arg)
      });
      return _.session.text("Norn_Dice.其他.给骰主发送消息")
    })
}
