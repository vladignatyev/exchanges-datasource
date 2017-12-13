#!coding:utf-8
import json
import redis


class DataBank(object):
    def __init__(self, bank_name, **kwargs):
        self.redis = redis.StrictRedis(**kwargs)
        self.bank = bank_name

    '''
    Generator that loads `max_count` available data points starting from last added
    '''
    def load_available_data_points(self, max_count):
        if max_count < 1:
            raise Exception('load_available_data_points expect 1 or more points to get')

        data_counter = int(self.redis.get(self._key_bankcounter()))

        if data_counter is None:
            return

        for i in range(max_count):
            k = data_counter - i
            datapoint = self.redis.get(self._key_datapoint(k))
            timestamp = self.redis.get(self._key_datapoint_timestamp(k))
            if datapoint is not None:
                datapoint_obj = json.loads(datapoint)
                yield datapoint_obj, timestamp
            else:
                return


    def _key_bankcounter(self):
        return "/%s" % self.bank
    def _key_datapoint(self, counter_val):
        assert int(counter_val) == counter_val  # type check
        return "/%s/%s" % (self.bank, counter_val)
    def _key_datapoint_timestamp(self, counter_val):
        assert int(counter_val) == counter_val  # type check
        return "/%s/%s/time" % (self.bank, counter_val)


if __name__ == '__main__':
    db = DataBank('BTC-ETH', host='localhost', port=6379)
    for datapoint, db_timestamp in db.load_available_data_points(5):
        print datapoint, db_timestamp
