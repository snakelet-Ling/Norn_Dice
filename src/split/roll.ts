import { Context, Logger, Random, Session } from "koishi"
import { getCard, getCard_who, pc_skill_sugar } from "./pc"
import { rules_get } from "./trivial"

const personal = "personal"

const debug = new Logger('debug')

export const level_str = {
    '大失败': '大失败',
    '失败': '失败',
    '成功': '成功',
    '困难': '困难成功',
    '极难': '极难成功',
    '大成功': '大成功'
}

// 投掷
export async function throw_roll(ctx: Context, session: Session, ...args) {
    var gid = session.guildId == undefined ? personal + session.userId : session.guildId

    // 参数判断
    if (args.length == 0) {  // 无参，执行1d100
        var prom = await ctx.database.get('group_setting_v2', { group_id: gid }, ['dice_face'])
            .then(res => {
                if (res.length == 0) {
                    return 100
                } else {
                    return res[0].dice_face
                }

            })

        return { middle: [], result: r_single(prom), reason: "", exp: '1d' + prom }

    } else if (args.length == 1) {  // 1参，表达？理由？
        if (isExpre(args[0])) { // 表达式
            var json = exp2self(args[0])
            json.exp = args[0]
            return json
        } else {  // 理由
            var prom = await ctx.database.get('group_setting_v2', { group_id: gid }, ['dice_face'])
                .then(res => {
                    if (res.length == 0) {
                        return 100
                    } else {
                        return res[0].dice_face
                    }

                })
            return { middle: [], result: r_single(prom), reason: args[0], exp: '1d' + prom }
        }

    } else {  //否则 [0] = exp, [1] = reason
        var json = { middle: [], result: 0, reason: '', exp: '' }
        if (isExpre(args[0])) {
            json = exp2self(args[0])
            json.reason = args[1]
            json.exp = args[0]
        } else {
            json = exp2self(args[1])
            json.reason = args[0]
            json.exp = args[1]
        }

        return json

    }
}

// rc
export async function r_c(ctx: Context, session: Session, ...args) {
    // 获取当前房规
    var rules = await ctx.database.get('group_setting_v2', { group_id: (session.guildId == undefined ? personal + session.userId : session.guildId) }, ['setcoc'])
        .then(res => {
            if (res.length == 0)
                return "3"
            else
                return res[0].setcoc
        })

    switch (args.length) {
        case 0:
            return "指令错误！请参阅 rc -h 指令。"
            break;

        case 1:
            var num = Number(args[0])
            if (Number.isNaN(num)) {
                // 表达式 or 技能
                return r_check_exp(args[0], rules, ctx, session, null)

            } else {
                // 数字
                return r_check(num, rules)
            }
            break;

        case 2:
            // 技能 or 数字 or 表达式 + 理由
            var res

            if (Number.isInteger(Number(args[0]))) {
                res = r_check(Number(args[0]), rules)
                res[1] = args[1]

            } else if (Number.isInteger(Number(args[1]))) {
                res = r_check(Number(args[1]), rules)
                res[1] = args[0]

            } else {
                res = r_check_exp(args[0], rules, ctx, session, args[1])
            }

            return res

            break;

        default:
            return "指令错误！"
            break;
    }
}

// 单次投掷
function r_single(dice: number) {
    return Random.int(1, dice + 1)
}

// 是否为骰点表达式
export function isExpre(expression) {
    expression += ""

    // return expression
    return expression.match(/\d+[dD]\d+/) != null
}

