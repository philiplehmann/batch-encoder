'use strict'

const path = require('path')

const ROOT_DIR = path.dirname(__dirname)

exports.binaries = {
  FFMPEG: path.join(ROOT_DIR, 'bin', 'ffmpeg.exe'),
  FFPROBE: path.join(ROOT_DIR, 'bin', 'ffprobe.exe'),
  MKVMERGE: path.join(ROOT_DIR, 'bin', 'mkvmerge.exe')
}
exports.systemProperties = {
  preset: 'hq',
  tier: 'high',
}
