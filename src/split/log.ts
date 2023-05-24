import * as fs from "fs"
import { Context, Logger, Session } from "koishi"
import path from "path"
import { getPrefixReg } from "../module/coc"
// import { Curl } from 'node-libcurl'
// import axios from 'axios'

const debug = new Logger("debug")

declare module 'koishi' {
    interface Tables {
        group_logging_v2: group_logging,
        group_logging_data_v2: group_logging_data
    }
}

// 当前群日志列表
interface group_logging {
    group_id: string,
    log_name: string,
    id: number,
    last_call: Date,
}

interface group_logging_data {
    id: number,
    data_id: number,
    // 消息的记录时间(时分秒)
    date: Date,
    // 来自谁，格式：（QQ）名称
    from: string,
    message: string
}

export default class group_log {
    protected ctx: Context

    constructor(ctx: Context) {
        this.ctx = ctx

        // 创建表
        ctx.model.extend('group_logging_v2', {
            group_id: 'string',
            log_name: 'string',
            last_call: 'date',
            id: 'unsigned',
        }, {
            autoInc: true
        })

        ctx.model.extend('group_logging_data_v2', {
            id: 'unsigned',
            // link to logging-id
            data_id: 'unsigned',
            date: 'time',
            from: 'string',
            message: 'text'
        }, {
            autoInc: true
        })
    }
}

// log new
export async function log_new(ctx: Context, session: Session, name: any) {
    if (!session.guildId)
        return "Norn_Dice.Log.错误信息_群聊"
    if (name.length == 0)
        return "Norn_Dice.Log.错误信息_无名"

    name = name.join(" ")

    // 检测有否重名
    if (await hvLog(ctx, session.guildId, name))
        return "Norn_Dice.Log.错误信息_日志重名"
    // 检测有否开始
    if (await isLogging(ctx, session.guildId))
        return "Norn_Dice.Log.错误信息_正在记录"

    // 新建log
    var log_id = await ctx.database.create('group_logging_v2', { group_id: session.guildId, log_name: name, last_call: new Date }).then(res => res.id)

    keepLogging(ctx, session, name, log_id)

    return "Norn_Dice.Log.开始记录"
}

// log off
export async function log_off(ctx: Context, session: Session) {

    if (await isLogging(ctx, session.guildId)) {
        debug.info("log off")

        await ctx.database.set('group_setting_v2', { group_id: session.guildId }, { 'logging': false })
        return "Norn_Dice.Log.暂停记录"
    } else {
        debug.info("log off err")

        return "Norn_Dice.Log.暂停错误"
    }
}

// log list
export async function log_list(ctx: Context, session: Session) {
    var log_name_lst = await ctx.database.get('group_logging_v2', { group_id: session.guildId }, ['log_name'])

    if (log_name_lst.length == 0)
        return "Norn_Dice.Log.错误信息_没有日志"

    var log = await ctx.database.get('group_setting_v2', { group_id: session.guildId }, ['last_log'])
        .then(res => res[0].last_log)

    var said = "日志列表："

    log_name_lst.forEach(e => {
        said += "\n" + (e.log_name == log ? "★" : "") + e.log_name
    })

    said += "\n【★】= 最后使用的日志"

    return said
}

// log on
export async function log_on(ctx: Context, session: Session, name: any) {
    if (!session.guildId)
        return "Norn_Dice.Log.错误信息_群聊"
    if (await isLogging(ctx, session.guildId))
        return "Norn_Dice.Log.错误信息_正在记录"
        
    var log_name_lst = await ctx.database.get('group_logging_v2', { group_id: session.guildId }, ['log_name'])

    if (log_name_lst.length == 0)
        return "Norn_Dice.Log.错误信息_没有日志"

    var log_id: number

    name = name.join(" ")

    // name检查
    if (name != "") {
        // 有指定名称，先检查在不在
        if (!await hvLog(ctx, session.guildId, name))
            return "config.log.log_on_fail2"

    } else {
        // 无指定名称，获取上次
        var prom = await ctx.database.get('group_setting_v2', { group_id: session.guildId }, ['last_log']).then(res => res)
        // 上次也没有
        if (prom.length < 0)
            return "没有正在记录的log！请以log new 新建日志。"
        else {
            name = prom[0].last_log
        }
    }

    // 从name获取log id
    log_id = await ctx.database.get('group_logging_v2', { group_id: session.guildId, log_name: name }, ['id']).then(res => res[0].id)

    keepLogging(ctx, session, name, log_id)

    return "Norn_Dice.Log.继续记录"
}

