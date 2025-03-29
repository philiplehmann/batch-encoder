import { execSync } from 'node:child_process';

const which = (command: string): string => {
  return execSync(`which ${command}`).toString().trim();
};

export const binaries = {
  FFMPEG: which('ffmpeg'),
  FFPROBE: which('ffprobe'),
  MKVMERGE: which('mkvmerge'),
};
export const systemProperties = {
  preset: 'slow',
};
