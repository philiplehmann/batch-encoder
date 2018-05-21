/*eslint-env node */
'use strict'

const path = require('path')
const fs = require('fs')
const Encoder = require('./src/encoder')
const { port, host, redisServer } = require('./src/redis-server')

redisServer.then(() => {
  let { analyzeVideo, encodeVideo, replaceFile } = require('./src/queues')

  analyzeVideo.process(1, (job) => {
    console.log(job.jobId, 'analyzeVideo start', job.data.file)
    return Encoder.analyzeVideo(job.data.file).then( (video) => {
      return Encoder.checkForCropping(job.data.file).then( (crop) => {
        encodeVideo.add({file: job.data.file, props: job.data.props, crop: crop, video: video})
        console.log(job.jobId, 'analyzeVideo finish')
        return true
      }, (error) => {
        console.log(job.jobId, 'analyzeVideo failed')
        return error
      })
    }, (error) => {
      console.log(job.jobId, 'analyzeVideo failed')
      return error
    })
  })

  encodeVideo.process(2, (job) => {
    console.log(job.jobId, 'encodeVideo start', job.data.file)
    return Encoder.encodeVideo(job.data.file, job.data.crop, job.data.props, job.data.video, job).then( (output) => {
      //muxVideo.add({file: job.data.file, output: output})
      replaceFile.add({file: job.data.file, final: output})
      console.log(job.jobId, 'encodeVideo finish')
      return true
    }, (error) => {
      console.log(job.jobId, 'encodeVideo failed')
      return error
    })
  })

  //muxVideo.process(1, (job) => {
  //  console.log(job.jobId, 'muxVideo start', job.data.file)
  //  return Encoder.replaceVideo(job.data.file, job.data.output).then( (final) => {
  //    replaceFile.add({file: job.data.file, final: final})
  //    console.log(job.jobId, 'muxVideo finish')
  //    return true
  //  }, (error) => {
  //    console.log(job.jobId, 'muxVideo failed')
  //    return error
  //  })
  //})

  replaceFile.process(1, (job) => {
    return new Promise( (resolve, reject) => {
      console.log(job.jobId, 'replaceFile start', job.data.file)
      let { file, final } = job.data
      let extName = path.extname(file)
      let target = file.replace(new RegExp(`${extName}$`), '.mkv')
      try {
        Encoder.unlink(file)
        Encoder.copy(final, target).then( () => {
          Encoder.unlink(final)
          resolve()
          console.log(job.jobId, 'replaceFile finish')
        }, (error) => {
          console.log(job.jobId, 'replaceFile failed')
          reject(error)
        })
      } catch (e) {
        console.log(job.jobId, 'replaceFile failed')
        reject(e)
      }
    })
  })

  let app = require('bull-ui/app')({ redis: { host: host, port: port }})
  app.listen(8080)
  console.log('show queue ui on http://localhost:8080/')
})
