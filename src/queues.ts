import Queue from 'bull';

import { host, port } from './redis-server';

export const analyzeVideo = new Queue('analyzeVideo', { redis: { port: Number(port), host: host } });
export const encodeVideo = new Queue('encodeVideo', { redis: { port: Number(port), host: host } });
export const muxVideo = new Queue('muxVideo', { redis: { port: Number(port), host: host } });
export const replaceFile = new Queue('replaceFile', { redis: { port: Number(port), host: host } });
