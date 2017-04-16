/*eslint-env node */
'use strict'

const path = require('path')
const fs = require('fs')
let argv = require('minimist')(process.argv.slice(3));

const { port, host, redisServer } = require('./src/redis-server')

redisServer.then(() => {
  let { analyzeVideo } = require('./src/queues')

  let folder = process.argv[2]

  let addPath = (pathName) => {
    return new Promise( (resolve, reject) => {
      let extName = path.extname(pathName)
      let stats = fs.lstatSync(pathName)
      if(stats.isDirectory()) {
        fs.readdir(pathName, (err, files) => {
          Promise.all(files.map( (file) => {
            return addPath(path.join(pathName, file))
          })).then(resolve, reject)
        })
      } else if(stats.isFile() && ['.mkv', '.mp4', '.avi', '.m4v'].indexOf(extName) >= 0) {
        console.log('add', pathName)
        analyzeVideo.add({file: pathName, props: argv})
        resolve()
      } else {
        resolve()
      }
    })
  }

  let exit = () => {
    setTimeout(() => {
      process.exit()
    }, 1000)
  }

  if(folder) {
    addPath(folder).then(exit, exit)
  } else {
    process.exit()
  }
})
