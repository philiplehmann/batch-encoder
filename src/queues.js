/*eslint-env node */
'use strict'
const Queue = require('bull')

let host = '127.0.0.1'
let port = 6379

exports.analyzeVideo = Queue('analyzeVideo', port, host)
exports.encodeVideo = Queue('encodeVideo', port, host)
exports.muxVideo = Queue('muxVideo', port, host)
exports.replaceFile = Queue('replaceFile', port, host)
