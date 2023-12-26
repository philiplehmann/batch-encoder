import { exec, spawn } from 'node:child_process';
import { F_OK } from 'node:constants';
import crypto from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, unlink } from 'node:fs/promises';
import path from 'node:path';
import Bull from 'bull';

const ROOT_DIR = path.dirname(__dirname);
const TMP_DIR = path.join(ROOT_DIR, 'tmp');
const FINAL_DIR = path.join(ROOT_DIR, 'final');

const PER_PIXEL = 0.5;

import { binaries, codecs, systemProperties } from './config';

interface EncodeVideoProps {
  scale?: string;
  codec?: string;
  preset?: string;
  profile?: string;
  level?: string;
  pixel_format?: string;
  rate?: string;
  minrate?: string;
  maxrate?: string;
  tier?: string;
}

const durationHelper = (match: RegExpMatchArray, all: string) => {
  if (match && match.length > 1) {
    const date = match[1];
    const [hhmmss, msString] = date.split('.');
    const ms = Number(msString);
    const [hh, mm, ss] = hhmmss.split(':').map(Number);
    return hh * 60 * 60 * 1000 + mm * 60 * 1000 + ss * 1000 + ms * 10;
  }
  console.log(all);
  return 0;
};

export const Encoder = {
  async exists(file: string) {
    return await access(file, F_OK);
  },

  async unlink(file: string) {
    return await unlink(file);
  },

  copy(source: string, destination: string) {
    return new Promise((resolve, reject) => {
      try {
        const is = createReadStream(source);
        const os = createWriteStream(destination);

        is.pipe(os);
        is.on('end', resolve);
        is.on('error', reject);
      } catch (e) {
        reject(e);
      }
    });
  },

  checkForCropping(file: string) {
    return new Promise((resolve, reject) => {
      Encoder.exists(file).then(async () => {
        const { FFMPEG } = await binaries;

        const ffmpeg = spawn(FFMPEG, [
          '-ss',
          '600',
          '-i',
          file,
          '-vframes',
          '10000',
          '-vf',
          'cropdetect',
          '-f',
          'null',
          '-',
        ]);

        ffmpeg.stdout.on('data', (data) => {
          console.log(`stdout: ${data}`);
        });
        let stderr = '';
        ffmpeg.stderr.on('data', (data) => {
          stderr += data;
        });
        ffmpeg.on('close', (code) => {
          const match = stderr.match(/(crop=[\d]*:[\d]*:[\d]*:[\d]*)/);
          resolve(match ? match[0] : null);
        });
      }, reject);
    });
  },

  analyzeVideo(file: string) {
    return new Promise((resolve, reject) => {
      Encoder.exists(file).then(
        async () => {
          const { FFPROBE } = await binaries;
          const cmd = `${FFPROBE} -v quiet -print_format json -show_streams "${file}"`;
          exec(cmd, (error, stdout, stderr) => {
            if (error) {
              reject(error);
            } else {
              let data = null;
              try {
                data = JSON.parse(stdout);
                console.log(data);
              } catch (e) {
                return reject(e);
              }
              const video = data.streams.find((stream: any) => {
                return stream.codec_type === 'video';
              });
              const { width, height } = video;
              if (!width || !height) {
                return reject('width or height not found');
              }
              resolve(video);
            }
          });
        },
        () => {
          reject('file does not exists');
        },
      );
    });
  },

  encodeVideo(
    file: string,
    crop: string,
    props: EncodeVideoProps,
    video: { width: number; height: number },
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    job: Bull.Job<any>,
  ) {
    return new Promise((resolve, reject) => {
      Encoder.exists(file).then(async () => {
        const { h264, h265 } = await codecs;
        let { width, height } = video;
        if (props.scale) {
          const scale = props.scale.trim().split('x');
          width = Number(scale[0]);
          height = Number(scale[1]);
        }
        let rate = '2M';
        let minrate = '1M';
        let maxrate = '3M';
        let bufsize = '6M';
        let codec: typeof h264 | typeof h265 = h264;
        let level = '4.1';
        let profile = 'main';
        if (width && height) {
          const pixels = width * height;
          if ((!props.codec && pixels > 1920 * 1080) || (props.codec && ['hevc', 'h265'].includes(props.codec))) {
            profile = 'main';
            const numRate = pixels / PER_PIXEL / 3;
            rate = String(numRate);
            minrate = String(numRate * 0.5);
            maxrate = String(numRate * 1.5);
            bufsize = String(numRate * 1.5 * 2);
            codec = h265;
            level = '6.2';
          } else {
            profile = 'high';
            const numRate = Math.round(pixels / PER_PIXEL);
            rate = String(numRate);
            minrate = String(numRate * 0.5);
            maxrate = String(numRate * 1.5);
            bufsize = String(numRate * 1.5 * 2);
          }
        }
        const defaultProps = await systemProperties;
        const propsWithDefault: Required<EncodeVideoProps> = Object.assign(
          defaultProps,
          {
            profile: profile,
            level: level,
            pixel_format: 'yuv444p',
            rate: rate,
            minrate: minrate,
            maxrate: maxrate,
            bufsize: bufsize,
            scale: null,
          },
          props,
        );

        const hmac = crypto.createHmac('sha256', file);
        const output = path.join(TMP_DIR, `${hmac.digest('hex')}.mkv`);

        if (propsWithDefault.scale) {
          propsWithDefault.scale = `scale=${propsWithDefault.scale}`;
        }

        let args = [
          '-i',
          file,
          '-c:v',
          codec,
          '-preset',
          propsWithDefault.preset,
          '-profile:v',
          propsWithDefault.profile,
          '-level',
          propsWithDefault.level,
          '-pixel_format',
          propsWithDefault.pixel_format,
          '-b:v',
          propsWithDefault.rate,
          '-minrate',
          propsWithDefault.minrate,
          '-maxrate',
          propsWithDefault.maxrate,
          //'-bufsize', props.bufsize
        ];
        if (propsWithDefault.tier) args = args.concat(['-tier', propsWithDefault.tier]);

        if (propsWithDefault.scale || crop) {
          args.push('-vf', propsWithDefault.scale ? propsWithDefault.scale : crop);
        }

        args = args.concat(['-c:a', 'copy', '-c:s', 'copy', '-c:d', 'copy', '-c:t', 'copy', output]);

        const { FFMPEG } = await binaries;
        console.log(FFMPEG, args.join(' '));
        const ffmpeg = spawn(FFMPEG, args);

        ffmpeg.stdout.on('data', (data) => {
          console.log(`stdout: ${data}`);
        });

        let durationTS = 0;
        let currentTS = 0;

        ffmpeg.stderr.on('data', (data) => {
          const duration = durationHelper(
            data.toString().match(/Duration: ([0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{2})/),
            data.toString(),
          );
          const current = durationHelper(
            data.toString().match(/time=([0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{2})/),
            data.toString(),
          );

          if (duration) {
            durationTS = duration;
          }
          if (current) {
            currentTS = current;
          }
          if (durationTS && currentTS) {
            job.progress(Math.round((100 / durationTS) * currentTS * 100) / 100);
          }
        });

        const pid = ffmpeg.pid;
        const killEvent = () => {
          ffmpeg.stdin.end();
          ffmpeg.kill();
          exec(`kill ${pid}`);
        };

        ffmpeg.on('error', (error) => {
          killEvent();
          reject(error);
        });

        ffmpeg.on('close', (code) => {
          killEvent();
          //console.log('ffmpeg close', pid, code)
          resolve(output);
        });
        ffmpeg.on('exit', (exit) => {
          killEvent();
          //console.log('ffmpeg exit', pid, exit)
        });
      }, reject);
    });
  },

  async replaceVideo(file: string, output: string) {
    await Encoder.exists(file);
    const { MKVMERGE } = await binaries;
    return new Promise((resolve, reject) => {
      const extName = path.extname(file);
      const final = path.join(FINAL_DIR, path.basename(file)).replace(new RegExp(`${extName}$`), '.mkv');
      const args = ['-o', final, '-D', '(', file, ')', '-A', '-S', '-T', '-M', '-B', '--no-chapters', '(', output, ')'];
      const mkvmerge = spawn(MKVMERGE, args);

      mkvmerge.on('error', (error) => {
        console.log('spwan error', error);
        reject();
      });

      mkvmerge.on('close', (code) => {
        Encoder.exists(final).then(() => {
          Encoder.unlink(output);
          resolve(final);
        }, reject);
      });
    });
  },
};
