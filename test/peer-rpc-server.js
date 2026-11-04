'use strict'

const test = require('brittle')
const { rpcTestCase } = require('./before-after')

const rpcTest = rpcTestCase({ transport: 'server' })

test('RPC integration', { timeout: 10000 }, async (t) => {
  await t.test('secure request, objects', { timeout: 7000 }, rpcTest(async ({ t, service, peer }) => {
    service.on('request', (rid, key, payload, handler) => {
      t.ok(typeof rid === 'string')
      t.is(key, 'rpc_test')
      t.alike(payload, { hello: 'world' })

      handler.reply(null, { hello: 'helloworld' })
    })

    const opts = { timeout: 100000 }
    await new Promise(resolve => {
      peer.request('rpc_test', { hello: 'world' }, opts, (err, result) => {
        if (err) throw err
        t.alike(result, { hello: 'helloworld' })
        resolve()
      })
    })
  }))

  await t.test('secure map, strings', { timeout: 7000 }, rpcTest(async ({ t, service, peer }) => {
    service.on('request', (rid, key, payload, handler) => {
      t.ok(typeof rid === 'string')
      t.is(key, 'rpc_test')
      t.is(payload, 'hello')

      handler.reply(null, 'world')
    })

    const opts = { timeout: 100000 }
    await new Promise(resolve => {
      peer.map('rpc_test', 'hello', opts, (err, result) => {
        if (err) throw err
        t.alike(result, ['world'])
        resolve()
      })
    })
  }))
})
