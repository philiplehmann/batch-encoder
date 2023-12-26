import { dirname, join } from 'node:path';

const ROOT_DIR = dirname(__dirname);

export const binaries = {
  FFMPEG: join(ROOT_DIR, 'bin', 'ffmpeg.exe'),
  FFPROBE: join(ROOT_DIR, 'bin', 'ffprobe.exe'),
  MKVMERGE: join(ROOT_DIR, 'bin', 'mkvmerge.exe'),
};
export const systemProperties = {
  preset: 'hq',
  tier: 'high',
};
