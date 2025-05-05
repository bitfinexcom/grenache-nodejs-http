/* eslint-env mocha */

const assert = require('assert')
const { PeerRPCClient, PeerRPCServer } = require('../')
const Link = require('grenache-nodejs-link')
const setupHooks = require('./before-after.js')

const PORT = 1337
let link, peer, peerSrv, service, stop
describe('RPC integration', () => {
  setupHooks((grapes) => {
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

    link.announce('rpc_test', service.port, {}, (err, res) => {
      if (err) throw Error('error in announce, setup')
    })

    stop = () => {
      peer.stop()
      link.stop()
      service.stop()
    }
  })

  it('secure request, objects', (done) => {
    service.on('request', (rid, key, payload, handler) => {
      assert.ok(typeof rid === 'string')
      assert.strictEqual(key, 'rpc_test')
      assert.deepStrictEqual(payload, { hello: 'world' })

      handler.reply(null, { hello: 'helloworld' })
    })

    const opts = { timeout: 100000 }
    peer.request('rpc_test', { hello: 'world' }, opts, (err, result) => {
      if (err) throw err

      assert.deepStrictEqual(result, { hello: 'helloworld' })

      stop()
      done()
    })
  }).timeout(7000)

  it('secure map, strings', (done) => {
    service.on('request', (rid, key, payload, handler) => {
      assert.ok(typeof rid === 'string')
      assert.strictEqual(key, 'rpc_test')
      assert.strictEqual(payload, 'hello')

      handler.reply(null, 'world')
    })

    const opts = { timeout: 100000 }
    peer.map('rpc_test', 'hello', opts, (err, result) => {
      if (err) throw err

      assert.deepStrictEqual(result, ['world'])

      stop()
      done()
    })
  }).timeout(7000)
})
