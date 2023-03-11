import { Dict, Schema } from "koishi"

export interface Config {
    open_default: boolean

}
export const Config: Schema<Config> = Schema.object({
    open_default: Schema.boolean().default(true).description("默认开启投掷功能")
})