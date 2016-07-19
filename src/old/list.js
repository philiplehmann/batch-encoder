/*eslint-env node */
'use strict'

const path = require('path')
const fs = require('fs')
const Encoder = require('./encoder_series.js')

let folder = process.argv[2]


let openFolder = (pathName) => {
  console.log('openFolder', pathName)
  return new Promise( (resolve, reject) => {
    fs.readdir(pathName, (err, files) => {
      renderFiles(pathName, files, 0, resolve)
    })
  })
}

let renderFiles = (pathName, files, index, resolve) => {
  if(files.length <= index) {
    resolve()
  } else {
    let subFile = path.join(pathName, files[index])
    let extName = path.extname(files[index])
    let stats = fs.lstatSync(subFile)
    if(stats.isDirectory()) {
      openFolder(subFile).finally( () => {
        renderFiles(pathName, files, index + 1, resolve)
      })
    } else if(stats.isFile() && ['.mkv', '.mp4'].indexOf(extName) >= 0) {
      openFile(subFile).then( () => {
        renderFiles(pathName, files, index + 1, resolve)
      }, () => {
        // retry
        renderFiles(pathName, files, index, resolve)
      })
    } else {
      renderFiles(pathName, files, index + 1, resolve)
    }
  }
}

let openFile = (pathName) => {
  console.log('openFile', pathName)
  return Encoder.encode(pathName).catch((error) => {
    console.log(error)
  })
}

openFolder(folder)
