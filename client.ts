import fs from 'node:fs';
import path from 'node:path';

import minimist from 'minimist';

import { analyzeVideo } from './src/queues';
import { redisServer } from './src/redis-server';

const argv = minimist(process.argv.slice(3));

redisServer.then(() => {
  const folder = process.argv[2];

  const addPath = (pathName: string) => {
    return new Promise<void>((resolve, reject) => {
      const extName = path.extname(pathName);
      const stats = fs.lstatSync(pathName);
      if (stats.isDirectory()) {
        fs.readdir(pathName, (err, files) => {
          Promise.all(
            files.map((file) => {
              return addPath(path.join(pathName, file));
            }),
          ).then(() => resolve(), reject);
        });
      } else if (stats.isFile() && ['.mkv', '.mp4', '.avi', '.m4v'].indexOf(extName) >= 0) {
        console.log('add', pathName);
        analyzeVideo.add({ file: pathName, props: argv });
        resolve();
      } else {
        resolve();
      }
    });
  };

  const exit = () => {
    setTimeout(() => {
      process.exit();
    }, 1000);
  };

  if (folder) {
    addPath(folder).then(exit, exit);
  } else {
    process.exit();
  }
});
