import redis from 'redis';
import logger from '../../logger';

function debug() {
  logger.debug.apply(logger, ['RedisCacheAdapter', ...arguments]);
}

export class RedisCacheAdapter {

  constructor(ctx) {
    this.client = redis.createClient(ctx);
    this.p = Promise.resolve();
  }

  get(key) {
    debug('get', key);
    this.p = this.p.then(() => {
      return new Promise((resolve, _) => {
        this.client.get(key, function(err, res) {
          debug('-> get', key, res);
          if(!res) {
            return resolve(null);
          }
          resolve(JSON.parse(res));
        });
      });
    });
    return this.p;
  }

  getMany(keys) {
    debug('getMany', key);
    this.p = this.p.then(() => {
      return new Promise((resolve, _) => {
        this.client
          .multi(keys.map((key) => { return ['get', key]; }))
          .exec(function(err, res) {
            debug('-> getMany', keys, res);
            if (!res) {
              return resolve(null);
            }
            resolve(res.map((resItem) => { return resItem ? JSON.parse(resItem) : null; }));
          });
      });
    });
    return this.p;
  }

  put(key, value, ttl) {
    value = JSON.stringify(value);
    debug('put', key, value, ttl);
    this.p = this.p.then(() => {
      return new Promise((resolve, _) => {
        this.client.set(key, value, 'px', ttl, function(err, res) {
          resolve();
        });
      });
    });
    return this.p;
  }

  putMany(items, ttl) {
    values = {};
    command = [];
    for (var key in items) {
      values[key] = JSON.stringify(items[key]);
      command.push([
        'set',
        key,
        values[key],
        'px',
        ttl
      ]);
    }
    debug('putMany', values, ttl);
    this.p = this.p.then(() => {
      return new Promise((resolve, _) => {
        this.client
          .multi(command)
          .exec(function(err, res) {
            resolve();
          });
      });
    });
    return this.p;
  }

  del(key) {
    debug('del', key);
    this.p = this.p.then(() => {
      return new Promise((resolve, _) => {
        this.client.del(key, function(err, res) {
          resolve();
        });
      });
    });
    return this.p;
  }

  clear() {
    debug('clear');
    this.p = this.p.then(() => {
      return new Promise((resolve, _) => {
        this.client.flushall(function(err, res) {
          resolve();
        });
      });
    });
    return this.p;
  }
}

export default RedisCacheAdapter;