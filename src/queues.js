/*eslint-env node */
'use strict'
const Queue = require('bull')

const { port, host } = require('./redis-server')

exports.analyzeVideo = Queue('analyzeVideo', port, host)
exports.encodeVideo = Queue('encodeVideo', port, host)
exports.muxVideo = Queue('muxVideo', port, host)
exports.replaceFile = Queue('replaceFile', port, host)
