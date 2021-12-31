const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')

const glob = require('glob')
const makeDir = require('make-dir')
const fsExtra = require('fs-extra')
const gracefulFS = require('graceful-fs')

const nodeConsoleColors = require("node-console-colors")

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
const TIMEOUT = 120 * 1000
const CONCURRENCY_COUNT = 3

console.log(`${INPUT_PATH}\r\n${OUTPUT_PATH}`)

const limit = pLimit(CONCURRENCY_COUNT)

let requestInstance = null

run()

// 开始执行
function run() {
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

    console.log(nodeConsoleColors.set('bg_cyan', `总数：${total}\r\n成功：${successCount}\r\n失败：${total - successCount}`))
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

// 输出结果
function outputResult(result, name, filename) {
  const data = result.txtResult

  const textFilename = filename.replace(OUTPUT_REGEXP, OUTPUT_SUFFIX)
  const outputFilename = path.resolve(OUTPUT_PATH, name).replace(OUTPUT_REGEXP, OUTPUT_SUFFIX)

  const textPathname = path.dirname(textFilename)
  const outputPathname = path.dirname(outputFilename)

  makeDir.sync(textPathname)
  makeDir.sync(outputPathname)

  if (OUTPUT_REGEXP.test(filename)) fs.writeFileSync(textFilename, data)
  if (OUTPUT_REGEXP.test(name)) fs.writeFileSync(outputFilename, data)
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
