'use strict'

const execSync = require('child_process').execSync

const isWin = /^win/.test(process.platform)
const path = isWin ? './config_win' : './config_unix'

const config = require(path)
const binaries = config.binaries
const systemProperties = config.systemProperties

let codecStr = execSync(`${binaries.FFMPEG} -codecs`).toString()

let codecs = {
  h264: codecStr.includes('nvenc_h264') ? 'nvenc_h264' : codecStr.includes('h264') ? 'h264' : false,
  h265: codecStr.includes('nvenc_hevc') ? 'nvenc_hevc' : codecStr.includes('hevc') ? 'hevc' : false
}

if(!codecs.h264 || !codecs.h265) {
  console.log('codec missing', codecs)
  process.exit()
}

exports.binaries = binaries
exports.codecs = codecs
exports.systemProperties = systemProperties
