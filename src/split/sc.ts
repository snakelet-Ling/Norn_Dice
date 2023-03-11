import { Context, Session } from "koishi"
import { getCard, st_skill } from "./pc"
import { isExpre, level_str, r_check, throw_roll } from "./roll"
import { rules_get } from "./trivial"

export async function san_check(ctx: Context, session: Session, ...args) {

    // 理智检测
    if (args.length == 2) {
        if (Number.isNaN(Number(args[0])))
            return "Norn_Dice.投掷.理智检定.错误_理智值输入无效"

    } else {
        var prom = await getCard(ctx, session).then(res => res)
        var san = prom[1]["理智"] == undefined ?
            prom[1]["意志"] == undefined ?
                0
                : prom[1]['意志']
            : prom[1]["理智"]

        args.unshift(san)
    }

    // 表达式检测
    var exp = JSON.stringify(args[1]).replace(/"/g, "").split("/")
    if (exp.length != 2)
        return "Norn_Dice.投掷.理智检定.错误_表达式错误"

    // 都准备好了，开始施法
    var prom_ = await san_check_api(ctx, session, Number(args[0])).then(res => res[0][0])
    var json = {}

    let { out, passLv } = prom_

    json['player'] = prom[0]
    json['result'] = "1d100 = " + out + "/" + args[0]

    var said = session.text("Norn_Dice.投掷.理智检定.sancheck", json) + session.text("Norn_Dice.投掷.理智检定." + passLv)

    // 先将成功失败都变成数字好了
    var exp_v2 = []
    for (let i = 0; i < exp.length; i++) {
        if (isExpre(exp[i])) {
            var san_prom = await throw_roll(ctx, session, exp[i]).then(res => res)
            exp_v2.push(san_prom)

        } else {
            var san_prom_json = { "exp": exp[i], "result": eval(exp[i]) }
            exp_v2.push(san_prom_json)
        }
    }

    // sc 1d5+5/10+2
    // [
    //      {"middle":[{"exp":"1d5","res":"4"}],"result":9,"reason":"","exp":"1d5+5"},
    //      {"exp":"10+2","result":12}
    // ]

    // 扣理智
    var sub_san, now, exp_str
    switch (passLv) {
        case level_str.大失败:
            sub_san = eval(exp_v2[1]["exp"].replace(/d/g, "*"))
            exp_str = exp_v2[1]["exp"]
            break;

        case level_str.失败:
            sub_san = exp_v2[1]["result"]
            exp_str = exp_v2[1]["exp"]
            break;

        // 成功
        default:
            sub_san = exp_v2[0]["result"]
            exp_str = exp_v2[0]["exp"]
            break;
    }
    now = Number(args[0]) - sub_san
    if (now <= 0)
        now = 0
    st_skill(ctx, session, "san" + now)

    // said_v2 = config.roll["sc_sence_passLv"]["san_change"]
    // said_v2 = said_v2.replace("{exp}", exp_str + " = " + sub_san)
    //                     .replace("{org}", args[0])
    //                     .replace("{now}", now)
    json['exp'] = exp_str + " = " + sub_san
    json['org'] = args[0]
    json['now'] = now

    said += session.text("Norn_Dice.投掷.理智检定.理智变化", json)

    // 查询精神状态
    if (now <= 0) {   // 疯了
        said += session.text("Norn_Dice.投掷.理智检定.永久疯狂")

    } else if (sub_san >= 5) { // 灵感检定的需要
        var prom = await getCard(ctx, session).then(res => res)

        var int = prom[1]["智力"] == undefined ?
            0 :
            prom[1]["智力"]

        var prom_ = await san_check_api(ctx, session, int).then(res => res[0][0])

        let { out, passLv } = prom_
        json['intResult'] = "1d100 = " + out + "/" + int

        if (passLv == level_str.大失败 || passLv == level_str.失败)
            // 战术性智障
            var said_v2 = session.text("Norn_Dice.投掷.理智检定.疯狂检定失败", json)

        else
            // 恭喜你
            said_v2 = session.text("Norn_Dice.投掷.理智检定.临时疯狂", json)
            

        said += said_v2
    }

    return said
}

// 链过去rc的函数
async function san_check_api(ctx: Context, session: Session, target: number){
    var rules = await rules_get(ctx, session).then(res => res)
  
    return r_check(target, rules)
  }
  