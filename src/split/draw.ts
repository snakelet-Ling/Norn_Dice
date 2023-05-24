import { Logger, Random } from "koishi"

import scJson from "../json/sc.json"

import name_en from "../json/name_en.json"
import name_zh from "../json/name_zh.json"
import name_jp from "../json/name_jp.json"
import { getCard } from "./pc"

export function ti_li(isTi: boolean) {

    var said = isTi ? "临时症状：\n" : "总结症状：\n"
    if (isTi) {
        said += scJson.ti[Random.int(0, scJson.ti.length)]
    } else {
        said += scJson.li[Random.int(0, scJson.li.length)]
    }

    said = said.replace("{fear}", scJson.fear[Random.int(0, scJson.fear.length)])
        .replace("{manic}", scJson.manic[Random.int(0, scJson.manic.length)])
        .replace("{轮次}", Random.int(1, 11) + "")

    return JSON.stringify({ 'said': said })
}

export async function coc_chara(session, num: number) {
    if (Number.isNaN(num))
        num = 1

    var said = session.username + "的七版COC人物作成："

    for (let i = 0; i < num; i++) {
        // {力量,体质...}
        var _3d6 = ['力量', '体质', '敏捷', '外貌', '意志', '幸运']
        var _2d6 = ['体型', '智力', '教育']

        var json = {}

        _3d6.forEach(v => {
            json[v] = (simple_roll(3, 0) * 5)
        });

        _2d6.forEach(v => {
            json[v] = (simple_roll(2, 6) * 5)
        })

        var sum = 0
        var index = 0;
        for (const key in json) {
            if (index % 3 == 0)
                said += "\n"
            said += " " + key + json[key]
            sum += json[key]

            index++
        }

        said += "\nDB" + db_count(json['力量'], json['体型'])
        said += " HP" + Math.floor((json['体质'] + json['体型']) / 10)
        said += " 总和[" + (sum - json['幸运']) + "/" + sum + "]"

        if ((i + 1) % 5 == 0) {
            said += "{SPLIT}"
        } else {
            said += "\n"
        }
    }

    return said
}

// 名字
export function draw_name(args) {

    args = args.join(",")

    // 什么语种
    var area = args.match(/en|jp|zh/)

    var area_draw =
        area == 'en' ?
            name_en
            : area == 'jp' ?
                name_jp
                : name_zh

    // 多少个
    var num =
        args.match(/\d+/) == null ?
            5
            : args.match(/\d+/)[0]

    // 指定性别（可null）
    var gender = args.match(/[男女]/)

    // 开始抽卡
    var said = ""

    for (var i = 0; i < num; i++) {
        if (said != "")
            said += "，"

        // 不指定性别就随机
        if (gender == null)
            gender =
                Random.int(0, 2) == 0 ?
                    "男"
                    : "女"

        // 砌名字
        // 外国人先名后姓
        if (area == 'en')
            said += drawA(area_draw.first_name[gender], area_draw.last_name, area)
        else
            said += drawA(area_draw.last_name, area_draw.first_name[gender], area)
    }
    return said
}

// 简单的投点
function simple_roll(dice_number: number, add: number) {
    var sum = 0
    for (let i = 0; i < dice_number; i++) {
        sum += Random.int(1, 7)
    }
    sum += add
    return sum
}

// DB计算
function db_count(str: number, siz: number) {
    var sum = str + siz
    if (sum <= 64) {
        return '-2'
    } else if (sum <= 84) {
        return '-1'
    } else if (sum <= 124) {
        return '0'
    } else if (sum <= 164) {
        return '1d4'
    } else if (sum <= 204) {
        return '1d6'
    } else if (sum <= 284) {
        return '2d6'
    } else if (sum <= 364) {
        return '3d6'
    } else if (sum <= 444) {
        return '4d6'
    } else {
        return '5d6'
    }
}

// 名字抽卡
function drawA(firName, latName, area) {
    var a = Random.int(0, firName.length),
        b = Random.int(0, latName.length)

    var res = ""

    if (area == 'jp') {
        res = firName[a][0] + latName[b][0]
            + "（" + firName[a][2] + latName[b][2] + "）"
    } else if (area == 'en')
        res = firName[a] + "·" + latName[b]
    else
        res = firName[a] + latName[b]

    return res
}