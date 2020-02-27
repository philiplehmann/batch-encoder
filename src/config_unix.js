'use strict'

const execSync = require('child_process').execSync

const which = (command) => {
  return execSync(`which ${command}`).toString().trim()
}

exports.binaries = {
  FFMPEG: which('ffmpeg'),
  FFPROBE: which('ffprobe'),
  MKVMERGE: which('mkvmerge')
}
exports.systemProperties = {
    preset: 'veryslow',
    tier: 'high'
}
