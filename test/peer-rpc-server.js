'use strict'

const test = require('brittle')
const { PeerRPCClient, PeerRPCServer } = require('../')
const Link = require('grenache-nodejs-link')
const { grapeTestCase } = require('./before-after')

const PORT = 1337
let link, peer, peerSrv, service

const grapeTest = grapeTestCase(() => {
  link = new Link({
    grape: 'http://127.0.0.1:30001'
  })
  link.start()

  peer = new PeerRPCClient(link, {})
  peer.init()

  peerSrv = new PeerRPCServer(link, { timeout: 300000 })

  peerSrv.init()
  service = peerSrv.transport('server')
  service.listen(PORT)

  link.announce('rpc_test', service.port, {}, (err) => {
    if (err) throw Error('error in announce, setup')
  })

  return () => {
    peer.stop()
    link.stop()
    service.stop()
  }
})

test('RPC integration', { timeout: 10000 }, async (t) => {
  await t.test('secure request, objects', { timeout: 7000 }, grapeTest(async (t) => {
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

  await t.test('secure map, strings', { timeout: 7000 }, grapeTest(async (t) => {
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
