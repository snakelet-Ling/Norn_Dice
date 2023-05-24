import { Context, Session } from "koishi"
import { isExpre, throw_roll } from "./roll"

// pc列表
interface pc_data {
    id: string,
    name: string,
    data: object
}

// 当前群绑定
interface pc_tag_data {
    id: string,
    group_id: string,
    name: string
}

declare module 'koishi' {
    interface Tables {
        coc_pc_data_v2: pc_data,
        coc_pc_tag_data_v2: pc_tag_data
    }
}

export default class PC {
    protected ctx: Context

    constructor(ctx: Context) {
        this.ctx = ctx

        // 创建表
        ctx.model.extend('coc_pc_data_v2', {
            id: 'string',
            name: 'string',
            data: 'json'
        },
            {
                primary: ['id', 'name']
            })

        ctx.model.extend('coc_pc_tag_data_v2', {
            id: 'string',
            group_id: 'string',
            name: 'string'
        },
            {
                primary: ['id', 'group_id']
            })
    }
}

// 默认卡
let pc_default = {
    '会计': 5, '人类学': 1, '估价': 5, '考古学': 1, '取悦': 15, '攀爬': 20,
    '计算机使用': 5, '乔装': 5, '汽车驾驶': 20, '电气维修': 10, '电子学': 1,
    '话术': 5, '斗殴': 25, '手枪': 20, '急救': 30, '历史': 5, '恐吓': 15,
    '跳跃': 20, '法律': 5, '图书馆使用': 20, '聆听': 20, '锁匠': 1, '机械维修': 10,
    '医学': 1, '博物学': 10, '导航': 10, '神秘学': 5, '操作重型机械': 1, '说服': 10,
    '驾驶': 1, '精神分析': 1, '心理学': 10, '骑术': 5, '妙手': 10, '侦查': 25,
    '潜行': 20, '生存': 10, '游泳': 20, '投掷': 20, '追踪': 10, '驯兽': 5,
    '潜水': 1, '爆破': 1, '读唇': 1, '催眠': 1, '炮术': 1
}

// 技能别称
export let pc_skill_sugar = {
    "str": "力量",
    "dex": "敏捷",
    "con": "体质",
    "siz": "体型",
    "app": "外貌",
    "int": "智力",
    "灵感": "智力",
    "pow": "意志",
    "edu": "教育",
    "知识": "教育",
    "luck": "幸运",
    "运气": "幸运",
    "hp": "体力",
    "san": "理智",
    "san值": "理智",
    "理智值": "理智",
    "mp": "魔法",
    "计算机": "计算机使用",
    "电脑": "计算机使用",
    "信用": "信用评级",
    "信誉": "信用评级",
    "cm": "克苏鲁神话",
    "克苏鲁": "克苏鲁神话",
    "汽车": "汽车驾驶",
    "图书馆": "图书馆使用",
    "开锁": "锁匠",
    "自然学": "博物学",
    "领航": "导航",
    "重型机械": "操作重型机械"

}

// 小窗绑卡
const personal = "personal"

export async function pc_list(ctx: Context, session: Session) {
    var count = await ctx.database.get('coc_pc_data_v2', { id: session.userId }, ['name'])
        .then(async res => {
            if (res.length == 0) {
                // 什么卡都没有就硬敲了吧
                ctx.database.create('coc_pc_data_v2', { id: session.userId, name: 'Default', data: pc_default })
                ctx.database.create('coc_pc_tag_data_v2', { id: session.userId, group_id: (session.guildId == undefined ? personal + session.userId : session.guildId), name: 'Default' })
                return "现有角色列表：\nDefault"

            } else {
                // 获取他现在什么卡
                var prom_ = await getCard(ctx, session)
                    .then(res => {
                        return JSON.stringify(res);
                    })

                var prom = JSON.parse(prom_)[0]

                var said = "现有角色列表：\n"
                said += "================\n"

                res.forEach(e => {
                    if (e.name == prom)
                        said += "【★】"
                    said += e.name + "\n"
                })

                said += "================\n"
                said += "★ 为当前绑定卡"
                return said
            }
        })
        .catch(err => {
            return err + ""
        })

    return JSON.stringify({ 'said': count })

}

export async function pc_new(ctx: Context, session: Session, name: string) {
    // 没有名字
    if (!name) {
        return "Norn_Dice.人物卡.错误_空名"

    } else {
        // 加入数据库

        var prom = await ctx.database.create('coc_pc_data_v2', { id: session.userId, name: name, data: pc_default })
            .then(async res => {
                // 自动绑定
                ctx.database.create('coc_pc_tag_data_v2', { id: session.userId, group_id: (session.guildId == null ? personal + session.userId : session.guildId), name: name })
                await pc_tag(ctx, session, name).then(res => res)

                var json = {}
                json['said'] = 'Norn_Dice.人物卡.创建角色卡'
                json['name'] = name
                return json
            })
            .catch(err => {
                var json = {}
                json['said'] = 'Norn_Dice.人物卡.错误_重名'
                json['name'] = name
                return json
            })

        return JSON.stringify(prom)
    }
}

