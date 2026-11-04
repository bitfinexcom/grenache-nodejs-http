'use strict'

const test = require('brittle')
const { rpcTestCase } = require('./before-after')

const rpcTest = rpcTestCase({ transport: 'server', isSecure: true })

test('RPC integration', async (t) => {
  await t.test('secure request, objects', { timeout: 7000 }, rpcTest(async ({ t, service, peer }) => {
    service.on('request', (rid, key, payload, handler, cert) => {
      t.ok(typeof rid === 'string')
      t.is(key, 'rpc_test')
      t.alike(payload, { hello: 'world' })
      t.is(cert.fingerprint, 'E1:63:C1:46:B3:B6:46:3B:5E:92:98:34:40:A1:AB:FB:0E:92:D0:76')

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
    service.on('request', (rid, key, payload, handler, cert) => {
      t.ok(typeof rid === 'string')
      t.is(key, 'rpc_test')
      t.is(payload, 'hello')
      t.is(cert.fingerprint, 'E1:63:C1:46:B3:B6:46:3B:5E:92:98:34:40:A1:AB:FB:0E:92:D0:76')

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
