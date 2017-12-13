const Promise = require('bluebird')
const Redis = require('redis')
const Databank = require('../src/databank')

Promise.promisifyAll(Redis.RedisClient.prototype)
Promise.promisifyAll(Redis.Multi.prototype)

const redis = Redis.createClient('redis://localhost:6379')

// let db = new Databank(redis, 'test', 3600 * 24 * 5)
//
// db.newDataPoint({'test': 1}).then((result) => {
//   console.log(`Result: ${result}`);
// })
//
// db.loadAvailableDataPoints(5).then((tuplesWithData) => {
//   console.log(tuplesWithData);
//   process.exit(0)
// })


let db = new Databank(redis, 'USDT-BTC', 3600 * 24 * 5)

db.loadAvailableDataPoints(5).then((tuplesWithData) => {
  console.log(tuplesWithData);
  process.exit(0)
})
