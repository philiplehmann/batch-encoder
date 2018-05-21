/*eslint-env node */
'use strict'
const Queue = require('bull')

const { port, host } = require('./redis-server')

exports.analyzeVideo = new Queue('analyzeVideo', { redis: {port: port, host: host } })
exports.encodeVideo = new Queue('encodeVideo', { redis: {port: port, host: host } })
exports.muxVideo = new Queue('muxVideo', { redis: {port: port, host: host } })
exports.replaceFile = new Queue('replaceFile', { redis: {port: port, host: host } })
