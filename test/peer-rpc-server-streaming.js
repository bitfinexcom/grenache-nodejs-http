'use strict'

const test = require('brittle')
const { PassThrough } = require('stream')
const { PeerRPCClient, PeerRPCServer } = require('../')
const Link = require('grenache-nodejs-link')
const { grapeTestCase } = require('./before-after')

const PORT = 1337
let link, peer, peerSrvStr, serviceStr

const grapeTest = grapeTestCase(() => {
  link = new Link({
    grape: 'http://127.0.0.1:30001'
  })
  link.start()

  peer = new PeerRPCClient(link, {})
  peer.init()

  peerSrvStr = new PeerRPCServer(link, {
    timeout: 300000,
    disableBuffered: true
  })

  peerSrvStr.init()
  serviceStr = peerSrvStr.transport('stream')
  serviceStr.listen(PORT)

  link.announce('rpc_stream', serviceStr.port, {}, (err) => {
    if (err) throw Error('error in announce, setup')
  })

  return () => {
    peer.stop()
    link.stop()
    serviceStr.stop()
  }
})

test('RPC integration', async (t) => {
  await t.test('streaming works, objects, buffered client, reply handler', { timeout: 7000 }, grapeTest(async (t) => {
    serviceStr.on('stream', (req, res, meta, handler) => {
      t.is(meta.isStream, false)

      req.on('data', (d) => {
        const [rid, key, args] = JSON.parse(d.toString())

        t.alike(args, { hello: 'world' })
        t.ok(typeof rid === 'string')
        t.is(key, 'rpc_stream')

        handler.reply(rid, null, { hello: 'helloworld' })
      })
    })

    const opts = { timeout: 100000 }
    await new Promise(resolve => {
      peer.request('rpc_stream', { hello: 'world' }, opts, (err, result) => {
        if (err) throw err
        t.alike(result, { hello: 'helloworld' })
        resolve()
      })
    })
  }))

  await t.test('streaming works, string, buffered client, reply handler', { timeout: 7000 }, grapeTest(async (t) => {
    serviceStr.on('stream', (req, res, meta, handler) => {
      t.is(meta.isStream, false)

      req.on('data', (d) => {
        const [rid, key, args] = JSON.parse(d.toString())

        t.is(args, 'hello')
        t.ok(typeof rid === 'string')
        t.is(key, 'rpc_stream')

        handler.reply(rid, null, 'world')
      })
    })

    const opts = { timeout: 100000 }
    await new Promise(resolve => {
      peer.request('rpc_stream', 'hello', opts, (err, result) => {
        if (err) throw err
        t.is(result, 'world')
        resolve()
      })
    })
  }))

  await t.test('streaming works, string, buffered client, stream sent back', { timeout: 7000 }, grapeTest(async (t) => {
    serviceStr.on('stream', (req, res, meta) => {
      t.is(meta.isStream, false)

      req.on('data', (d) => {
        const [rid, key, args] = JSON.parse(d.toString())

        t.is(args, 'hello')
        t.ok(typeof rid === 'string')
        t.is(key, 'rpc_stream')

        const writable = new PassThrough()
        const payload = JSON.stringify([rid, null, 'world2'])
        writable.pipe(res)
        writable.write(payload)
        writable.end()
      })
    })

    const opts = { timeout: 100000 }
    await new Promise(resolve => {
      peer.request('rpc_stream', 'hello', opts, (err, result) => {
        if (err) throw err
        t.is(result, 'world2')
        resolve()
      })
    })
  }))

  await t.test('streaming works, buffer, stream client, stream on server', { timeout: 7000 }, grapeTest(async (t) => {
    const reqPayload = Buffer.from('megalargefile')
    const resPayload = Buffer.from('superlargefile')

    serviceStr.on('stream', (req, res, meta) => {
      t.is(meta.isStream, true)

      req.on('data', (d) => {
        const [rid, key] = meta.infoHeaders

        t.ok(d.equals(reqPayload), 'received Buffer equals payload on server')

        t.ok(typeof rid === 'string')
        t.is(key, 'rpc_stream')

        const writable = new PassThrough()
        writable.pipe(res)
        writable.write(resPayload)
        writable.end()
      })
    })

    const req = peer.stream('rpc_stream', {
      timeout: 10000
    })

    const p = new Promise(resolve => {
      req
        .on('data', (data) => {
          t.ok(data.equals(resPayload), 'received Buffer equals payload on client')
          resolve()
        })
        .on('end', () => {})
        .on('error', (e) => { console.error(e) })
    })

    const writable = new PassThrough()
    writable.write(reqPayload)
    writable.pipe(req)

    await p
  }))

  await t.test('streaming works, buffer, stream client, stream on server, additional headers', { timeout: 7000 }, grapeTest(async (t) => {
    const reqPayload = Buffer.from('megalargefile')
    const resPayload = Buffer.from('superlargefile')

    serviceStr.on('stream', (req, res, meta) => {
      t.is(meta.isStream, true)

      req.on('data', (d) => {
        const [rid, key] = meta.infoHeaders

        t.ok(d.equals(reqPayload), 'received Buffer equals payload on server')

        t.ok(typeof rid === 'string')
        t.is(key, 'rpc_stream')

        t.is(meta.action, 'uploadPublic')
        t.is(meta.args.foo, 'bar')

        const writable = new PassThrough()
        writable.pipe(res)
        writable.write(resPayload)
        writable.end()
      })
    })

    const req = peer.stream('rpc_stream', {
      timeout: 10000,
      headers: {
        _a: 'uploadPublic',
        _ar: { foo: 'bar' }
      }
    })

    const p = new Promise(resolve => {
      req
        .on('data', (data) => {
          t.ok(data.equals(resPayload), 'received Buffer equals payload on client')
          resolve()
        })
        .on('end', () => {})
        .on('error', (e) => { console.error(e) })
    })

    const writable = new PassThrough()
    writable.write(reqPayload)
    writable.pipe(req)

    await p
  }))
})
