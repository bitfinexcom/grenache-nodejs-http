/* eslint-env mocha */

const assert = require('assert')
const { PassThrough } = require('stream')
const fs = require('fs')
const path = require('path')
const { PeerRPCClient, PeerRPCServer } = require('../')
const Link = require('grenache-nodejs-link')
const setupHooks = require('./before-after.js')

const PORT = 1337
let link, peer, peerSrvBuf, serviceBuf, stop
describe('RPC integration', () => {
  setupHooks((grapes) => {
    link = new Link({
      grape: 'http://127.0.0.1:30001'
    })
    link.start()

    peer = new PeerRPCClient(link, {})
    peer.init()

    peerSrvBuf = new PeerRPCServer(link, {
      timeout: 300000
    })

    peerSrvBuf.init()
    serviceBuf = peerSrvBuf.transport('buffered')
    serviceBuf.listen(PORT)

    link.announce('rpc_buf', serviceBuf.port, {}, (err, res) => {
      if (err) throw Error('error in announce, setup')
    })

    stop = () => {
      peer.stop()
      link.stop()
      serviceBuf.stop()
    }
  })

  it('buffered parsing works, objects', (done) => {
    serviceBuf.on('request', (rid, key, payload, handler, cert, meta) => {
      assert.ok(typeof rid === 'string')
      assert.strictEqual(key, 'rpc_buf')
      assert.deepStrictEqual(payload, { hello: 'world' })

      assert.strictEqual(meta.isStream, false)

      handler.reply(null, { hello: 'helloworld' })
    })

    const opts = { timeout: 100000 }
    peer.request('rpc_buf', { hello: 'world' }, opts, (err, result) => {
      if (err) throw err

      assert.deepStrictEqual(result, { hello: 'helloworld' })

      stop()
      done()
    })
  }).timeout(7000)

  it('buffered parsing works, strings', (done) => {
    serviceBuf.on('request', (rid, key, payload, handler, cert, meta) => {
      assert.ok(typeof rid === 'string')
      assert.strictEqual(key, 'rpc_buf')
      assert.strictEqual(payload, 'hello')

      assert.strictEqual(meta.isStream, false)

      handler.reply(null, 'world')
    })

    const opts = { timeout: 100000 }
    peer.request('rpc_buf', 'hello', opts, (err, result) => {
      if (err) throw err

      assert.strictEqual(result, 'world')

      stop()
      done()
    })
  }).timeout(7000)

  it('buffered parsing works, strings from streaming client', (done) => {
    serviceBuf.on('request', (rid, key, payload, handler, cert, meta) => {
      assert.ok(typeof rid === 'string')
      assert.strictEqual(key, 'rpc_buf')
      assert.strictEqual(payload, 'hello')

      assert.strictEqual(meta.isStream, true)

      handler.reply(null, 'world')
    })

    const req = peer.stream('rpc_buf', {
      timeout: 10000
    })

    req
      .on('data', (data) => {
        const d = JSON.parse(data.toString())
        // ["65c5737f-bbce-40f9-b48a-af8bd8869d66",null,"world"]
        assert.strictEqual(d[1], null)
        assert.strictEqual(d[2], 'world')
        stop()
        done()
      })
      .on('end', () => {})
      .on('error', (e) => { console.error(e) })

    const writable = new PassThrough()
    writable.write('["UUID", "rpc_buf", "hello"]')
    writable.end()
    writable.pipe(req)
  }).timeout(7000)

  it('buffered parsing works, objects from streaming client', (done) => {
    serviceBuf.on('request', (rid, key, payload, handler, cert, meta) => {
      assert.ok(typeof rid === 'string')
      assert.strictEqual(key, 'rpc_buf')
      assert.deepStrictEqual(payload, { hello: 'world' })

      assert.strictEqual(meta.isStream, true)

      handler.reply(null, { hello: 'helloworld' })
    })

    const req = peer.stream('rpc_buf', {
      timeout: 10000
    })

    req
      .on('data', (data) => {
        const d = JSON.parse(data.toString())
        assert.strictEqual(d[1], null)
        assert.deepStrictEqual(d[2], { hello: 'helloworld' })
        stop()
        done()
      })
      .on('end', () => {})
      .on('error', (e) => { console.error(e) })

    const writable = new PassThrough()
    writable.write('["UUID", "rpc_buf", { "hello": "world" }]')
    writable.end()
    writable.pipe(req)
  }).timeout(7000)

  it('buffered parsing works, extra headers', (done) => {
    serviceBuf.on('request', (rid, key, payload, handler, cert, meta) => {
      assert.ok(typeof rid === 'string')
      assert.strictEqual(key, 'rpc_buf')
      assert.deepStrictEqual(payload, { hello: 'world' })

      assert.strictEqual(meta.action, 'uploadPublic')
      assert.deepStrictEqual(meta.args, { foo: 'bar' })
      assert.strictEqual(meta.isStream, true)

      handler.reply(null, { hello: 'helloworld' })
    })

    const req = peer.stream('rpc_buf', {
      timeout: 10000,
      headers: { _a: 'uploadPublic', _ar: { foo: 'bar' } }
    })

    req
      .on('data', (data) => {
        const d = JSON.parse(data.toString())
        assert.strictEqual(d[1], null)
        assert.deepStrictEqual(d[2], { hello: 'helloworld' })
        stop()
        done()
      })
      .on('end', () => {})
      .on('error', (e) => { console.error(e) })

    const writable = new PassThrough()
    writable.write('["UUID", "rpc_buf", { "hello": "world" }]')
    writable.end()
    writable.pipe(req)
  }).timeout(7000)

  it('buf/buf: serialized files work', (done) => {
    serviceBuf.on('request', (rid, key, payload, handler, cert, meta) => {
      assert.ok(typeof rid === 'string')
      assert.strictEqual(key, 'rpc_buf')

      assert.strictEqual(payload.action, 'uploadPublic')
      assert.strictEqual(payload.args[1].key, 'example-amazon-dynamo-sosp2007-4.pdf')
      assert.strictEqual(typeof payload.args[0], 'string')

      assert.strictEqual(meta.isStream, false)

      handler.reply(null, 'ok')
    })

    const opts = { timeout: 100000 }
    const buf = fs.readFileSync(
      path.join(__dirname, './example-amazon-dynamo-sosp2007.pdf')
    )

    const optsPdf = {
      key: 'example-amazon-dynamo-sosp2007-4.pdf',
      acl: 'public-read',
      bucket: 'bfx-dev-robert',
      contentType: 'application/pdf'
    }

    const queryUploadPublicPdf = {
      action: 'uploadPublic',
      args: [buf.toString('hex'), optsPdf]
    }
    peer.request('rpc_buf', queryUploadPublicPdf, opts, (err, result) => {
      if (err) throw err

      assert.deepStrictEqual(result, 'ok')

      stop()
      done()
    })
  }).timeout(7000)
})
