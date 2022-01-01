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
const INPUT_PATTERN = `**/*.@(${INPUT_SUFFIX})`
const INPUT_PATH = path.posix.join(process.argv[2] || 'D:\\workspace\\packages\\AI\\郭之存-txt')
// const INPUT_PATH = path.posix.join(process.argv[2] || 'E:\\workspace\\sirius-admin\\packages\\AI\\郭之存-txt')
const OUTPUT_PATH = path.resolve(INPUT_PATH, 'output-text')
const OUTPUT_REGEXP = new RegExp(`\\.(${INPUT_SUFFIX})$`, 'i')
const OUTPUT_SUFFIX = '.txt'

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

  // fileLists.slice(-1).forEach(item => {
  fileLists.forEach(item => {
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
  const fileLists = glob.sync(INPUT_PATTERN, { cwd: INPUT_PATH })

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
    // 日期时间
    .replace(/(?<=[\[\(]\s*)((?:\d\s*?){4})(?=\s*[\]\)])/g, '{{time:$1}}')
    .replace(/((?:[一二].{3,}?年)(?:.+?月)?(?:.+?[日号])?)/g, '{{time:$1}}')
    .replace(/((?:(?:\d\s*){4}[-年])(?:(?:\s*\d){1,2}(?:\s*[-月]))?(?:(?:\s*\d){1,2}(?:\s*日)?)?(?:\s*(?:\d\s*){1,2}[:时])?(?:\s*(?:\d\s*){1,2}[:分])?(?:\s*(?:\d\s*){1,2}秒?)?)/g, '{{time:$1}}')
    // 身份证号
    .replace(/(([1-9]\d{5})([1-9]\d{3})((?:0[1-9])|(?:1[0-2]))((?:0[1-9])|(?:[12]\d)|(?:3[01]))(\d{3})([\dXx]))/g, '{{idcard:$1}}')
    // 地点
    // 机构
    // 人名
    // 物品
    .replace(/(手\s*机)/g, '{{item_name:$1}}')
    .replace(/(银\s*行\s*卡)/g, '{{item_name:$1}}')
    .replace(/((?:[两二三]\s*轮\s*)?摩\s*托\s*车)/g, '{{item_name:$1}}')
    .replace(/(电\s*动\s*车)/g, '{{item_name:$1}}')
    .replace(/(小\s*车)/g, '{{item_name:$1}}')
    .replace(/((?:[^\s](?:\s*\w\s*){6})?小\s*型\s*(?:普\s*通\s*)?[客货]\s*车)/g, '{{item_name:$1}}')
    .replace(/(执\s*法\s*记\s*录\s*仪)/g, '{{item_name:$1}}')
    // 回执、告知书、笔录
    // .replace(/送\s*达\s*回\s*执/g, '送 达 回 执')
    .replace(/(送\s*达\s*回\s*执)/g, '{{item_name:$1}}')
    .replace(/(行\s*政\s*拘\s*留\s*执\s*行\s*回\s*执)/g, '{{item_name:$1}}')
    .replace(/(行\s*政\s*处\s*罚\s*决\s*定\s*书)/g, '{{item_name:$1}}')
    .replace(/(道\s*路\s*交\s*通\s*事\s*故\s*认\s*定\s*书)/g, '{{item_name:$1}}')
}

// 输出结果
function outputResult(result, name, filename) {
  const data = result.txtResult
  const text = dealPunctuation(data)

  const textFilename = filename.replace(OUTPUT_REGEXP, OUTPUT_SUFFIX)
  const outputFilename = path.resolve(OUTPUT_PATH, name).replace(OUTPUT_REGEXP, OUTPUT_SUFFIX)

  const textPathname = path.dirname(textFilename)
  const outputPathname = path.dirname(outputFilename)

  makeDir.sync(textPathname)
  makeDir.sync(outputPathname)

  if (OUTPUT_REGEXP.test(filename)) fs.writeFileSync(textFilename, text)
  if (OUTPUT_REGEXP.test(name)) fs.writeFileSync(outputFilename, text)
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
