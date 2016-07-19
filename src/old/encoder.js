'use strict'

const exec = require('child_process').exec
const spawn = require('child_process').spawn
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

class Encoder {
  static encode(file) {
    this.checkForCropping(file).then( (crop) => {
      console.log(crop)
      this.encodeVideo(file, crop).then( (output) => {
        console.log('encodeVideo finished', output)
        this.replaceVideo(file, output)
      })
    }, (error) => {
      console.log(`error on crop check: ${error}`)
      process.exit()
    })
  }

  static exists(file) {
    return new Promise( (resolve, reject) => {
      fs.exists(file, (exists) => {
        exists ? resolve() : reject()
      })
    })
  }

  static checkForCropping(file) {
    return new Promise( (resolve, reject) => {
      this.exists(file).then( () => {
        let cmd = `.\\ffmpeg.exe -ss 90 -i "${file}" -vframes 10 -vf cropdetect -f null -`
        exec(cmd, (error, stdout, stderr) => {
          if(error) {
            reject(error)
          } else {
            // console.log(stderr)
            let match = stderr.match(/(crop=[\d]*:[\d]*:[\d]*:[\d]*)/)
            resolve(match ? match[0] : null)
          }
        })
      }, () => {
        console.log(`file not found: ${file}`)
        reject()
      })
    })
  }

  static encodeVideo(file, crop, props) {
    props = props ? props : {}
    return new Promise( (resolve, reject) => {
      this.exists(file).then( () => {
        let defaultProperties = {
          preset: 'hq',
          profile: 'high',
          level: '4.1',
          tier: 'high',
          pixel_format: 'yuv444p',
          rate: '4M',
          minrate: '2M',
          maxrate: '6M',
          bufsize: '12M'
        }
        props = Object.assign(defaultProperties, props)
        let args = [
          '-i', file,
          '-c:v', 'nvenc_h264',
          '-preset', props.preset,
          '-profile:v', props.profile,
          '-level', props.level,
          '-tier', props.tier,
          '-pixel_format', props.pixel_format,
          '-b:v', props.rate,
          '-minrate', props.minrate,
          '-maxrate', props.maxrate,
          '-bufsize', props.bufsize
        ]
        if(crop) {
          args.push('-vf', crop)
        }
        const hmac = crypto.createHmac('sha256', file)
        let output = `${hmac.digest('hex')}.mp4`

        args.push('-an', output)
        let cmd = `.\\ffmpeg.exe`
        const ls = spawn(cmd, args)
        ls.stdout.on('data', (data) => {
          console.log(`stdout: ${data}`)
        })

        ls.stderr.on('data', (data) => {
          console.log(`stderr: ${data}`)
        })

        ls.on('error', (error) => {
          console.log(`spwan error`, arguments)
          reject()
        })

        ls.on('close', (code) => {
          console.log(`child process exited with code ${code}`)
          resolve(output)
        })
      }, () => {
        console.log(`file not found: ${file}`)
        reject()
      })
    })
  }

  static replaceVideo(file, output) {
    return new Promise( (resolve, reject) => {
      this.exists(file).then( () => {
        let name = path.basename(file)
        let cmd = '.\\mkvmerge.exe'
        let args = [
          '-o', name,
          '-D', '(', file, ')',
          '-A',
          '-S',
          '-T',
          '-M',
          '-B',
          '--no-chapters',
           '(', output, ')'
        ]
        const ls = spawn(cmd, args)
        ls.stdout.on('data', (data) => {
          console.log(`stdout: ${data}`)
        })

        ls.stderr.on('data', (data) => {
          console.log(`stderr: ${data}`)
        })

        ls.on('error', (error) => {
          console.log(`spwan error`, arguments)
          reject()
        })

        ls.on('close', (code) => {
          fs.unlinkSync(output)
          resolve()
        })
      }, () => {
        console.log(`file not found: ${file}`)
        reject()
      })
    })
  }
}

module.exports = Encoder
