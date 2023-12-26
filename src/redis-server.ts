import { spawn } from 'node:child_process';
import { Socket } from 'node:net';

export const host = process.env.REDIS_HOST ?? '127.0.0.1';
export const port = process.env.REDIS_PORT ?? '6379';

export const redisServer = new Promise<void>((resolve, reject) => {
  const client = new Socket();
  client.on('error', (e) => {
    const redisServer = spawn('redis-server');
    process.on('exit', () => {
      redisServer.kill();
    });
    console.log('start redis-server');
    resolve();
    //redisServer.stdout.on('data', (data) => { console.log(data.toString()) })
    //redisServer.stderr.on('data', (data) => { console.log(data.toString()) })
  });
  client.connect(Number(port), host, () => {
    console.log('Connected to redis server');
    client.end();
    resolve();
  });
});
