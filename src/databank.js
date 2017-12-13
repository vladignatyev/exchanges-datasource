const debug = require('debug')('Databank')

const _ = require('lodash')
const Promise = require('bluebird')
const redis = require('redis')

Promise.promisifyAll(redis.RedisClient.prototype)
Promise.promisifyAll(redis.Multi.prototype)

// Example bank name: Bittrex/ETH_USD/Orderbook

const key = {
  BankCounter: (bankName) => { return `/${bankName}` },
  Datapoint: (bankName, counterVal) => { return `/${bankName}/${counterVal}` },
  DatapointTimestamp: (bankName, counterVal) => { return `/${bankName}/${counterVal}/time` }
}


class Databank {
  constructor (redisClient, bankName, ttlSeconds) {
    this.bankName = bankName || 'bank0'
    this.ttl = ttlSeconds
    this.redisClient = redisClient

    if (!redisClient) throw new Error(`Redis client is not specified.`)
  }

  newDataPoint(datapoint) {
    var bankName = this.bankName
    let redisClient = this.redisClient
    let ttl = this.ttl

    let datapointSerialized = JSON.stringify(datapoint)

    debug(`Datapoint received: ${datapointSerialized}`)

    return this.redisClient.incrAsync(key.BankCounter(bankName)).then((newCounterVal) => {
      debug(`Databank new counter ${newCounterVal}`)
      let timeAsUnixMillis = parseInt(((new Date()) * 1).toString())

      return redisClient.multi()
          .set(key.Datapoint(bankName, newCounterVal), datapointSerialized)
          .set(key.DatapointTimestamp(bankName, newCounterVal), timeAsUnixMillis)
          .expire(key.Datapoint(bankName, newCounterVal), ttl)
          .expire(key.DatapointTimestamp(bankName, newCounterVal), ttl)
          .execAsync()
          .then((result) => {
            if (_.every(result)) {
              return true
            } else {
              return false
            }
          }).catch((err) => {
            debug(`Error has occured while running Redis multi()`)
            debug(`   ${err}`)
            throw err
          })

    })
  }

  /**
   *
   * @return {Array} - an array of tuples like {Datapoint, Timestamp}
   */
  loadAvailableDataPoints(maxCount) {
    if (maxCount < 1) throw new Error('loadAvailableDataPoints expect 1 or more points to get')

    var bankName = this.bankName
    let _count = maxCount
    let redis = this.redisClient

    return redis.getAsync(key.BankCounter(bankName)).then((latestCounter) => {
      let bankCounterVals = _.map(new Array(_count), (val, index) => { return latestCounter - index })

      return Promise.all(_.flatMap(bankCounterVals, (counterVal) => {
        return [
          redis.getAsync(key.Datapoint(bankName, counterVal)).then((result) => {
            if (!result) throw new Error('No data.')
            return JSON.parse(result)
          }),
          redis.getAsync(key.DatapointTimestamp(bankName, counterVal)).then((result) => {
            if (!result) throw new Error('No data.')
            return parseInt(result)
          })
        ]
      })).catch((err) => {
        //pass
      })
    })
  }
}

module.exports = Databank
