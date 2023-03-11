import { Context, Logger } from "koishi";

import { } from '@koishijs/plugin-help'
import { bouns_punish, rh, r_c, r_check_bouns_punish, throw_roll } from "../split/roll";
import group_set, { cocset, dface, en } from "../split/trivial";
import PC, { pc_del, pc_list, pc_new, pc_nn, pc_tag, st_show, st_skill } from "../split/pc";
import { san_check } from "../split/sc";
import { coc_chara, ti_li } from "../split/draw";
import group_log, { log_end, log_list, log_new, log_off, log_on } from "../split/log";
import { Config } from "../config/config";
export const name = "coc"

const log_catch = new Logger("")
const debug = new Logger("debug")

export function coc(ctx: Context, config: Config) {

    // 前缀拼凑
    var reg = getPrefixReg(ctx)

    // 整理帮助信息
    ctx.command("clear", { hidden: true })
    ctx.command("help", { hidden: true })
    ctx.command("status", { hidden: true })
    ctx.command("usage", { hidden: true })
    ctx.command("timer", { hidden: true })

    // 日志 + 重定向
    ctx.on('message', async (_) => {
        // 日志输出
        log_catch.info((_.guildId == undefined ? "personal" : _.guildId) + " => " + _.username + "(" + _.userId + ") : \n" + _.content)

        var message = _.content

        // 不包含前缀就不用快乐重定向了谢谢
        // 或者你这个参数是召唤帮助也不要乱来
        if (message.search(reg) == -1 || _.content.indexOf("-h") != -1) {
            return
        } else {
            message = message.replace(reg, "")
        }

        // 快乐重定向……
        if (message.match(/^rd(\d+)/)) {
            message = message.replace(/^r(d\d+)(.*)/, "r1$1 $2")
        }

        // 正确指令不需要重定向的
        if (message.match(/^rh ?$|^r[bp] |^r[bp]$|^r[ac] |^r[ac]$|^r[ac][pb] |^r[ac][bp]$|^sc /))
            return

        // rab/ rap
        if (message.match(/^r[ac]([bp])(\d+)(.*)/)) {
            var args = message.match(/^r[ac][bp](\d+)(.*)/)
            var isBouns = args.shift().indexOf("b") != -1

            args[1] = args[1].trim()

            _.send(await roll_check_bouns(r_check_bouns_punish(ctx, _, isBouns, ...args), _))
            return
        }

        // ra
        if (message.match(/^r[ca](.+)/)) {
            var args = message.match(/^r[ac](.*)/)
            var args_ = args[1].split(" ")

            _.send(await roll_check(r_c(ctx, _, ...args_), _))
            return
        }

        // rb/ rp
        if (message.match(/^r[bp](\d+)/)) {
            var args = message.match(/^r([bp])(\d+)/)
            // _.send(JSON.stringify(args))

            _.send(bouns_roll(bouns_punish(args[1] == "b", Number(args[2]))))
            return
        }

        // r
        if (message.match(/^r(\S+)/)) {
            var args = message.match(/^r(.*)/)
            var args_arr = args[1].replace(/  /g, " ").split(" ")
            _.send(await roll(throw_roll(ctx, _, ...args_arr)).then(res => res))
            return
        }

        // st
        if (message.match(/^st\S(\D+\d+)+/)) {
            var args = message.match(/^st(.*)/)
            _.send(await st_skill(ctx, _, args[1]))
            return
        }

        // hp/ mp/ san
        if (message.match(/^(hp|mp|san)(\+|-|\*|\/)(.+)/)) {
            var args = message.match(/^(hp|mp|san)(\+|-|\*|\/)(\w+)/)
            _.send(await st_skill(ctx, _, args[0]))
            return
        }

        // sc
        if (message.match(/^sc(.+)/)) {
            var args = message.match(/^sc(.*)/)
            _.send(await san_check(ctx, _, args[1]))
            return
        }

        // cocset
        if (message.match(/^cocset(\d+)|^setcoc(\d+)/)) {
            var args = message.match(/cocset(\d+)|setcoc(\d+)/)
            _.send(await cocset(ctx, _, args[1]))
            return
        }

        // set
        if (message.match(/^set(\d+)/)) {
            var args = message.match(/^set(\d+)/)
            _.send(await dface(ctx, _, args[1]))
            return
        }
    })

    // 
    // 
    // pc 指令
    // 
    // 
    ctx.command("pc", "角色卡")
        .subcommand("st")

    ctx.command("pc.list", "角色卡列表")
        .alias("pclist")

        .shortcut("pc list", { prefix: true })
        .shortcut("pc。list", { prefix: true })

        .action(({ session }) => pc_list(ctx, session))

    ctx.command("pc.new [name: string]", "新建角色卡")
        .alias("pcnew")

        .shortcut(/^pc new (.*)/, { args: ['$1'], prefix: true })
        .shortcut(/^pc。new (.*)/, { args: ['$1'], prefix: true })

        .example('pc new snake')

        .action((_, name) => pc_new(ctx, _.session, name))

    ctx.command("pc.del [name: string]", "删除角色卡")
        .alias("pcdel")

        .shortcut(/^pc del (.*)/, { args: ['$1'], prefix: true })
        .shortcut(/^pc。del (.*)/, { args: ['$1'], prefix: true })

        .example('pc del snake')

        .action((_, name) => pc_del(ctx, _.session, name))


    ctx.command("pc/nn [name: string]", "重命名人物卡")
        .usage("若当前使用默认卡则新建角色卡。\n参数留空为查看当前名称。\n")

        .example("nn snake")

        .action((_, name) => pc_nn(ctx, _.session, name))

    ctx.command("pc.tag [name: string]", "切换角色卡")
        .alias("pctag")

        .shortcut(/^pc tag (.*)/, { args: ['$1'], prefix: true })
        .shortcut(/^pc。tag (.*)/, { args: ['$1'], prefix: true })

        .example('pc tag snake')

        .action((_, name) => pc_tag(ctx, _.session, name))

    // 
    // 
    // st 指令
    // 
    // 
    ctx.command("st [...args]", "技能属性录入")

        .shortcut(/^st ([\u4e00-\u9FA5a-zA-Z]+\d+)+/, { args: ["$1"], prefix: true })

        .example("st 力量80int50教育30")

        .example("\n减糖用法：")

        .example("hp+2")
        .example("san+1d10")
        .example("mp-3\n")

        .action((_, ...args) => {
            if (args.length == 2 || args[0] == "show") {
                return st_show(ctx, _.session, args[1])
            } else {
                return st_skill(ctx, _.session, args[0])
            }
        })

    ctx.command("st.show [name: string]", "属性展示")
        .alias("stshow")

        .example("st show str")
        .example("st show 力量")

        .action((_, name) => st_show(ctx, _.session, name))

    // 
    // 
    // r 指令
    // 
    // 
    ctx.command('r [...args]', "投掷指令")

        .option('exp', '表达式，默认1d100')
        .option('reason', '投掷原因')

        .example('r 3d6*5 力量')
        .example('r 3#1d50+2')

        .action((_, ...args) => roll(throw_roll(ctx, _.session, ...args)))

    ctx.command('r/rc [...args]', "技能检定")
        .alias('ra')

        .option('value', '数值')
        .option('skill', '技能')
        .option('exp', '表达式')
        .option('reason', '鉴定原因')

        .example('ra 侦查')
        .example('ra 侦查 让我康康')
        .example('ra 80 侦查')
        .example('ra 3#斗殴')

        .action((_, ...args) => roll_check(r_c(ctx, _.session, ...args), _.session))

    ctx.command("r/rh [who: string]", "暗骰")

        .option('who', '艾特一个玩家以使用心理学鉴定')

        .example("rh")
        .example("rh @qq")

        .action((_, who) => rh(ctx, _.session, who))

    ctx.command("r/rcb [...args]", '奖励骰检定')
        .alias('rab')

        .option('b', '奖励骰数量')
        .option('value', '数值')
        .option('skill', '技能')

        .example('rab 侦查')
        .example('rab 2 侦查')
        .example('rab2 80 ')

        .action((_, ...args) => roll_check_bouns(r_check_bouns_punish(ctx, _.session, true, ...args),_))

    ctx.command("r/rcp [...args]", '惩罚骰检定')
        .alias('rap')

        .option('b', '奖励骰数量')
        .option('value', '数值')
        .option('skill', '技能')

        .example('rab 侦查')
        .example('rab 2 侦查')
        .example('rab2 80 ')

        .action((_, ...args) => roll_check_bouns(r_check_bouns_punish(ctx, _.session, false, ...args),_))

    ctx.command("r/rb [num: number]", "奖励骰")
        .usage("在首次d100的基础上再投掷一次十位骰，并将两者对比后取较小的作为结果")
        .example("rb 3 => 三个奖励骰")
        .action((_, num) => bouns_roll(bouns_punish(true, Number(num))))

    ctx.command("r/rp [num: number]", "惩罚骰")
        .usage("在首次d100的基础上再投掷一次十位骰，并将两者对比后取较大的作为结果")
        .example("rp3 => 三个惩罚骰")
        .action((_, num) => bouns_roll(bouns_punish(false, Number(num))))

    ctx.command("sc [...args]", "理智检定")

        .option("san", "目前san值")
        .option("exp", "扣除表达式：[成功扣除]/[失败扣除]")

        .example("sc 50 1d3/1d10")
        .example("sc 1/1d3")

        .action((_, ...args) => san_check(ctx, _.session, ...args))

    // 
    // 
    // 杂项
    // 
    // 
    ctx.command("ti", "临时症状")
        .usage("临时疯狂 - 短期症状")
        .action(() => ti_li(true))

    ctx.command("li", "总结症状")
        .usage("临时疯狂 - 长期症状")
        .action(() => ti_li(false))

    ctx.command("coc [num: number]", "COC人物作成")
        .option('num', "生成数量，默认1")

        .action((_, num) => coc_chara(Number(num)))

    ctx.command("en [...args]", "技能成长")
        .option('skill', "技能")
        .option("exp", "成功增加")
        .option("exp2", "失败增加/成功增加")

        .example("en str")
        .example("en str 1d5/1d8")

        .action((_, ...args) => en(ctx, _.session, ...args))

    ctx.command('cocset [num: number]', "房规设置")
        .alias('setcoc [num: number]')

        .usage('参数1 => \n    1：大成功\n    技能数值小于50：96-100大失败\n    技能数值大于50：100大失败\n\n' +
            '参数2 => \n    技能数值小于50：1大成功；96-100大失败\n    技能数值大于50：1-5大成功；100大失败\n\n' +
            '参数3 => \n    1-5大成功\n    96-100大失败\n')

        .example("cocset 3")
        .action((_, num) => cocset(ctx, _.session, num))

    ctx.command('set [num: number]', "骰面设置")
        .option('face', "设置骰子默认面数，留空则默认百面骰")

        .example("set 20")
        .action((_, num) => dface(ctx, _.session, num))

    // 
    // 
    // log
    // 
    // 
    ctx.command("log.new", "开新日志")
        .shortcut(/^log new(.*)/, { prefix: true, args: ["$1"] })
        .shortcut(/^lognew(.*)/, { prefix: true, args: ["$1"] })

        .option("name", "开启的log名称")

        .action((_, ...args) => log_new(ctx, _.session, args))

    ctx.command("log.off", "暂停日志")
        .shortcut(/^log off$/, { prefix: true })
        .shortcut(/^logoff$/, { prefix: true })

        .action((_) => log_off(ctx, _.session))

    ctx.command("log.list", "日志列表")
        .shortcut(/^log list$/, { prefix: true })
        .shortcut(/^loglist$/, { prefix: true })

        .action((_) => log_list(ctx, _.session))

    ctx.command("log.on", "继续记录日志")
        .shortcut(/^log on(.*)/, { prefix: true, args: ["$1"] })
        .shortcut(/^logon(.*)/, { prefix: true, args: ["$1"] })

        .action((_, ...args) => log_on(ctx, _.session, args))

    ctx.command("log.end", "停止记录并输出文件")
        .shortcut(/^log end(.*)/, {prefix: true, args: ['$1']})
        .shortcut(/^logend(.*)/, {prefix: true, args: ['$1']})

        .action((_, ...args) => log_end(ctx, _.session, args))

    // ctx.command("log.clr")
    //     .action(async (_) => {
    //         await ctx.database.remove('group_logging_v2', { group_id: _.session.guildId })
    //         await ctx.database.remove('group_logging_data_v2', {id: {$gt: -1}})
    //         return "done"
    //     })

}

