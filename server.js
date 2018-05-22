/*eslint-env node */
'use strict'

const path = require('path')
const fs = require('fs')
const Encoder = require('./src/encoder')
const Arena = require('bull-arena')
const express = require('express')
const { port, host, redisServer } = require('./src/redis-server')

redisServer.then(() => {
  const { analyzeVideo, encodeVideo, replaceFile } = require('./src/queues')

  analyzeVideo.process(1, (job) => {
    console.log(job.id, 'analyzeVideo start', JSON.stringify(job.data.file))
    return Encoder.analyzeVideo(job.data.file).then( (video) => {
      return Encoder.checkForCropping(job.data.file).then( (crop) => {
        encodeVideo.add({file: job.data.file, props: job.data.props, crop: crop, video: video})
        console.log(job.id, 'analyzeVideo finish')
        return true
      }, (error) => {
        console.log(job.id, 'analyzeVideo - checkForCropping failed', error)
        return new Error(error)
      })
    }, (error) => {
      console.log(job.id, 'analyzeVideo failed', error)
      return new Error(error)
    })
  })

  encodeVideo.process(2, (job) => {
    console.log(job.id, 'encodeVideo start', job.data.file)
    return Encoder.encodeVideo(job.data.file, job.data.crop, job.data.props, job.data.video, job).then( (output) => {
      //muxVideo.add({file: job.data.file, output: output})
      replaceFile.add({ file: job.data.file, final: output })
      console.log(job.id, 'encodeVideo finish')
      return true
    }, (error) => {
      console.log(job.id, 'encodeVideo failed')
      return new Error(error)
    })
  })

  //muxVideo.process(1, (job) => {
  //  console.log(job.id, 'muxVideo start', job.data.file)
  //  return Encoder.replaceVideo(job.data.file, job.data.output).then( (final) => {
  //    replaceFile.add({file: job.data.file, final: final})
  //    console.log(job.id, 'muxVideo finish')
  //    return true
  //  }, (error) => {
  //    console.log(job.id, 'muxVideo failed')
  //    return error
  //  })
  //})

  replaceFile.process(1, (job) => {
    return new Promise( (resolve, reject) => {
      console.log(job.id, 'replaceFile start', job.data.file)
      let { file, final } = job.data
      let extName = path.extname(file)
      let target = file.replace(new RegExp(`${extName}$`), '.mkv')
      try {
        Encoder.unlink(file)
        Encoder.copy(final, target).then( () => {
          Encoder.unlink(final)
          resolve()
          console.log(job.id, 'replaceFile finish')
        }, (error) => {
          console.log(job.id, 'replaceFile failed')
          reject(new Error(error))

        })
      } catch (e) {
        console.log(job.id, 'replaceFile failed')
        reject(e)
      }
    })
  })
})

const router = express.Router()
const arenaConfig = Arena({
  queues: [
    {
      name: "analyzeVideo",
      hostId: 'batchEncoder',
      redis: { host: host, port: port }
    },
    {
      name: "encodeVideo",
      hostId: 'batchEncoder',
      redis: { host: host, port: port }
    },
    {
      name: "muxVideo",
      hostId: 'batchEncoder',
      redis: { host: host, port: port }
    },
    {
      name: "replaceFile",
      hostId: 'batchEncoder',
      redis: { host: host, port: port }
    }
  ]
}, {
  port: 8080
})
router.use(arenaConfig)
