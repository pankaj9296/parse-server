'use strict';

const MongoStorageAdapter = require('../lib/Adapters/Storage/Mongo/MongoStorageAdapter')
  .default;
const { MongoClient } = require('mongodb');
const databaseURI =
  'mongodb://localhost:27017/parseServerMongoAdapterTestDatabase';
const request = require('../lib/request');
const Config = require('../lib/Config');
const TestUtils = require('../lib/TestUtils');

const fakeClient = {
  s: { options: { dbName: null } },
  db: () => null,
};

// These tests are specific to the mongo storage adapter + mongo storage format
// and will eventually be moved into their own repo
describe_only_db('mongo')('MongoStorageAdapter', () => {
  beforeEach(done => {
    new MongoStorageAdapter({ uri: databaseURI })
      .deleteAllClasses()
      .then(done, fail);
  });

  it('auto-escapes symbols in auth information', () => {
    spyOn(MongoClient, 'connect').and.returnValue(Promise.resolve(fakeClient));
    new MongoStorageAdapter({
      uri:
        'mongodb://user!with@+ symbols:password!with@+ symbols@localhost:1234/parse',
    }).connect();
    expect(MongoClient.connect).toHaveBeenCalledWith(
      'mongodb://user!with%40%2B%20symbols:password!with%40%2B%20symbols@localhost:1234/parse',
      jasmine.any(Object)
    );
  });

  it("doesn't double escape already URI-encoded information", () => {
    spyOn(MongoClient, 'connect').and.returnValue(Promise.resolve(fakeClient));
    new MongoStorageAdapter({
      uri:
        'mongodb://user!with%40%2B%20symbols:password!with%40%2B%20symbols@localhost:1234/parse',
    }).connect();
    expect(MongoClient.connect).toHaveBeenCalledWith(
      'mongodb://user!with%40%2B%20symbols:password!with%40%2B%20symbols@localhost:1234/parse',
      jasmine.any(Object)
    );
  });

  // https://github.com/parse-community/parse-server/pull/148#issuecomment-180407057
  it('preserves replica sets', () => {
    spyOn(MongoClient, 'connect').and.returnValue(Promise.resolve(fakeClient));
    new MongoStorageAdapter({
      uri:
        'mongodb://test:testpass@ds056315-a0.mongolab.com:59325,ds059315-a1.mongolab.com:59315/testDBname?replicaSet=rs-ds059415',
    }).connect();
    expect(MongoClient.connect).toHaveBeenCalledWith(
      'mongodb://test:testpass@ds056315-a0.mongolab.com:59325,ds059315-a1.mongolab.com:59315/testDBname?replicaSet=rs-ds059415',
      jasmine.any(Object)
    );
  });

  it('stores objectId in _id', done => {
    const adapter = new MongoStorageAdapter({ uri: databaseURI });
    adapter
      .createObject('Foo', { fields: {} }, { objectId: 'abcde' })
      .then(() => adapter._rawFind('Foo', {}))
      .then(results => {
        expect(results.length).toEqual(1);
        const obj = results[0];
        expect(obj._id).toEqual('abcde');
        expect(obj.objectId).toBeUndefined();
        done();
      });
  });

  it('find succeeds when query is within maxTimeMS', done => {
    const maxTimeMS = 250;
    const adapter = new MongoStorageAdapter({
      uri: databaseURI,
      mongoOptions: { maxTimeMS },
    });
    adapter
      .createObject('Foo', { fields: {} }, { objectId: 'abcde' })
      .then(() =>
        adapter._rawFind('Foo', { $where: `sleep(${maxTimeMS / 2})` })
      )
      .then(
        () => done(),
        err => {
          done.fail(`maxTimeMS should not affect fast queries ${err}`);
        }
      );
  });

  it('find fails when query exceeds maxTimeMS', done => {
    const maxTimeMS = 250;
    const adapter = new MongoStorageAdapter({
      uri: databaseURI,
      mongoOptions: { maxTimeMS },
    });
    adapter
      .createObject('Foo', { fields: {} }, { objectId: 'abcde' })
      .then(() =>
        adapter._rawFind('Foo', { $where: `sleep(${maxTimeMS * 2})` })
      )
      .then(
        () => {
          done.fail('Find succeeded despite taking too long!');
        },
        err => {
          expect(err.name).toEqual('MongoError');
          expect(err.code).toEqual(50);
          expect(err.message).toMatch('operation exceeded time limit');
          done();
        }
      );
  });

  it('stores pointers with a _p_ prefix', done => {
    const obj = {
      objectId: 'bar',
      aPointer: {
        __type: 'Pointer',
        className: 'JustThePointer',
        objectId: 'qwerty',
      },
    };
    const adapter = new MongoStorageAdapter({ uri: databaseURI });
    adapter
      .createObject(
        'APointerDarkly',
        {
          fields: {
            objectId: { type: 'String' },
            aPointer: { type: 'Pointer', targetClass: 'JustThePointer' },
          },
        },
        obj
      )
      .then(() => adapter._rawFind('APointerDarkly', {}))
      .then(results => {
        expect(results.length).toEqual(1);
        const output = results[0];
        expect(typeof output._id).toEqual('string');
        expect(typeof output._p_aPointer).toEqual('string');
        expect(output._p_aPointer).toEqual('JustThePointer$qwerty');
        expect(output.aPointer).toBeUndefined();
        done();
      });
  });

  it('handles object and subdocument', done => {
    const adapter = new MongoStorageAdapter({ uri: databaseURI });
    const schema = { fields: { subdoc: { type: 'Object' } } };
    const obj = { subdoc: { foo: 'bar', wu: 'tan' } };
    adapter
      .createObject('MyClass', schema, obj)
      .then(() => adapter._rawFind('MyClass', {}))
      .then(results => {
        expect(results.length).toEqual(1);
        const mob = results[0];
        expect(typeof mob.subdoc).toBe('object');
        expect(mob.subdoc.foo).toBe('bar');
        expect(mob.subdoc.wu).toBe('tan');
        const obj = { 'subdoc.wu': 'clan' };
        return adapter.findOneAndUpdate('MyClass', schema, {}, obj);
      })
      .then(() => adapter._rawFind('MyClass', {}))
      .then(results => {
        expect(results.length).toEqual(1);
        const mob = results[0];
        expect(typeof mob.subdoc).toBe('object');
        expect(mob.subdoc.foo).toBe('bar');
        expect(mob.subdoc.wu).toBe('clan');
        done();
      });
  });

  it('handles creating an array, object, date', done => {
    const adapter = new MongoStorageAdapter({ uri: databaseURI });
    const obj = {
      array: [1, 2, 3],
      object: { foo: 'bar' },
      date: {
        __type: 'Date',
        iso: '2016-05-26T20:55:01.154Z',
      },
    };
    const schema = {
      fields: {
        array: { type: 'Array' },
        object: { type: 'Object' },
        date: { type: 'Date' },
      },
    };
    adapter
      .createObject('MyClass', schema, obj)
      .then(() => adapter._rawFind('MyClass', {}))
      .then(results => {
        expect(results.length).toEqual(1);
        const mob = results[0];
        expect(mob.array instanceof Array).toBe(true);
        expect(typeof mob.object).toBe('object');
        expect(mob.date instanceof Date).toBe(true);
        return adapter.find('MyClass', schema, {}, {});
      })
      .then(results => {
        expect(results.length).toEqual(1);
        const mob = results[0];
        expect(mob.array instanceof Array).toBe(true);
        expect(typeof mob.object).toBe('object');
        expect(mob.date.__type).toBe('Date');
        expect(mob.date.iso).toBe('2016-05-26T20:55:01.154Z');
        done();
      })
      .catch(error => {
        console.log(error);
        fail();
        done();
      });
  });

  it('handles updating a single object with array, object date', done => {
    const adapter = new MongoStorageAdapter({ uri: databaseURI });

    const schema = {
      fields: {
        array: { type: 'Array' },
        object: { type: 'Object' },
        date: { type: 'Date' },
      },
    };

    adapter
      .createObject('MyClass', schema, {})
      .then(() => adapter._rawFind('MyClass', {}))
      .then(results => {
        expect(results.length).toEqual(1);
        const update = {
          array: [1, 2, 3],
          object: { foo: 'bar' },
          date: {
            __type: 'Date',
            iso: '2016-05-26T20:55:01.154Z',
          },
        };
        const query = {};
        return adapter.findOneAndUpdate('MyClass', schema, query, update);
      })
      .then(results => {
        const mob = results;
        expect(mob.array instanceof Array).toBe(true);
        expect(typeof mob.object).toBe('object');
        expect(mob.date.__type).toBe('Date');
        expect(mob.date.iso).toBe('2016-05-26T20:55:01.154Z');
        return adapter._rawFind('MyClass', {});
      })
      .then(results => {
        expect(results.length).toEqual(1);
        const mob = results[0];
        expect(mob.array instanceof Array).toBe(true);
        expect(typeof mob.object).toBe('object');
        expect(mob.date instanceof Date).toBe(true);
        done();
      })
      .catch(error => {
        console.log(error);
        fail();
        done();
      });
  });

  it('handleShutdown, close connection', done => {
    const adapter = new MongoStorageAdapter({ uri: databaseURI });

    const schema = {
      fields: {
        array: { type: 'Array' },
        object: { type: 'Object' },
        date: { type: 'Date' },
      },
    };

    adapter.createObject('MyClass', schema, {}).then(() => {
      expect(adapter.database.serverConfig.connections().length > 0).toEqual(
        true
      );
      expect(adapter.database.serverConfig.s.connected).toEqual(true);
      adapter.handleShutdown().then(() => {
        expect(adapter.database.serverConfig.connections().length > 0).toEqual(
          false
        );
        expect(adapter.database.serverConfig.s.connected).toEqual(false);
        done();
      });
    });
  });

  it('getClass if exists', async () => {
    const adapter = new MongoStorageAdapter({ uri: databaseURI });

    const schema = {
      fields: {
        array: { type: 'Array' },
        object: { type: 'Object' },
        date: { type: 'Date' },
      },
    };

    await adapter.createClass('MyClass', schema);
    const myClassSchema = await adapter.getClass('MyClass');
    expect(myClassSchema).toBeDefined();
  });

  it('getClass if not exists', async () => {
    const adapter = new MongoStorageAdapter({ uri: databaseURI });
    await expectAsync(adapter.getClass('UnknownClass')).toBeRejectedWith(
      undefined
    );
  });

  if (
    process.env.MONGODB_VERSION === '4.0.4' &&
    process.env.MONGODB_TOPOLOGY === 'replicaset' &&
    process.env.MONGODB_STORAGE_ENGINE === 'wiredTiger'
  ) {
    describe('transactions', () => {
      const headers = {
        'Content-Type': 'application/json',
        'X-Parse-Application-Id': 'test',
        'X-Parse-REST-API-Key': 'rest',
      };

      beforeAll(async () => {
        await reconfigureServer({
          databaseAdapter: undefined,
          databaseURI:
            'mongodb://localhost:27017/parseServerMongoAdapterTestDatabase?replicaSet=replicaset',
        });
      });

      beforeEach(async () => {
        await TestUtils.destroyAllDataPermanently(true);
      });

      it('should use transaction in a batch with transaction = true', async () => {
        const myObject = new Parse.Object('MyObject');
        await myObject.save();

        const databaseAdapter = Config.get(Parse.applicationId).database
          .adapter;
        spyOn(
          databaseAdapter.database.serverConfig,
          'command'
        ).and.callThrough();

        await request({
          method: 'POST',
          headers: headers,
          url: 'http://localhost:8378/1/batch',
          body: JSON.stringify({
            requests: [
              {
                method: 'PUT',
                path: '/1/classes/MyObject/' + myObject.id,
                body: { myAttribute: 'myValue' },
              },
            ],
            transaction: true,
          }),
        });

        let found = false;
        databaseAdapter.database.serverConfig.command.calls
          .all()
          .forEach(call => {
            found = true;
            expect(call.args[2].session.transaction.state).not.toBe(
              'NO_TRANSACTION'
            );
          });
        expect(found).toBe(true);
      });

      it('should not use transaction in a batch with transaction = false', async () => {
        const myObject = new Parse.Object('MyObject');
        await myObject.save();

        const databaseAdapter = Config.get(Parse.applicationId).database
          .adapter;
        spyOn(
          databaseAdapter.database.serverConfig,
          'command'
        ).and.callThrough();

        await request({
          method: 'POST',
          headers: headers,
          url: 'http://localhost:8378/1/batch',
          body: JSON.stringify({
            requests: [
              {
                method: 'PUT',
                path: '/1/classes/MyObject/' + myObject.id,
                body: { myAttribute: 'myValue' },
              },
            ],
            transaction: false,
          }),
        });

        let found = false;
        databaseAdapter.database.serverConfig.command.calls
          .all()
          .forEach(call => {
            found = true;
            expect(call.args[2].session).toBe(undefined);
          });
        expect(found).toBe(true);
      });

      it('should not use transaction in a batch with no transaction option sent', async () => {
        const myObject = new Parse.Object('MyObject');
        await myObject.save();

        const databaseAdapter = Config.get(Parse.applicationId).database
          .adapter;
        spyOn(
          databaseAdapter.database.serverConfig,
          'command'
        ).and.callThrough();

        await request({
          method: 'POST',
          headers: headers,
          url: 'http://localhost:8378/1/batch',
          body: JSON.stringify({
            requests: [
              {
                method: 'PUT',
                path: '/1/classes/MyObject/' + myObject.id,
                body: { myAttribute: 'myValue' },
              },
            ],
          }),
        });

        let found = false;
        databaseAdapter.database.serverConfig.command.calls
          .all()
          .forEach(call => {
            found = true;
            expect(call.args[2].session).toBe(undefined);
          });
        expect(found).toBe(true);
      });

      it('should not use transaction in a put request', async () => {
        const myObject = new Parse.Object('MyObject');
        await myObject.save();

        const databaseAdapter = Config.get(Parse.applicationId).database
          .adapter;
        spyOn(
          databaseAdapter.database.serverConfig,
          'command'
        ).and.callThrough();

        await request({
          method: 'PUT',
          headers: headers,
          url: 'http://localhost:8378/1/classes/MyObject/' + myObject.id,
          body: { myAttribute: 'myValue' },
        });

        let found = false;
        databaseAdapter.database.serverConfig.command.calls
          .all()
          .forEach(call => {
            found = true;
            expect(call.args[2].session).toBe(undefined);
          });
        expect(found).toBe(true);
      });

      it('should not use transaction when using the sdk', async () => {
        const databaseAdapter = Config.get(Parse.applicationId).database
          .adapter;
        spyOn(
          databaseAdapter.database.serverConfig,
          'command'
        ).and.callThrough();
        spyOn(
          databaseAdapter.database.serverConfig,
          'cursor'
        ).and.callThrough();
        spyOn(
          databaseAdapter.database.serverConfig,
          'update'
        ).and.callThrough();
        spyOn(
          databaseAdapter.database.serverConfig,
          'insert'
        ).and.callThrough();
        spyOn(
          databaseAdapter.database.serverConfig,
          'remove'
        ).and.callThrough();

        const myObject = new Parse.Object('MyObject');
        await myObject.save();

        myObject.set('myAttribute', 'myValue');
        await myObject.save();

        let found = false;
        databaseAdapter.database.serverConfig.command.calls
          .all()
          .forEach(call => {
            found = true;
            expect(call.args[2].session).toBe(undefined);
          });
        expect(found).toBe(true);
        databaseAdapter.database.serverConfig.cursor.calls
          .all()
          .forEach(call => {
            expect(call.args[2]).toBe(undefined);
          });
        databaseAdapter.database.serverConfig.insert.calls
          .all()
          .forEach(call => {
            expect(call.args[2].session.transaction.state).toBe(
              'NO_TRANSACTION'
            );
          });
        databaseAdapter.database.serverConfig.remove.calls
          .all()
          .forEach(call => {
            expect(call.args[2].session).toBe(undefined);
          });
        databaseAdapter.database.serverConfig.update.calls
          .all()
          .forEach(call => {
            expect(call.args[2].session.transaction.state).toBe(
              'NO_TRANSACTION'
            );
          });
      });
    });
  }
});
