import { Dict, Schema } from "koishi"

export interface Config {
    Bot_Info: Array<string>,

    roll: Roll,
    pc: PC,
    bot: Bot,
    log: Log,
}

interface Roll {
    r_sence: string,
    r_sence_reasoned: string,
    rh_sence: string,
    rh_sence_reasoned: string,
    rc_sence: string,
    rc_sence_mult: string,
    r_bouns_sence: string,
    r_check_bouns_sence: string,

    rc_sence_passLv: object,
    sc_sence_passLv: object,

    skill: object

}

interface PC {
    st_sence: string,
    rename_sence: string,
    create_sence: string,
    create_error: string,
    change_sence: string,
    st_change: string
}

interface Bot {
    on_succ: string,
    on_fail: string,
    off_succ: string,
    off_fail: string
}

interface Log {
    log_on: string,
    log_on_fail: string,
    log_on_fail2: string,
    log_off: string,
    log_off_fail: string,
    log_new: string,
    log_new_fail: string,
}

export const Config: Schema<Config> = Schema.object({
    Bot_Info: Schema.array(Schema.string().default("测试行")).description('骰子信息，换行请使用添加项'),

    bot: Schema.object({
        on_succ: Schema.string().default("开启成功").description("成功开启"),
        on_fail: Schema.string().default("已经开启").description("开启失败"),
        off_succ: Schema.string().default("关闭成功").description("成功关闭"),
        off_fail: Schema.string().default("没开").description("关闭失败")
      }).description("骰子开关"),

    roll: Schema.object({
        r_sence: Schema.string().default("出目：\n{resultDetail}{exp} = {result}").description('普通投掷'),
        r_sence_reasoned: Schema.string().default("{reason}：\n{resultDetail}{exp} = {result}").description('带理由的投掷'),
        rh_sence: Schema.string().default("群聊{groupID}暗骰的结果:\n{result}").description('暗骰'),
        rh_sence_reasoned: Schema.string().default("{pc_name}的心理学检定结果:\n{result}").description('暗骰,但心理学检定'),
        rc_sence: Schema.string().default("{reason}鉴定：\n{result}").description('普通鉴定，将配合鉴定结果语句显示'),
        rc_sence_mult: Schema.string().default("{reason}的多重鉴定：\n{resultDetail}").description('多重检定'),
        r_bouns_sence: Schema.string().default("出目：\n{exp} = {resultDetail} = {result}").description('奖励/惩罚骰'),
        r_check_bouns_sence: Schema.string().default("{reason}鉴定：\n{exp} = {resultDetail} = {result}").description('奖励/惩罚骰检定'),

        rc_sence_passLv: Schema.object({
            '成功': Schema.string().default("成功").description('普通成功'),
            '困难成功': Schema.string().default("困难成功").description('困难成功'),
            '极难成功': Schema.string().default("极难成功\n不错").description('极难成功'),
            '大成功': Schema.string().default("大成功\n希望有用在正确的地方").description('大成功'),
            '失败': Schema.string().default("失败").description('失败'),
            '大失败': Schema.string().default("大失败\n……").description('大失败'),

        }).description('技能检定结果句子'),

        sc_sence_passLv: Schema.object({
            'sancheck': Schema.string().default("{player}的理智检定：\n{result}").description('理智检定句子'),

            '成功': Schema.string().default("成功").description('普通成功'),
            '困难成功': Schema.string().default("困难成功").description('困难成功'),
            '极难成功': Schema.string().default("极难成功").description('极难成功'),
            '大成功': Schema.string().default("大成功\n吓不倒你吗？").description('大成功'),
            '失败': Schema.string().default("失败").description('失败'),
            '大失败': Schema.string().default("大失败\n很可怕吗？呵呵……").description('大失败'),

            'san_change': Schema.string().default("\n理智变化：{org} => {now}（{exp}）").description("理智变化"),

            'no_insanity': Schema.string().default("{SPLIT}灵感检定：{intResult}\n{player}，无知是福。").description("疯狂检定失败"),
            'insanity': Schema.string().default("{SPLIT}灵感检定：{intResult}\n知道了不该知道的事。\n【{player}陷入临时疯狂】").description("陷入临时疯狂"),

            'bye': Schema.string().default("\n再见了。\n【{player}陷入永久疯狂】").description("SAN值归0"),

        }).description('理智检定结果句子'),

        skill: Schema.object({
            "sence": Schema.string().default("{player}的{skill}成长检定：\n{result}").description("检定句子"),
            "succ": Schema.string().default("{passLv} \n{org} => {now}\n（成长了{exp} 点）").description("成功通过"),
            "fail": Schema.string().default("{passLv} \n{org} => {now}\n（变化了 {exp} 点）").description("检定失败")
        })
            .description('成长检定')
    })
        .description('投掷句子设置'),

    pc: Schema.object({
        st_sence: Schema.string().default("我看见了：\n{result}").description('查询技能结果'),
        rename_sence: Schema.string().default("已重命名人物卡：{org} => {now}").description("重命名"),
        create_sence: Schema.string().default("已创建角色卡：\n{name}\n请以 .st 指令设置角色卡技能").description("创建角色卡"),
        create_error: Schema.string().default("角色卡重名！\n存在角色卡：{name}").description("角色卡重名"),
        change_sence: Schema.string().default("切换成功。\n当前人物卡：{name}").description("切换角色卡"),
        st_change: Schema.string().default("属性已修改。\n{result}").description("修改属性，修改条数少于5才会显示result（避免刷屏）"),
    })
        .description('人物卡句子设置'),
    
    log: Schema.object({
        log_on: Schema.string().default("开启成功。").description("开始记录"),
        log_on_fail: Schema.string().default("开启失败：已开启。").description("开启错误"),
        log_on_fail2: Schema.string().default("开启失败：没有指定的日志。").description("继续错误"),
        log_off: Schema.string().default("已暂停记录。").description("暂停记录"),
        log_off_fail: Schema.string().default("没有开始的日志。").description("暂停错误"),
        log_new: Schema.string().default("已新建日志。").description("新建日志"),
        log_new_fail: Schema.string().default("已存在日志！").description("新建日志失败"),
    })
        .description('Log句子设置')
})