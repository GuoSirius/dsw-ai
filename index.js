const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')

const glob = require('glob')
const makeDir = require('make-dir')
const fsExtra = require('fs-extra')
const gracefulFS = require('graceful-fs')

const nodeConsoleColors = require("node-console-colors")

const moment = require('moment')
const axios = require('axios')
const pLimit = require('p-limit')
const Base64 = require('js-base64')

const INPUT_SUFFIX = 'jpg|jpeg|png|bmp'
const INPUT_REGEXP = new RegExp(`\\.(${INPUT_SUFFIX})$`, 'i')
const INPUT_PATTERN = `**/*.@(${INPUT_SUFFIX})`
const INPUT_PATH = path.posix.join(process.argv[2] || 'D:\\workspace\\packages\\AI\\郭之存-txt')
// const INPUT_PATH = path.posix.join(process.argv[2] || 'E:\\workspace\\sirius-admin\\packages\\AI\\郭之存-txt')
const OUTPUT_PATH = path.resolve(INPUT_PATH, 'output-text')
const OUTPUT_SUFFIX = '.txt'
const IGNORE_REGEXP = /(ignore|ok|done|doing)/i

// /ai/api/wzsb
const BASE_URL = 'https://ai.thunisoft.com'
const TIMEOUT = 180 * 1000
const CONCURRENCY_COUNT = 3

console.log(`${INPUT_PATH}\r\n${OUTPUT_PATH}`)

const limit = pLimit(CONCURRENCY_COUNT)

let requestInstance = null

run()

// 开始执行
function run() {
  const begin = moment()
  const promiseLists = []

  const fileLists = getFileLists()
  const validFileLists = fileLists.filter(item => !IGNORE_REGEXP.test(item))

  // console.log(validFileLists)

  // validFileLists.slice(-1).forEach(item => {
  validFileLists.forEach(item => {
    function _recognizeOCR() {
      const filename = path.resolve(INPUT_PATH, item)
      const fileBase64 = readFileBase64(filename)

      const requestPromise = recognizeOCR(fileBase64)

      requestPromise
        .then(result => {
          console.log(nodeConsoleColors.set('fg_cyan', filename))

          outputResult(result, item, filename)
        })
        .catch(error => {
          console.log(nodeConsoleColors.set('fg_red', filename))

          return Promise.reject(error)
        })

      return requestPromise
    }

    const promise = limit(_recognizeOCR)

    promiseLists.push(promise)
  })

  Promise.allSettled(promiseLists).then(results => {
    const total = results.length
    const successCount = results.filter(item => item.status === 'fulfilled').length

    const delta = moment().diff(begin, 'second', true)

    console.log(nodeConsoleColors.set('bg_red', `耗时：${delta} 秒`))
    console.log(nodeConsoleColors.set('bg_cyan', `总数：${total}`))
    console.log(nodeConsoleColors.set('bg_cyan', `成功：${successCount}`))
    console.log(nodeConsoleColors.set('bg_red', `失败：${total - successCount}`))
  })
}

// 获取文件列表
function getFileLists() {
  if (!fs.existsSync(INPUT_PATH)) return []

  const inputStat = fs.statSync(INPUT_PATH)

  if (inputStat.isFile()) {
    if (INPUT_REGEXP.test(INPUT_PATH)) {
      return [path.resolve(INPUT_PATH)]
    }

    return []
  }

  const fileLists = glob.sync(INPUT_PATTERN, { 
    // debug: true,
    cwd: INPUT_PATH, 
    nosort: false, 
    nonull: false,
    nocase: true,
    nodir: true,
    matchBase: true,
    // realpath: true,
    // absolute: true,
    ignore: ['*@(ignore|ok|done|doing)*/**']
  })

  return fileLists
}

// 读取文件Base64
function readFileBase64(filename) {
  const uint8ArrayBuffer = fs.readFileSync(filename)
  const fileBase64 = Base64.fromUint8Array(uint8ArrayBuffer)

  return fileBase64
}

