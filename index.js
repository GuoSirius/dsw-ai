const fs = require('fs')
const path = require('path')

const glob = require('glob')
const fsExtra = require('fs-extra')
const gracefulFS = require('graceful-fs')

const Base64 = require('js-base64')

const INPUT_PATTERN = '**/*.@(jpg|png)'
const INPUT_PATH = path.posix.join(process.argv[2] || 'E:\\workspace\\sirius-admin\\packages\\AI\\郭之存-txt')
const OUTPUT_PATH = path.resolve(INPUT_PATH, 'output-text')

// /ai/api/wzsb
const BASE_URL = 'https://ai.thunisoft.com'

console.log(`${INPUT_PATH}\r\n${OUTPUT_PATH}`)

run()

// 开始执行
function run() {
  const fileLists = getFileLists()

  const filename = path.resolve(INPUT_PATH, fileLists[0])

  const fileBase64 = readFileBase64(filename)

  sendRequest(fileBase64)
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

// 发送请求
function sendRequest() {}