export async function pc_tag(ctx: Context, session: Session, name: string) {
    // var config = getConfig()

    // 不输入默认解绑
    if (!name) {
        name = "Default"
    }

    var gid = session.guildId == undefined ? personal + session.userId : session.guildId

    // 查看有没有这张卡
    var prom = await ctx.database.get('coc_pc_data_v2', { id: session.userId, name: name })
        .then(async res => {
            if (res.length == 0) {
                // 没有则创建
                ctx.database.create('coc_pc_data_v2', { id: session.userId, name: name, data: pc_default })
            }

            // 切换前看看当前有没有记录卡
            return ctx.database.get('coc_pc_tag_data_v2', { id: session.userId, group_id: gid })
        })
        .then(res => {
            if (res.length == 0) {
                // 没有则创建
                ctx.database.create('coc_pc_tag_data_v2', { id: session.userId, group_id: gid, name: name })

            } else {
                // 有则更新
                ctx.database.set('coc_pc_tag_data_v2', { id: session.userId, group_id: gid }, { name: name })

            }

            var json = {}
            json['said'] = 'Norn_Dice.人物卡.切换角色卡'
            json['name'] = name
            return json
            // return "切换成功。\n当前人物卡：" + name
        })

    return JSON.stringify(prom)
}

export async function pc_del(ctx: Context, session: Session, name: string) {
    if (!name) {
        return "Norn_Dice.人物卡.错误_空名"

    } else if (name == "Default") {
        // 检查在不在
        return await ctx.database.get('coc_pc_data_v2', { id: session.userId, name: name })
            .then(res => {
                // 连默认都没有，你小子
                if (res.length == 0) {
                    ctx.database.create('coc_pc_data_v2', { id: session.userId, name: 'Default', data: pc_default })
                } else {
                    // ctx.database.set('coc_pc_data_v2', {id: session.userId, name: 'Default'}, {data: pc_default})
                    ctx.database.remove('coc_pc_data_v2', { id: session.userId, name: name })
                    ctx.database.create('coc_pc_data_v2', { id: session.userId, name: 'Default', data: pc_default })

                }
                return "Norn_Dice.人物卡.初始化默认卡"
            })

    } else {
        // 从数据库删除
        var json = {}
        json['name'] = name

        var prom = await ctx.database.get('coc_pc_data_v2', { id: session.userId, name: name })
            .then(res => {
                if (res.length == 0) {
                    return "Norn_Dice.人物卡.错误_无卡"

                } else {
                    ctx.database.remove('coc_pc_data_v2', { id: session.userId, name: name })
                    return "Norn_Dice.人物卡.删除角色卡"
                }
            })
            .catch(err => {
                return err + ""
            })

        json['said'] = prom
        return JSON.stringify(json)
    }
}

export async function pc_nn(ctx: Context, session: Session, name: string) {
    // var config = getConfig()

    if (name == "Default")
        return JSON.stringify({"said": "Norn_Dice.人物卡.错误_重名", "name": name})

    var prom = await getCard(ctx, session).then(res => res)

    if (name == undefined) {
        return JSON.stringify({ 'said': "Norn_Dice.人物卡.查看当前卡", "name": prom[0] })

    } else if (name == prom[0]) {
        // 已经是这张卡了！
        return JSON.stringify({ 'said': "Norn_Dice.人物卡.切换角色卡", "name": prom[0] })

    } else {
        // 如果是默认卡
        if (prom[0] == "Default") {
            // 查看新卡有否重名
            var check_new = await ctx.database.get('coc_pc_data_v2', { id: session.userId, name: name })
                .then(async res => {
                    if (res.length == 0) {
                        await ctx.database.create('coc_pc_data_v2', { id: session.userId, name: name, data: JSON.parse(JSON.stringify(prom[1])) })
                        // 初始化default
                        await pc_tag(ctx, session, name).then(res => res)
                        await pc_del(ctx, session, "Default")

                        var json = {}
                        json['said'] = "Norn_Dice.人物卡.重命名人物卡"
                        json['org'] = prom[0]
                        json['now'] = name

                        return json

                    } else {
                        return await pc_tag(ctx, session, name).then(res => res)
                    }
                })

            return JSON.stringify(check_new)

        } else {
            // 不是默认卡，进行改名
            // 不能改主键，那就生成吧x
            await ctx.database.create('coc_pc_data_v2', { id: session.userId, name: name + "", data: JSON.parse(JSON.stringify(prom[1])) })
            await pc_del(ctx, session, prom[0] + "")
            var prom_ = await pc_tag(ctx, session, name).then(res => res)

            return prom_
        }
    }
}

// 获取当前卡：[name, json]
export async function getCard(ctx: Context, session: Session) {

    var gid = session.guildId == undefined ? personal + session.userId : session.guildId

    var prom = getCard_who(ctx, session.userId, gid)

    return await prom.then(res => res)

}