// log end
export async function log_end(ctx: Context, session: Session, name: any) {
    if (!session.guildId)
        return "Norn_Dice.Log.错误信息_群聊"

    await ctx.database.set('group_setting_v2', { group_id: session.guildId }, { logging: false })

    name = name.join(" ")

    // name检查
    if (name != "") {
        // 有指定名称，先检查在不在
        if (!await hvLog(ctx, session.guildId, name))
            return "Norn_Dice.Log.错误信息_没有文件"

    } else {
        // 无指定名称，获取上次
        var prom_ = await ctx.database.get('group_setting_v2', { group_id: session.guildId }, ['last_log']).then(res => res)
        // 上次也没有
        if (prom_.length < 0)
            return "没有正在使用的log！请以log new 新建日志。"
        else {
            name = prom_[0].last_log
        }
    }

    // 从name获取log id
    var log_id = await ctx.database.get('group_logging_v2', { group_id: session.guildId, log_name: name }, ['id']).then(res => res[0].id)

    // 创建本地文件
    const file_path = path.join(ctx.baseDir, "norn_logs", session.guildId)

    // 创建位置
    if (!fs.existsSync(file_path)) {
        fs.mkdirSync(file_path, { recursive: true })
    }

    // 获取群正在编辑文件名称
    var ws = fs.createWriteStream(path.join(file_path, name + ".txt"), { encoding: 'utf-8' })

    session.send("Norn_Dice.Log.生成日志")

    // 捞数据
    var prom = await ctx.database.get('group_logging_data_v2', { data_id: log_id })

    prom.forEach(e => {
        ws.write(e.from + " " + e.date.getHours() + ":" + e.date.getMinutes() + ":" + e.date.getSeconds())
        ws.write("\n" + e.message + "\n")
    })

    ws.end(async () => {
        var json = {}
        // 群文件
        await session.onebot.uploadGroupFile(session.guildId, path.join(file_path, name + ".txt"), name + ".txt")
            .catch(async err => {
                session.send("Norn_Dice.Log.错误信息_上传失败")


                var header = {}
                var body = {}

                // 定义文件
                var file = fs.createReadStream(path.join(file_path, name + ".txt"))

                header = {
                    headers: {
                        "Content-Type": "multipart/form-data"
                    }
                }
                body = {
                    'file': file
                }

                // anonfiles

                debug.info("starting upload anonfiles...")
                var prom = await ctx.http.post('https://api.anonfiles.com/upload?token=699f404b4a263a65',
                    body,
                    header)
                    .then((res) => {
                        debug.info("succ")

                        json['said'] = "Norn_Dice.Log.上传到网络"
                        json['url'] = res.data['data']['file']['url']['full']
                        return true
                    })
                    .catch(async err => {
                        debug.info("fail")

                        debug.info("starting upload file.io...")

                        // file.io
                        await ctx.http.post('https://file.io/?expires=3d',
                            body,
                            header
                        )
                            .then((res) => {
                                debug.info("succ")

                                debug.info(res)

                                json['said'] = "Norn_Dice.Log.上传到网络"
                                json['url'] = res.link

                            })
                            .catch(err => {
                                debug.info("fail")
                                debug.info(err)

                                json['said'] = "Norn_Dice.Log.错误信息_上传网盘失败"
                            })
                    })

            })
            .finally(() => {
                fs.rm(path.join(file_path, name + ".txt"),
                    (err) => debug.info(err)
                )
                session.send(JSON.stringify(json))
            })
        // session.send(JSON.stringify(json))
    })

}

// 有否指定log名称
async function hvLog(ctx: Context, group_id: string, log_name: string) {
    var prom = await ctx.database.get('group_logging_v2', { group_id: group_id, log_name: log_name })
        .then(res => res.length)
        .catch(err => 0)
    return prom > 0
}

// 是否正在记录
async function isLogging(ctx: Context, group_id: string) {
    var logging = await ctx.database.get('group_setting_v2', { group_id: group_id }, ['logging'])
        .then(res => {
            return res[0].logging
        })
        .catch(async err => {
            await ctx.database.create('group_setting_v2', { group_id: group_id, logging: false })
            return false
        })

    return logging
}

// 开始记录
async function keepLogging(ctx: Context, session: Session, log_name: string, log_id: number) {

    var reg = getPrefixReg(ctx)

    // 调整log状态
    await ctx.database.set('group_setting_v2', { group_id: session.guildId }, { logging: true, last_log: log_name })

    // 更新last call
    await ctx.database.set('group_logging_v2', { id: log_id }, { last_call: new Date })

    const sending = ctx.guild(session.guildId).on('before-send', (_) => {
        ctx.database.create('group_logging_data_v2', { data_id: log_id, date: new Date, from: "(" + _.selfId + ")" + _.username, message: _.content })
    })

    const logging = ctx.guild(session.guildId).on('message', (_) => {
        ctx.database.create('group_logging_data_v2', { data_id: log_id, date: new Date(), from: "(" + _.userId + ")" + _.username, message: _.content })

        if (_.content.search(reg) != -1) {
            if (_.content.replace(reg, "").match(/logoff|log off/)
                || _.content.replace(reg, "").match(/logend|log end/)
            ) {
                sending()
                logging()
            }
        }

    })
}