// 不拆后续表达，直接自套娃
function exp2self(exp) {
    // 先修正d\d+ - > 1d\d+
    // 1D10 -> 1d10
    exp = exp.replace(/(\D+)[dD](\d+)/g, "$1" + "1d$2")
        .replace(/(\d+)D(\d+)/g, "$1d$2")

    var middle = []

    var ex = exp.match(/(\d+)#(\d+)d(\d+)/)
    while (ex != null) {
        var sum = 0
        for (var i = 0; i < ex[1]; i++) {
            var res = r_mult(ex[2], ex[3])
            middle.push(res[0])
            sum += Number(res[1])
        }

        exp = exp.replace(ex[0], sum)

        ex = exp.match(/(\d+)#(\d+)d(\d+)/)
    }

    var ex = exp.match(/(\d+)d(\d+)/)
    while (ex != null) {
        var res = r_mult(ex[1], ex[2])
        middle.push(res[0])

        exp = exp.replace(ex[0], res[1])

        ex = exp.match(/(\d+)d(\d+)/)
    }

    var said = { middle: middle, result: Number(eval(exp)), reason: '', exp: '' }
    return said
}

// 多次投掷
function r_mult(times: number, dice: number) {
    times = Number(times)
    dice = Number(dice)

    var res = []
    var sum = 0
    var num = 0

    for (let i = 0; i < times; i++) {
        num = r_single(dice)
        res.push(num)
        sum += num
    }

    var json = { 'exp': times + "d" + dice, 'res': res.toString() }

    // [	
    //   {
    //     'exp': '3d5', 
    //     'res': [4,3,5],
    //   },
    //   12
    // ]

    return [json, sum]
}

// 鉴定 [表达式/技能]：return [[...{出目，成功等级}], 原因, 目标]
async function r_check_exp(exp: string, rules: any, ctx: Context, session: Session, target_str?: string) {
    var exp_v2 = []

    // 拆一个表达式
    var ahi = ""
    if (exp.search(/\+|-|\*|\//) != -1) {
        var ahi_ = exp.match(/(.*?)(\+|-|\*|\/)(.*)/)

        exp = ahi_[1]
        ahi = ahi_[2] + ahi_[3]
    }

    if (exp.indexOf("#") != -1) {
        exp_v2 = exp.split("#") // 3#50 => [3,50] 3#str+10 => [3,str+10]

    } else {
        exp_v2.push(1)
        exp_v2.push(exp)
    }

    // 真正返回的数组
    var res_v2 = []

    // 技能/数值
    if (!Number.isNaN(Number(exp_v2[1]))) {
        // 数值
        var target = Number(eval(exp_v2[1] + ahi))

    } else {
        // 技能
        var prom_ = await getCard(ctx, session)
            .then(res => {
                return JSON.stringify(res);
            })
        var prom = JSON.parse(prom_)[1]

        if (pc_skill_sugar[exp_v2[1]] != undefined)
            exp_v2[1] = pc_skill_sugar[exp_v2[1]]

        var target = Number(eval(prom[exp_v2[1]] + ahi))
        if (Number.isNaN(target))
            target = 1

        if (target_str == null)
            target_str = exp_v2[1]
    }

    var res = r_mult(Number(exp_v2[0]), 100)  //[{"exp":"5d100","res":"83,96,42,30,87"},338]
    res = res[0]["res"].split(",")

    res.forEach(e => {
        var lv = pass_check(rules, Number(e), target)
        var json = {
            'out': e,
            'passLv': lv
        }

        res_v2.push(json)
    });

    return [res_v2, target_str, target]
}

// 鉴定 [数字]: return [[{out: 出目， passLv: 成功等级}], 原因，目标]
export function r_check(target: number, rules: any) {
    var out = r_single(100)

    var passLv = pass_check(rules, out, target)

    return [[{ 'out': out, 'passLv': passLv }], null, target]
    // return passLv
}

// 成功等级
function pass_check(rules: any, out: number, target: number) {
    // '参数1
    // 1：大成功
    // 技能数值小于50：96-100大失败
    // 技能数值大于50：100大失败\n\n' + 
    // '参数2 => 
    // 技能数值小于50：1大成功；96-100大失败
    // 技能数值大于50：1-5大成功；100大失败\n\n' + 
    // '参数3 =>
    // 1-5大成功
    // 96-100大失败')

    // 以技能值为分界线开始判断

    if (Number.isNaN(target))
        target = 1

    var level = level_str.失败

    // 普通成功
    if (out < target / 5)
        level = level_str.极难
    else if (out < target / 2)
        level = level_str.困难
    else if (out <= target)
        level = level_str.成功

    // 判断大成功大失败
    switch (rules + "") {
        case '1':
            if (out == 1)
                level = level_str.大成功
            else if ((target < 50 && out >= 96) || out == 100)
                level = level_str.大失败
            break;

        case '2':
            if (target < 50) {
                if (out == 1)
                    level = level_str.大成功
                else if (out >= 96)
                    level = level_str.大失败

            } else {
                if (out <= 5)
                    level = level_str.大成功
                else if (out == 100)
                    level = level_str.大失败
            }
            break

        case '3':
            if (out <= 5 && out <= target)
                level = level_str.大成功
            else if (out >= 96 && out > target)
                level = level_str.大失败
            break
    }

    return level
}

// 暗骰
export async function rh(ctx: Context, session: Session, who?: string) {
    // var config = getConfig()

    // 群聊限定
    if (session.guildId == undefined)
        return "Norn_Dice.投掷.错误_群聊"

    var said = ""

    if (who == null) {
        said = "Norn_Dice.投掷.暗骰"

        // 单次投掷
        var result = await throw_roll(ctx, session, null)
            .then(res => res)

        var json = {}
        json['said'] = said
        json['groupID'] = session.guildId
        json['result'] = result.exp + " = " + result.result

        // 消息发送
        session.bot.sendPrivateMessage(session.userId, JSON.stringify(json))

    } else {
        // 获得句子
        said = "Norn_Dice.投掷.暗骰但心理学检定"

        // 获得规则书
        var rules = await ctx.database.get('group_setting_v2', { group_id: (session.guildId == undefined ? personal + session.userId : session.guildId) }, ['setcoc'])
            .then(res => {
                if (res.length == 0)
                    return "3"
                else
                    return res[0].setcoc
            })

        // 看谁的
        var qq = who.match(/(\d+)/)
        if (qq == null)
            return "参数错误！请查阅 rh -h 指令。"

        // 获得目标资料
        var prom = await session.bot.getGuildMember(session.guildId, qq[1]).then(res => res)
        // 解析
        var nick = prom.nickname == "" ? prom.username : prom.nickname
        var card = await getCard_who(ctx, prom.userId, session.guildId).then(res => res)
        var num = card[1]["心理学"]

        var resu = r_check(num, rules)

        var json = {}
        json['said'] = said
        json['pc_name'] = nick
        json['result'] = "1d100 = " + resu[0][0]["out"] + "/" + num + " " + resu[0][0]["passLv"]

        session.bot.sendPrivateMessage(session.userId, JSON.stringify(json))
    }

    // 主群消息发送
    return "Norn_Dice.投掷.暗骰反馈"
}

// 奖励/惩罚检定
export async function r_check_bouns_punish(ctx: Context, session: Session, isBouns: boolean, ...args) {
    var reason, target_str, bp

    if (args.length == 0)
        return "Norn_Dice.投掷.错误_检定无参"

    // 一个奖励骰，参数是检定项目
    else if (args.length == 1) {
        bp = bouns_punish(isBouns, 1)
        target_str = args[0]

        // 第一个参数是否文字
    } else if(args.length == 2 ) {
        // 是文字，则[0]是理由，[1]是目标
        if(Number.isNaN(Number.parseInt(args[0]))) {
            bp = bouns_punish(isBouns, 1)
            reason = args[0]
            target_str = args[1]

            // 否则[0]是奖励骰数量，[1]是目标
        }else{
            bp = bouns_punish(isBouns, Number(args[0]))
            target_str = args[1]
        }

        // args[0]个奖励骰，args[1]是理由，args[2]是检定项目
    } else {
        bp = bouns_punish(isBouns, Number(args[0]))
        reason = args[1]
        target_str = args[2]
    }

    // 获取房规
    var rules = await rules_get(ctx, session).then(res => res)
    // 目标不是数字（技能意味）
    if (Number.isNaN(Number(target_str))) {
        var card = await getCard(ctx, session).then(res => res[1])

        if (pc_skill_sugar[target_str] != undefined)
            target_str = pc_skill_sugar[target_str]

        var target = Number(card[target_str])
        if (Number.isNaN(target))
            target = 1

    } else {
        var target = Number(target_str)
    }

    var pass = pass_check(rules, bp.lastNum, target)

    // reason可空，空则由target_str顶上

    var json = {
        'bp': bp,
        'passLv': pass,
        'reason': (reason == null ? target_str : reason),
        'target': target
    }

    return json
}

// 奖励/惩罚骰子
export function bouns_punish(isBouns: boolean, num: number) {
    var ten: number[] = []
    var unit = 0

    ten.push(r_single(10)-1)
    unit = r_single(10)-1

    // 无参纠正
    if (Number.isNaN(num) || num <= 0)
        num = 1

    // 骰摘十位数
    for (let i = 0; i < num; i++)
        ten.push(r_single(10)-1)

    // 分开奖励/惩罚
    if (isBouns) {
        var lastNum = 100

        for (let i = 0; i < ten.length; i++) {
            var num = ten[i] * 10 + unit
            // 大失败！
            if (num == 0) {
                ten[i] = 10
                num = 100
            }

            if (num < lastNum)
                lastNum = num
        }

    } else {
        var lastNum = 0

        for (let i = 0; i < ten.length; i++) {
            var num = ten[i] * 10 + unit
            // 大失败！
            if (num == 0) {
                ten[i] = 10
                num = 100
            }

            if (num > lastNum)
                lastNum = num
        }

    }

    return { "ten": ten, 'unit': unit, "isBouns": isBouns, "lastNum": lastNum }
}