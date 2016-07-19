'use strict'

const Encoder = require('./encoder_series.js')

let fileName = process.argv[2]

Encoder.encode(fileName)