// 处理标点符号
function dealPunctuation(text) {
  return String(text)
    // 标点
    .replace(/[，、]/g, ',')
    .replace(/[。]/g, '.')
    .replace(/[？]/g, '?')
    .replace(/[！]/g, '!')
    .replace(/[：]/g, ':')
    .replace(/[；]/g, ';')
    .replace(/[【〔]/g, '[')
    .replace(/[】〕]/g, ']')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[“”]/g, '"')
    .replace(/[——]/g, '-')
    // 身份证号
    .replace(/((?<!\d)([1-9]\d{5})([1-9]\d{3})((?:0[1-9])|(?:1[0-2]))((?:0[1-9])|(?:[12]\d)|(?:3[01]))(\d{3})([\dXx])(?!\d))/g, '{{idcard:$1}}')
    // 日期时间
    .replace(/(?<=[\[\(]\s*)((?:\d\s*?){4})(?=\s*[\]\)])/g, '{{time:$1}}')
    .replace(/((?:[一二](?:0|\D){3,6}?年)(?:.+?月)?(?:.+?[日号])?)/g, '{{time:$1}}')
    .replace(/((?:(?<!\d)[1-9]\s*(?:\d\s*){3}[-年.\/])(?:(?:\s*\d){1,2}(?:\s*[-月.\/]))?(?:(?:\s*\d){1,2}(?:\s*[日号])?)?(?:\s*(?:\d\s*){1,2}[:时])?(?:\s*(?:\d\s*){1,2}[:分])?(?:\s*(?:\d\s*){1,2}秒?)?)/g, '{{time:$1}}')
    // 地点
    // 机构
    // 人名
    // 物品
    .replace(/([白啤]\s*酒)/g, '{{item_name:$1}}')
    .replace(/(乙\s*醇)/g, '{{item_name:$1}}')
    .replace(/(酒\s*精)/g, '{{item_name:$1}}')
    .replace(/(杯\s*子)/g, '{{item_name:$1}}')
    .replace(/([酒水]\s*杯)/g, '{{item_name:$1}}')
    .replace(/(手\s*机)/g, '{{item_name:$1}}')
    .replace(/((?:笔\s*记\s*本\s*)?电\s*脑)/g, '{{item_name:$1}}')
    .replace(/(麻\s*将)/g, '{{item_name:$1}}')
    .replace(/(扑\s*克\s*牌)/g, '{{item_name:$1}}')
    .replace(/(现\s*金)/g, '{{item_name:$1}}')
    .replace(/(人\s*民\s*币)/g, '{{item_name:$1}}')
    .replace(/(银\s*行\s*卡)/g, '{{item_name:$1}}')
    .replace(/(信\s*用\s*卡)/g, '{{item_name:$1}}')
    .replace(/(居\s*民\s*身\s*份\s*证)/g, '{{item_name:$1}}')
    .replace(/((?:[^\s](?:\s*\w\s*){6})?(?:[两二三]\s*轮\s*)?摩\s*托\s*车)/g, '{{item_name:$1}}')
    .replace(/((?:[^\s](?:\s*\w\s*){6})?电\s*动\s*(?:[两二三]\s*轮\s*)?车)/g, '{{item_name:$1}}')
    .replace(/((?:[^\s](?:\s*\w\s*){6})?[小中大]\s*(?:型\s*)?(?:普\s*通\s*)?(?:[客货]\s*)?车)/g, '{{item_name:$1}}')
    .replace(/(执\s*法\s*记\s*录\s*仪)/g, '{{item_name:$1}}')
    .replace(/(帽\s*子)/g, '{{item_name:$1}}')
    .replace(/(头\s*盔)/g, '{{item_name:$1}}')
    .replace(/(车\s*牌)/g, '{{item_name:$1}}')
    .replace(/([行驾]\s*驶\s*证)/g, '{{item_name:$1}}')
    .replace(/(人\s*民\s*警\s*察\s*证)/g, '{{item_name:$1}}')
    // 回执、告知书、笔录
    .replace(/(送\s*达\s*回\s*执)/g, '{{item_name:$1}}')
    .replace(/(行\s*政\s*拘\s*留\s*执\s*行\s*回\s*执)/g, '{{item_name:$1}}')
    .replace(/(立\s*案\s*决\s*定\s*书)/g, '{{item_name:$1}}')
    .replace(/(行\s*政\s*处\s*罚\s*决\s*定\s*书)/g, '{{item_name:$1}}')
    .replace(/((?:不\s*)?批\s*准\s*逮\s*捕\s*决\s*定\s*书)/g, '{{item_name:$1}}')
    .replace(/(退\s*回\s*补\s*充\s*侦\s*查\s*决\s*定\s*书)/g, '{{item_name:$1}}')
    .replace(/((?:解\s*除\s*)?取\s*保\s*候\s*审\s*决\s*定\s*书)/g, '{{item_name:$1}}')
    .replace(/((?:解\s*除\s*)?监\s*视\s*居\s*住\s*决\s*定\s*书)/g, '{{item_name:$1}}')
    .replace(/(道\s*路\s*交\s*通\s*事\s*故\s*认\s*定\s*书)/g, '{{item_name:$1}}')
    .replace(/(受\s*案\s*登\s*记\s*表)/g, '{{item_name:$1}}')
    .replace(/(当\s*事\s*人\s*血\s*样\s*提\s*取\s*登\s*记\s*表)/g, '{{item_name:$1}}')
    .replace(/(提\s*讯\s*证)/g, '{{item_name:$1}}')
    .replace(/(拘\s*留\s*证)/g, '{{item_name:$1}}')
    .replace(/(换\s*押\s*证)/g, '{{item_name:$1}}')
    .replace(/(提\s*讯\s*提\s*解\s*证)/g, '{{item_name:$1}}')
    .replace(/(违\s*法\s*犯\s*罪\s*记\s*录\s*证\s*明)/g, '{{item_name:$1}}')
    .replace(/(补\s*充\s*侦\s*查\s*提\s*纲)/g, '{{item_name:$1}}')
    .replace(/(提\s*请\s*批\s*准\s*逮\s*捕\s*书)/g, '{{item_name:$1}}')
    .replace(/(鉴\s*定\s*聘\s*请\s*书)/g, '{{item_name:$1}}')
    .replace(/(侦\s*查\s*终\s*结\s*报\s*告\s*书)/g, '{{item_name:$1}}')
    .replace(/(起\s*诉\s*意\s*见\s*书)/g, '{{item_name:$1}}')
    .replace(/(司\s*法\s*鉴\s*定(?:\s*意\s*见\s*书|\s*许\s*可\s*证))/g, '{{item_name:$1}}')
    .replace(/(道\s*路\s*交\s*通\s*事\s*故\s*认\s*定\s*书)/g, '{{item_name:$1}}')
    .replace(/(立\s*案\s*告\s*知\s*书)/g, '{{item_name:$1}}')
    .replace(/(移\s*送\s*起\s*诉\s*告\s*知\s*书)/g, '{{item_name:$1}}')
    .replace(/(拘\s*留\s*通\s*知\s*书)/g, '{{item_name:$1}}')
    .replace(/(鉴\s*定\s*意\s*见\s*通\s*知\s*书)/g, '{{item_name:$1}}')
    .replace(/(鉴\s*定\s*结\s*论\s*通\s*知\s*书)/g, '{{item_name:$1}}')
    .replace(/(变\s*更\s*羁\s*押\s*期\s*限\s*通\s*知\s*书)/g, '{{item_name:$1}}')
    .replace(/(刑\s*事\s*案\s*件\s*电\s*子\s*卷\s*宗)/g, '{{item_name:$1}}')
    .replace(/((?:询\s*问\s*\/\s*)?[询讯]\s*问\s*笔\s*录)/g, '{{item_name:$1}}')
    .replace(/(宣\s*布\s*刑\s*事\s*拘\s*留\s*讯\s*问\s*笔\s*录)/g, '{{item_name:$1}}')
    .replace(/(宣\s*布\s*延\s*长\s*刑\s*事\s*拘\s*留\s*期\s*限\s*讯\s*问\s*笔\s*录)/g, '{{item_name:$1}}')
    .replace(/(驾驶人信息查询结果)/g, '{{item_name:$1}}')
    .replace(/((?:事故)?(?:现场|车辆)(?:车辆)?(?:照片|视频))/g, '{{item_name:$1}}')
    .replace(/(到案经过)/g, '{{item_name:$1}}')
    .replace(/(道路交通事故现场图)/g, '{{item_name:$1}}')
    .replace(/(现场勘查笔录)/g, '{{item_name:$1}}')
    .replace(/(当事人陈述材料)/g, '{{item_name:$1}}')
    .replace(/(驾驶人信息查询结果单)/g, '{{item_name:$1}}')
    .replace(/(机动车信息查询结果单)/g, '{{item_name:$1}}')
    .replace(/(门诊病历复印件)/g, '{{item_name:$1}}')
    .replace(/(血液样本)/g, '{{item_name:$1}}')
    .replace(/(犯罪嫌疑人诉讼权利义务告知书)/g, '{{item_name:$1}}')
    .replace(/(物证密封盒)/g, '{{item_name:$1}}')
    .replace(/(行政案件权利义务告知书)/g, '{{item_name:$1}}')

}

