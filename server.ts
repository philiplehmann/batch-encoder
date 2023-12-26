import path from 'node:path';

import Bull from 'bull';
import Arena from 'bull-arena';
import express from 'express';

import { Encoder } from './src/encoder';
import { analyzeVideo, encodeVideo, replaceFile } from './src/queues';
import { host, port, redisServer } from './src/redis-server';

redisServer.then(() => {
  analyzeVideo.process(1, async (job) => {
    console.log(job.id, 'analyzeVideo start', JSON.stringify(job.data.file));
    try {
      const video = await Encoder.analyzeVideo(job.data.file);
      const crop = await Encoder.checkForCropping(job.data.file);
      encodeVideo.add({
        file: job.data.file,
        props: job.data.props,
        crop: crop,
        video: video,
      });
      console.log(job.id, 'analyzeVideo finish');
      return true;
    } catch (error) {
      console.error(job.id, 'analyzeVideo failed', error);
      // throw error;
    }
  });

  encodeVideo.process(2, async (job) => {
    console.log(job.id, 'encodeVideo start', job.data.file);
    try {
      const output = await Encoder.encodeVideo(job.data.file, job.data.crop, job.data.props, job.data.video, job);
      replaceFile.add({ file: job.data.file, final: output });
      console.log(job.id, 'encodeVideo finish');
      return true;
    } catch (error) {
      console.error(job.id, 'encodeVideo failed', error);
      // throw error;
    }
  });

  replaceFile.process(1, async (job) => {
    console.log(job.id, 'replaceFile start', job.data.file);
    const { file, final } = job.data;
    const extName = path.extname(file);
    const target = file.replace(new RegExp(`${extName}$`), '.mkv');
    try {
      await Encoder.unlink(file);
      await Encoder.copy(final, target);
      await Encoder.unlink(final);
      console.log(job.id, 'replaceFile finish');
    } catch (error) {
      console.error(job.id, 'replaceFile failed', error);
      // throw error;
    }
  });
});

const router = express.Router();
const arenaConfig = Arena(
  {
    Bull,
    queues: [
      {
        name: 'analyzeVideo',
        hostId: 'batchEncoder',
        redis: { host: host, port: Number(port) },
      },
      {
        name: 'encodeVideo',
        hostId: 'batchEncoder',
        redis: { host: host, port: Number(port) },
      },
      {
        name: 'muxVideo',
        hostId: 'batchEncoder',
        redis: { host: host, port: Number(port) },
      },
      {
        name: 'replaceFile',
        hostId: 'batchEncoder',
        redis: { host: host, port: Number(port) },
      },
    ],
  },
  {
    port: 8080,
  },
);
router.use(arenaConfig);
