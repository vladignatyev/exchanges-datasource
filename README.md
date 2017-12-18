# Usage guide

## Running local data collector
Prerequisites: Redis (any stable version supporting ```GET```, ```SET```, ```TTL```), Node (8+, tested on 8.5.0).
On OS X prerequisites could be installed using awesome ```brew``` package manager.

1. ```Download this package from GitHub```
2. ```npm install```
3. ```node bin/dataloader.js BTC-ETH BTC-LTC ... [any other pairs]```

In the ```config/default.json``` change ```concurrency``` to good value.
I.e. if the concurrency parameter is 5, and you provided 5 pairs, data for all pairs
will be extracted ~simultaneously.

Change ```lifetimeCycles``` parameter to the required number of iterations of loading data.
If you have this equal to ```10```, it means that every market you specified will be
requested 10 times in a loop and then the command ```node bin/dataloader.js ...``` will exit.

Please note, that ```dataloader.js``` designed to be ran by ```supervisord```.

## Accessing data using Python library
1. Build the pip package called `exchange-datasource` under the `./py/exchange-datasource` path with command: ```python setup.py sdist```
2. Install the package into your virtualenv from `./py/exchange-datasource/dist/exchange-datasource-0.1.tar.gz` using ```pip install <path to package>```
3. Add and install `redis` dependency into your project, then `from exchangedatasource import DataBank` and use `Databank` object as you like.
4. Following example will load latest 5 orderbooks for market `BTC-ETH` along with timestamps:
```
db = DataBank('BTC-ETH', host='localhost', port=6379)
for datapoint, db_timestamp in db.load_available_data_points(5):
    print datapoint, db_timestamp
```
5. Remember, that `Databank` contains 'datapoints'. They could be any possible objects encoded with JSON. For more info,
look at NodeJS source code in `databank.js`, `bin/dataloader.js` and so on.


## Accessing data using Node JS

The following example will load 5 recently obtained orderbooks for 'USDT-BTC' market.
Before running example, please launch ```dataloader.js``` with 'USDT-BTC' market as a parameter.

```
const Promise = require('bluebird')
const Redis = require('redis')
const Databank = require('../src/databank')

Promise.promisifyAll(Redis.RedisClient.prototype)
Promise.promisifyAll(Redis.Multi.prototype)

const redis = Redis.createClient('redis://localhost:6379')

let db = new Databank(redis, 'USDT-BTC', 3600 * 24 * 5)

db.loadAvailableDataPoints(5).then((tuplesWithData) => {
  console.log(tuplesWithData);
  process.exit(0)
})
```

The ```tuplesWithData``` will be an array: ```[orderbookObj, timestampMillis]```.
Here values correspond to:
1.  ```timestampMillis``` (```tuplesWithData[1]```) is the millisecond UNIX timestamp defined at the
moment of saving orderbook into the storage
2. ```orderbookObj``` (```tuplesWithData[0]```) is an object of the following scheme:
 ```
 orderbookObj = {
   t1: ...<int>,
   t2: ...<int>,
   o: ...<Orderbook>
 }
 ```
 where  t1 - UNIX timestamp milliseconds of the request being sent,
        t2 - UNIX timestamp of the moment, when the response has been fully loaded
        o  - an object with two fields 'BID' and 'ASK', every field contains and array of {'RATE': ..., 'QUANTITY': ...} objects.
