const spawn = require('child_process').spawn
const net = require('net')

const host = '127.0.0.1'
const port = 6379

exports.host = host
exports.port = port

exports.redisServer = new Promise((resolve, reject) => {
  const client = new net.Socket()
  client.on('error', (e) => {
    const redisServer = spawn('redis-server')
    console.log('start redis-server')
    resolve()
    //redisServer.stdout.on('data', (data) => { console.log(data.toString()) })
    //redisServer.stderr.on('data', (data) => { console.log(data.toString()) })
  })
  client.connect(port, host, () => {
    console.log('Connected to redis server')
    client.end()
    resolve()
  })
})
