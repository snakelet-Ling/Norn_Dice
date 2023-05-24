import { Context, Session } from "koishi"
import { getCard, pc_skill_sugar, st_skill } from "./pc"
import { isExpre, level_str, r_check, throw_roll } from "./roll"

// 当前群设置
interface group_setting {
    group_id: string,
    bot_on: boolean,
    setcoc: string,
    dice_face: number,
    last_log: string,
    logging: boolean
}

declare module 'koishi' {
    interface Tables {
        group_setting_v2: group_setting,
    }
}

export default class group_set {
    protected ctx: Context
    protected bot: boolean

    constructor(ctx: Context, bot: boolean) {
        this.ctx = ctx
        this.bot = bot

        // 创建表
        ctx.model.extend('group_setting_v2', {
            group_id: 'string',
            bot_on: {type: 'boolean', initial: this.bot},
            setcoc: {type: 'string', initial: "3"},
            dice_face: {type: 'integer', initial: 100},
            last_log: 'string',
            logging: {type: 'boolean', initial: false}
        },
            {
                primary: 'group_id'
            })
    }
}

const personal = "personal"

// 获取当前房规
export async function rules_get(ctx: Context, session: Session) {
    var rules = await ctx.database.get('group_setting_v2', { group_id: (session.guildId == undefined ? personal + session.userId : session.guildId) }, ['setcoc'])
        .then(res => {
            if (res.length == 0)
                return "3"
            else
                return res[0].setcoc
        })

    return rules
}

// 设置房规
export async function cocset(ctx: Context, session: Session, num: string) {
    var gid = session.guildId == undefined ? personal + session.userId : session.guildId

    switch (num + "") {
        case "1":
        case "2":
        case "3":
            // 检查有没有设置
            var prom = await ctx.database.get('group_setting_v2', { group_id: gid })
                .then(res => {
                    if (res.length == 0) {
                        ctx.database.create('group_setting_v2', { group_id: gid, setcoc: num, dice_face: 100 })
                    } else {
                        ctx.database.set('group_setting_v2', { group_id: gid }, { setcoc: num })
                    }
                    return session.text("Norn_Dice.其他.房规更改", {'rule': num})
                })
                .catch(err => err + "")
            break;

        default:
            return "请输入房规设置，详情可使用 cocset -h 指令查看。"
            break;
    }
    return prom
}

// 设置骰子面数
export async function dface(ctx: Context, session: Session, num: string) {
    var gid = session.guildId == undefined ? personal + session.userId : session.guildId
    var num_ = Number(num)

    if (Number.isNaN(num_))
        num_ = 100

    var prom = await ctx.database.get('group_setting_v2', { group_id: gid })
        .then(res => {
            if (res.length == 0) {
                ctx.database.create('group_setting_v2', { group_id: gid, dice_face: num_ })
            } else {
                ctx.database.set('group_setting_v2', { group_id: gid }, { dice_face: num_ })
            }
            return session.text("Norn_Dice.其他.房规更改", {'dface': num_})
        })

    return prom
}

// 检测是否群聊
function isGroup(session: Session) {
    return session.guildId != undefined;
}

// 骰子开关
export async function bot_off_on(ctx: Context, session: Session, isOn: boolean) {
    if (!isGroup(session))
        return '本指令仅群聊可用'

    var prom = await ctx.database.get('group_setting_v2', { group_id: session.guildId })
        .then(res => {
            if (res.length == 0) {
                ctx.database.create('group_setting_v2', { group_id: session.guildId, bot_on: isOn, dice_face: 100 })
            } else {
                ctx.database.set('group_setting_v2', { group_id: session.guildId }, { bot_on: isOn })
            }
        })

    var said = isOn ? 'Norn_Dice.骰子开关.成功开启' : 'Norn_Dice.骰子开关.成功关闭'

    return said
}

// 技能成长
export async function en(ctx: Context, session: Session, ...args) {
    // 报错
    if (args.length == 0)
        return "Norn_Dice.投掷.成长检定.错误_缺参"
    else if (args.length > 3) 
        return "指令错误，请发送en -h查看指令详情。"
    

    var json = {}

    // 默认值
    var fail_exp = "0", succ_exp = "1d10"

    // 1个参数是技能
    var prom = await getCard(ctx, session).then(res => res[1])
    var skill = args[0]

    // 取糖
    if (pc_skill_sugar[skill] != undefined)
        skill = pc_skill_sugar[skill]


    // 2个参数是技能 + 失败/成功
    if (args.length == 2) {
        if (args[1].indexOf("/") != -1) {
            var exps = args[1].split("/")

            if (exps.length > 2)
                return "增长表达式错误！请发送en -h查看指令详情。"

            fail_exp = exps[0]
            succ_exp = exps[1]
        }

        // 3个参数是技能 + 失败 + 成功
    } else if (args.length == 3) {
        fail_exp = args[1]
        succ_exp = args[2]

    }

    // 没有这个技能，你小子……
    var org = Number.isNaN(Number(prom[skill])) ? 0 : prom[skill]

    json['org'] = org
    var now = eval(org + "+" + exp)
    json['now'] = now
    json['skill'] = skill

    // 开始检定
    var rules = await rules_get(ctx, session).then(res => res)

    var result = r_check(org, rules)

    json['result'] = "1d100 = " + result[0][0]['out'] + "/" + org
    var passLv = result[0][0]['passLv']
    json['passLv'] = passLv

    var said = session.text("Norn_Dice.投掷.成长检定.检定句子", json)

    // 成功失败加值
    var said_v2 = "", exp
    if(passLv == level_str.大失败 || passLv == level_str.失败){
        if(isExpre(fail_exp))
            exp = await throw_roll(ctx, session, fail_exp).then(res => res.result)
        else
            exp = fail_exp

        json['exp'] = fail_exp + " = " + exp

        said_v2 = session.text("Norn_Dice.投掷.成长检定.检定失败", json)
    }else{
        if(isExpre(succ_exp))
            exp = await throw_roll(ctx, session, succ_exp).then(res => res.result)
        else
            exp = succ_exp
            
        json['exp'] = succ_exp + " = " + exp

        said_v2 = session.text("Norn_Dice.投掷.成长检定.成功通过", json)
    }

    said += said_v2

    // 存入数据库
    await st_skill(ctx, session, skill + now)

    return said
}