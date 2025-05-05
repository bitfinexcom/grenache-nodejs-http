/* eslint-env mocha */

const assert = require('assert')
const fs = require('fs')
const path = require('path')
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

    peer = new PeerRPCClient(link, {
      secure: {
        key: fs.readFileSync(path.join(__dirname, './certs/client1-key.pem')),
        cert: fs.readFileSync(path.join(__dirname, './certs/client1-crt.pem')),
        ca: fs.readFileSync(path.join(__dirname, './certs/ca-crt.pem')),
        rejectUnauthorized: false // take care, can be dangerous in production!
      }
    })
    peer.init()

    peerSrv = new PeerRPCServer(link, {
      secure: {
        key: fs.readFileSync(path.join(__dirname, './certs/server-key.pem')),
        cert: fs.readFileSync(path.join(__dirname, './certs/server-crt.pem')),
        ca: fs.readFileSync(path.join(__dirname, './certs/ca-crt.pem')),
        requestCert: true,
        rejectUnauthorized: false // take care, can be dangerous in production!
      },
      timeout: 300000
    })

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
    service.on('request', (rid, key, payload, handler, cert) => {
      assert.ok(typeof rid === 'string')
      assert.strictEqual(key, 'rpc_test')
      assert.deepStrictEqual(payload, { hello: 'world' })
      assert.strictEqual(cert.fingerprint, 'E1:63:C1:46:B3:B6:46:3B:5E:92:98:34:40:A1:AB:FB:0E:92:D0:76')

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
    service.on('request', (rid, key, payload, handler, cert) => {
      assert.ok(typeof rid === 'string')
      assert.strictEqual(key, 'rpc_test')
      assert.strictEqual(payload, 'hello')
      assert.strictEqual(cert.fingerprint, 'E1:63:C1:46:B3:B6:46:3B:5E:92:98:34:40:A1:AB:FB:0E:92:D0:76')

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