// 投掷
async function roll(prom) {

    var json = {}

    var res = await prom.then(res => res)

    // 获取设置句子
    var said = "Norn_Dice.投掷"

    // 判定有无投掷原因
    said += res.reason == "" ?
        ".普通投掷"
        : ".带理由的投掷"

    json['said'] = said

    // 1d4+3#2d5
    // {
    //     "middle":
    //         [
    //             {"exp":"1d4","res":"2"},
    //             {"exp":"2d5","res":"2,1"},
    //             {"exp":"2d5","res":"3,4"},
    //             {"exp":"2d5","res":"1,4"}
    //         ],
    //     "result":17,"reason":""
    //     }

    // 替换详情
    if (res.middle.length <= 1) {
        json['resultDetail'] = ""

    } else {
        var arr = ""
        res.middle.forEach(e => {
            if (arr != "")
                arr += "\n"

            arr += "[" + e.exp + "] = [" + e.res + "]"
        });
        json['resultDetail'] = arr + "\n"
    }

    json['result'] = res.result
    json['exp'] = res.exp
    json['reason'] = res.reason
    
    return JSON.stringify(json)

}

// 鉴定(rc)
async function roll_check(prom, session) {

    var json = {}

    // 提取内容
    var res = await prom.then(res => res)

    if (res.length != 3)
        return res

    var roll_detail = res[0]
    var reason = res[1] == null ? "数值" : res[1]
    var target = res[2]

    // 单次检定
    if (roll_detail.length == 1) {
        // 句子尾
        var said_v2 = 'Norn_Dice.投掷.技能检定.' + roll_detail[0]['passLv']

        json['reason'] = reason
        json['result'] = "1d100 = " + roll_detail[0]["out"] + "/" + target

        var said = session.text("Norn_Dice.投掷.普通检定", json) + session.text(said_v2)

    } else {  //多次检定
        said_v2 = ""

        roll_detail.forEach(e => {
            if (said_v2 != "")
                said_v2 += "\n"

            said_v2 += e["out"] + "/" + target + " " + e["passLv"]
        });

        json['reason'] = reason
        json['resultDetail'] = said_v2

        var said = session.text("Norn_Dice.投掷.多重检定", json)
    }

    return said
}

