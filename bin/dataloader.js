const _ = require('lodash')
const Promise = require('bluebird')

const Redis = require('redis')
const config = require('config')
const debug = require('debug')('Dataloader')

const Bittrex = require('../src/providers/bittrex')

const Queue = require('promise-queue')

const Databank = require('../src/databank')

Promise.promisifyAll(Redis.RedisClient.prototype)
Promise.promisifyAll(Redis.Multi.prototype)



let marketNames = process.argv.slice(2)
let ttlSeconds = config.ttlSeconds


if (marketNames.length === 0) {
  throw new Error('Expected at least one market.')
}


let q = new Queue(config.concurrency, Infinity)  // endless queue with 'concurrency' concurrent workers

let redis = Redis.createClient(config.redis.url, {
    retry_strategy: function (options) {
        if (options.error && options.error.code === 'ECONNREFUSED') {
            // End reconnecting on a specific error and flush all commands with
            // a individual error
            return new Error('The server refused the connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
            // End reconnecting after a specific timeout and flush all commands
            // with a individual error
            return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
            // End reconnecting with built in error
            return undefined;
        }
        // reconnect after
        return Math.min(options.attempt * 100, 3000);
    }
})


function fillUpTheQueue(q) {
  debug(`Filling up the queue...`)
  _.map(marketNames, (marketName) => {
    debug(`Accessing market ${marketName}`)
    let _marketName = marketName
    q.add(() => {
      let beforeSendRequest = parseInt(((new Date()) * 1).toString())
      return Bittrex.getOrderBook(_marketName).then((orderBookData) => {
        let afterSendRequest = parseInt(((new Date()) * 1).toString())

        debug(`Received orderbook, it took ${afterSendRequest - beforeSendRequest}ms. It contains ${orderBookData['BID'].length} "bid" items.`)

        let datapoint = {
          'o': orderBookData,
          't1': beforeSendRequest,
          't2': afterSendRequest
        }


        let bank = new Databank(redis, marketName, ttlSeconds)
        return bank.newDataPoint(datapoint)
      }).catch((err) => {
        debug(err)
      })
    })
  })
}

let lifetimeCyclesToGo = config.lifetimeCycles

setInterval(() => {
  if (q.getPendingLength() === 0) {
    if (lifetimeCyclesToGo > 0) {
      fillUpTheQueue(q)
      lifetimeCyclesToGo--
    } else {
      q.add(() => {
        process.exit(0)
      })
    }
  }
}, 100)