// 输出结果
function outputResult(result, name, filename) {
  const data = result.txtResult
  const text = dealPunctuation(data)

  const textFilename = filename.replace(INPUT_REGEXP, OUTPUT_SUFFIX)
  const outputFilename = path.resolve(OUTPUT_PATH, name).replace(INPUT_REGEXP, OUTPUT_SUFFIX)

  const textPathname = path.dirname(textFilename)
  const outputPathname = path.dirname(outputFilename)

  makeDir.sync(textPathname)
  makeDir.sync(outputPathname)

  if (INPUT_REGEXP.test(filename)) fs.writeFileSync(textFilename, text)
  if (INPUT_REGEXP.test(name)) fs.writeFileSync(outputFilename, text)
}

// 识别 OCR
function recognizeOCR(base64) {
  return request({
    method: 'POST',
    url: '/ai/api/wzsb',
    data: {
      glhzzw: '1',
      img: base64,
      loaclIndex: 'wzsb',
      txjp: true,
      txxz: true,
      url: "/pict/ocrImageAndRotate"
    }
  })
}

// 请求
function request(config) {
  var _request = initializeRequest()

  return _request(config)
}

// 初始化 请求
function initializeRequest() {
  if (requestInstance) return requestInstance

  requestInstance = axios.create({
    baseURL: BASE_URL,
    timeout: TIMEOUT, // 10000
    // withCredentials: false
  })

  requestInstance.interceptors.response.use(function(response) {
    return response.data
  }, function(error) {
    return Promise.reject(error)
  })

  return requestInstance
}