// 检定奖励(rcb)
async function roll_check_bouns(json_prom, session) {
    var said_json = {}

    var json = await json_prom.then(res => res)

    if (json['bp'] == undefined)
        return json

    var bp = json.bp

    var orgNum = bp.ten.shift() * 10 + bp.unit

    var resultDetail = "[ " + (bp.isBouns ? "奖励骰" : "惩罚骰") + " d100=" + orgNum + " | " + bp.ten.join(" ") + " ]"

    // said = said.replace("{reason}", (json.reason == undefined? "" : json.reason))
    //             .replace("{exp}", "b" + json.bp.ten.length)
    //             .replace("{resultDetail}", resultDetail)
    //             .replace("{result}", bp.lastNum + "/" + json.target)
    said_json['reason'] = (json.reason == undefined ? "" : json.reason)
    said_json['exp'] = "b" + json.bp.ten.length
    said_json['resultDetail'] = resultDetail
    said_json['result'] = bp.lastNum + "/" + json.target

    var said_v2 = 'Norn_Dice.投掷.技能检定.' + json.passLv

    var said = session.text("Norn_Dice.投掷.bp骰检定", said_json) + " " + session.text(said_v2)

    return said
}

// 奖励/惩罚骰
function bouns_roll(res) {
    // var config = getConfig()
    var json = {}

    var said = 'Norn_Dice.投掷.bp骰'

    var detail: string, exp: string

    detail = "[ " + (res['isBouns'] ? "奖励" : "惩罚") + "骰 d100=" + (res['ten'][0] * 10 + res['unit']) + " | "

    res['ten'].shift()

    detail += res['ten'].join(" ") + " ]"

    exp = "b" + res['ten'].length

    json['said'] = said
    json['resultDetail'] = detail
    json['exp'] = exp
    json['result'] = res['lastNum']

    // said = said.replace("{resultDetail}", detail)
    //             .replace("{exp}", exp)
    //             .replace("{result}", res['lastNum'])

    return JSON.stringify(json)
}

// 获取前缀
export function getPrefixReg(ctx: Context) {
    var prefix = JSON.stringify(ctx.options.prefix)
    prefix = eval(prefix).join("|^")

    prefix = prefix.replace(".", "\\.")
        .replace("?", "\\?")
        .replace("+", "\\+")
        .replace("*", "\\*")
        .replace("|^", "|^")

    var reg = new RegExp("^" + prefix)
    return reg
}