import { Dict, Schema } from "koishi"

export interface Config {
    master_qq: Array<number>,
    open_default: boolean,
    hidden_command: boolean,
    req: Req
}

interface Req {
    guild_req: boolean,
    friend_req: boolean,
}

export const Config: Schema<Config> = Schema.object({
    master_qq: Schema.array(Schema.number()).description("骰主号码（可多于一个）"),
    open_default: Schema.boolean().default(true).description("默认开启投掷功能"),
    hidden_command: Schema.boolean().default(false).description("隐藏指令（方便自定义帮助）"),
    req: Schema.object({
        guild_req: Schema.boolean().default(true).description("拉群申请"),
        friend_req: Schema.boolean().default(true).description("好友申请")
    }).description("是否自动同意")
})