// 获取他人卡接口
export async function getCard_who(ctx: Context, id: string, gid: string,) {

    var name = ""

    return await ctx.database.get('coc_pc_tag_data_v2', { id: id, group_id: gid })
        .then(async res => {
            if (res.length == 0) {
                // 没有卡，找默认卡
                name = "Default"
                return await ctx.database.get('coc_pc_data_v2', { id: id, name: 'Default' })

            } else {
                // 获取卡对应资料，检查卡是否存在
                var prom = await ctx.database.get('coc_pc_data_v2', { id: id, name: res[0].name })
                    .then(res => {
                        if (res.length == 0) {
                            name = "Default"
                            ctx.database.remove('coc_pc_tag_data_v2', { id: id, group_id: gid })
                            return ctx.database.get('coc_pc_data_v2', { id: id, name: 'Default' })
                        } else {
                            name = res[0].name
                            return res
                        }
                    })
                return prom
            }
        })
        .then(res => {
            if (res.length == 0) {
                ctx.database.create('coc_pc_data_v2', { id: id, name: 'Default', data: pc_default })
                // return pc_default
                return Promise.resolve([name, pc_default])

            } else {
                // return res[0].data
                return Promise.resolve([name, res[0].data])
            }
        })
}

// 展示卡
export async function st_show(ctx: Context, session: Session, name: string) {
    // var config = getConfig()

    // 获取他现在什么卡
    var prom_ = await getCard(ctx, session)
        .then(res => {
            return JSON.stringify(res);
        })

    var prom = JSON.parse(prom_)[1]

    var json = {}

    json['said'] = 'Norn_Dice.人物卡.查询技能结果'

    if (!name) {

        var skill = ""
        var count = 0;
        for (const key in prom) {
            if(prom[key] <= 1)
                continue
            if (skill != "" && count != 0)
                skill += " "
            skill += key + prom[key]
            count++
            if (count == 4) {
                skill += "\n"
                count = 0
            }
        }

        json['result'] = skill

    } else {
        // 重定向技能别称
        if (pc_skill_sugar[name] != undefined)
            name = pc_skill_sugar[name]

        json['result'] = name + " => " + (prom[name] == undefined ? 1 : prom[name])

    }
    return JSON.stringify(json)
}

// 设置卡
export async function st_skill(ctx: Context, session: Session, skill: string) {
    // var config = getConfig()

    // 技能走前头哦
    if (Number.parseInt(skill[0]) + "" != "NaN")
        return "指令错误！请使用 st 指令查看帮助示例。"

    // 获取当前卡
    var prom_ = await getCard(ctx, session)
        .then(res => {
            return JSON.stringify(res);
        })

    var prom = JSON.parse(prom_)

    // 'name': 'str', 'old': 50, 'now': 60
    var skill_change = []

    // 如果是运算
    if (skill.search(/\+|-|\*|\d+\/\d+/) != -1) {
        var ahi = skill.match(/(.*?)(\+|-|\*|\/)(.*)/)

        // 如果还有表达式
        if (isExpre(ahi[3])) {
            var ans = await throw_roll(ctx, session, ahi[3]).then(res => res)
            ahi[3] = ans.result + ""
        }

        // 技能重定向
        if (pc_skill_sugar[ahi[1]] != undefined)
            ahi[1] = pc_skill_sugar[ahi[1]]

        // 新旧数值记录
        var change = { 'name': ahi[1], 'old': prom[1][ahi[1]] }

        prom[1][ahi[1]] = eval((prom[1][ahi[1]] == undefined ? 0 : prom[1][ahi[1]]) + ahi[2] + ahi[3])

        change['now'] = prom[1][ahi[1]]

        skill_change.push(change)

    } else {
        // 分拆录入资料
        var skill_group = skill.replace(/(\D+)\/(\D+)(\d+)/,"$1$3$2$3")
            .replace(/(\d+)/g, ",$1")
            .replace(/(\d+)(\D+)/g, "$1,$2")

        var skill_group_arr = skill_group.split(",")

        // 逐个录入
        // var said = ""
        for (let i = 0; i < skill_group_arr.length; i += 2) {
            // said += skill_group_arr[i] + " => " + skill_group_arr[i+1]
            var name = skill_group_arr[i]

            if (pc_skill_sugar[name] != undefined)
                name = pc_skill_sugar[name]

            // 新旧数值记录
            var change = { 'name': name, 'old': prom[1][name] }

            // 修改
            prom[1][name] = Number(skill_group_arr[i + 1])

            change["now"] = prom[1][name]

            skill_change.push(change)
        }
    }

    // 小于等于1的全吃了
    for (let i = 0; i < prom[1].length; i++) {
        if (Number(prom[1][i]) <= 1)
            prom[1][i] = null
    }

    // json改好了，改数据库
    // return prom[0] + ", " + JSON.stringify(prom[1])
    ctx.database.set('coc_pc_data_v2', { id: session.userId, name: prom[0] }, { data: prom[1] })

    var said_v2 = ""
    if (skill_change.length <= 5) {
        skill_change.forEach(e => {
            if (said_v2 != "")
                said_v2 += "\n"

            said_v2 += e.name + ": " + (e.old == undefined ? 0 : e.old) + " => " + e.now
        });
    }

    var json = {}
    json['said'] = 'Norn_Dice.人物卡.修改属性'
    json['result'] = said_v2

    return JSON.stringify(json)
}