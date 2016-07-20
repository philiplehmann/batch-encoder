'use strict'

const exec = require('child_process').exec
const spawn = require('child_process').spawn
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const ROOT_DIR = path.dirname(__dirname)
const TMP_DIR = path.join(ROOT_DIR, 'tmp')
const FINAL_DIR = path.join(ROOT_DIR, 'final')

const FFMPEG_EXE = path.join(ROOT_DIR, 'bin', 'ffmpeg.exe')
const FFPROBE_EXE = path.join(ROOT_DIR, 'bin', 'ffprobe.exe')
const MKVMERGE_EXE = path.join(ROOT_DIR, 'bin', 'mkvmerge.exe')

const PER_PIXEL = 0.5

class Encoder {

  static encode(file) {
    return new Promise( (resolve, reject) => {
      this.encodeVideo(file).then( (output) => {
        this.replaceVideo(file, output).then(resolve, reject)
      }, reject)
    })
  }

  static exists(file) {
    return new Promise( (resolve, reject) => {
      try {
        fs.exists(file, (exists) => {
          exists ? resolve() : reject(`file not found: ${file}`)
        })
      } catch (e) {
        reject(`file not found: ${file}`)
      }
    })
  }

  static unlink(file) {
    try {
      fs.unlinkSync(file)
    } catch  (e) {
    }
  }

  static copy(source, destination) {
    return new Promise( (resolve, reject) => {
      try {
        let is = fs.createReadStream(source)
        let os = fs.createWriteStream(destination)

        is.pipe(os)
        is.on('end', resolve)
        is.on('error', reject)
      } catch (e) {
        reject(e)
      }
    })
  }

  static checkForCropping(file) {
    return new Promise( (resolve, reject) => {
      Encoder.exists(file).then( () => {
        let cmd = `${FFMPEG_EXE} -ss 90 -i "${file}" -vframes 90 -vf cropdetect -f null -`
        exec(cmd, (error, stdout, stderr) => {
          if(error) {
            reject(error)
          } else {
            //console.log(stderr)
            let match = stderr.match(/(crop=[\d]*:[\d]*:[\d]*:[\d]*)/)
            resolve(match ? match[0] : null)
          }
        })
      }, reject)
    })
  }

  static analyzeVideo(file) {
    return new Promise( (resolve, reject) => {
      Encoder.exists(file).then( () => {
        let cmd = `${FFPROBE_EXE} -v quiet -print_format json -show_streams "${file}"`
        exec(cmd, (error, stdout, stderr) => {
          if(error) {
            reject(error)
          } else {
            let data = null
            try {
              data = JSON.parse(stdout)
            } catch(e) {
              return reject(e)
            }
            let video = data.streams.find( (stream) => {
              return stream.codec_type == 'video'
            })
            let { width, height } = video
            if (!width || !height) {
              return reject('width or height not found')
            }
            resolve(video)
          }
        })
      }, reject)
    })
  }

  static encodeVideo(file, crop, props, video, job) {
    props = props ? props : {}
    return new Promise( (resolve, reject) => {
      Encoder.exists(file).then( () => {
        let { width, height } = video
        if(props.scale) {
          let scale = props.scale.trim().split('x')
          width = scale[0]
          height = scale[1]
        }
        let rate = '2M'
        let minrate = '1M'
        let maxrate = '3M'
        let bufsize = '6M'
        let codec   = 'nvenc_h264'
        let level   = '4.1'
        if(width && height) {
          let pixels = width * height
          if(pixels > 1920 * 1080) {
            rate = pixels / PER_PIXEL / 4
            minrate = rate * 0.5
            maxrate = rate * 1.5
            bufsize = maxrate * 2
            codec   = 'nvenc_hevc'
            level   = '6.2'
          } else {
            rate = pixels / PER_PIXEL
            minrate = rate * 0.5
            maxrate = rate * 1.5
            bufsize = maxrate * 2
          }
        }

        let defaultProperties = {
          preset: 'hq',
          profile: 'high',
          level: level,
          tier: 'high',
          pixel_format: 'yuv444p',
          rate: rate,
          minrate: minrate,
          maxrate: maxrate,
          bufsize: bufsize,
          scale: null
        }
        props = Object.assign(defaultProperties, props)

        const hmac = crypto.createHmac('sha256', file)
        let output = path.join(TMP_DIR, `${hmac.digest('hex')}.mp4`)
        Encoder.unlink(output)

        if(props.scale) {
          props.scale = `scale=${props.scale}`
        }

        let args = [
          '-i', file,
          '-c:v', codec,
          '-preset', props.preset,
          '-profile:v', props.profile,
          '-level', props.level,
          '-tier', props.tier,
          '-pixel_format', props.pixel_format,
          '-b:v', props.rate,
          '-minrate', props.minrate,
          '-maxrate', props.maxrate
          //'-bufsize', props.bufsize
        ]

        let scaleCrop = [crop, props.scale].join(' ').trim()
        if(scaleCrop) {
          args.push('-vf', scaleCrop)
        }
        args.push('-an', output)

        console.log(FFMPEG_EXE, args.join(' '))
        const ffmpeg = spawn(FFMPEG_EXE, args)

        ffmpeg.stdout.on('data', (data) => {
          console.log(`stdout: ${data}`)
        })

        let durationTS = 0;
        let currentTS = 0;

        let durationHelper = (match) => {
          if(match && match.length > 1) {
            let date = match[1]
            let [hhmmss, ms] = date.split('.')
            let [hh, mm, ss] = hhmmss.split(':')
            return hh * 60 * 60 * 1000 + mm * 60 * 1000 + ss * 1000 + ms * 10
          } else {
            return 0
          }
        }

        ffmpeg.stderr.on('data', (data) => {
          let duration = durationHelper(data.toString().match(/Duration: ([0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{2})/))
          let current = durationHelper(data.toString().match(/time=([0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{2})/))

          if(duration) {
            durationTS = duration
          }
          if(current) {
            currentTS = current
          }
          if(durationTS && currentTS) {
            job.progress(Math.round(100 / durationTS * currentTS * 100) / 100)
          }
        })

        let pid = ffmpeg.pid
        let killEvent = () => {
          ffmpeg.stdin.end()
          ffmpeg.kill()
          exec(`kill ${pid}`)
        }

        ffmpeg.on('error', (error) => {
          killEvent()
          reject(error)
        })

        ffmpeg.on('close', (code) => {
          killEvent()
          //console.log('ffmpeg close', pid, code)
          resolve(output)
        })
        ffmpeg.on('exit', (exit) => {
          killEvent()
          //console.log('ffmpeg exit', pid, exit)
        });
      }, reject)
    })
  }

  static replaceVideo(file, output) {
    return new Promise( (resolve, reject) => {
      try {
        Encoder.exists(file).then( () => {
          let final = path.join(FINAL_DIR, path.basename(file))
          let extName = path.extname(final)
          final = final.replace(new RegExp(`${extName}$`), '.mkv')
          let args = [
            '-o', final,
            '-D', '(', file, ')',
            '-A',
            '-S',
            '-T',
            '-M',
            '-B',
            '--no-chapters',
             '(', output, ')'
          ]
          const mkvmerge = spawn(MKVMERGE_EXE, args)

          mkvmerge.on('error', (error) => {
            console.log(`spwan error`, error)
            reject()
          })

          mkvmerge.on('close', (code) => {
            Encoder.exists(final).then( () => {
              Encoder.unlink(output)
              resolve(final)
            }, reject)
          })
        }, reject)
      } catch (e) {
        reject(e)
      }
    })
  }
}

module.exports = Encoder
