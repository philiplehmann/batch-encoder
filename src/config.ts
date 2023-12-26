import { execSync } from 'node:child_process';
import { platform } from 'node:process';

const isWin = /^win/.test(platform);

const getConfig = async () => {
  return isWin ? import('./config_win') : import('./config_unix');
};

interface Codecs {
  h264: 'nvenc_h264' | 'h264';
  h265: 'nvenc_hevc' | 'hevc';
}

export class CodecError extends Error {
  constructor(message: string, public readonly codecs: Partial<Codecs>) {
    super(message);
    this.name = 'CodecError';
  }
}

export const binaries = getConfig().then((config) => config.binaries);
export const systemProperties = getConfig().then((config) => config.systemProperties);
export const codecs = binaries.then(async (bins): Promise<Codecs> => {
  const codecStr = execSync(`${bins.FFMPEG} -codecs`).toString();
  const codecs: Partial<Codecs> = {
    h264: codecStr.includes('nvenc_h264') ? 'nvenc_h264' : codecStr.includes('h264') ? 'h264' : undefined,
    h265: codecStr.includes('nvenc_hevc') ? 'nvenc_hevc' : codecStr.includes('hevc') ? 'hevc' : undefined,
  };
  if (!codecs.h264 || !codecs.h265) {
    throw new CodecError('codec missing', codecs);
  }
  return codecs as Codecs;
});
