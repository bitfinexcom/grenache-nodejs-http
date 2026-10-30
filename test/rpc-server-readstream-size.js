'use strict'

const test = require('brittle')
const fs = require('fs')
const path = require('path')
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

  link.announce('rpc_manual', serviceStr.port, {}, (err) => {
    if (err) throw Error('error in announce, setup')
  })

  return () => {
    peer.stop()
    link.stop()
    serviceStr.stop()
  }
})

test('RPC integration', (t) => {
  const pdfFile = path.join(__dirname, './example-amazon-dynamo-sosp2007.pdf')

  t.test('manual request handling works', { timeout: 7000 }, grapeTest(async (t) => {
    serviceStr.on('stream', (req, res, meta, handler) => {
      t.is(meta.isStream, true)
      t.is(req.headers['content-type'], 'application/pdf')

      const rid = meta.infoHeaders[0]
      const writer = fs.createWriteStream('test.pdf')
      req.pipe(writer)

      writer.on('close', () => {
        const origStat = fs.statSync(pdfFile)
        const res = fs.statSync('test.pdf')
        t.is(res.size, origStat.size)

        handler.reply(rid, null, 'ok')
      })
    })

    const optsPdf = {
      key: 'example-amazon-dynamo-sosp2007-4.pdf',
      acl: 'public-read',
      bucket: 'BUCKET',
      contentType: 'application/pdf'
    }
    const req = peer.stream('rpc_manual', {
      headers: {
        _a: 'uploadNewPublicStream',
        _ar: optsPdf,
        'content-type': 'application/pdf'
      },
      timeout: 10000
    })

    const p = new Promise(resolve => {
      req.on('data', (data) => {
        const [,, msg] = JSON.parse(data.toString())
        t.is(msg, 'ok')
        resolve()
      })
    })

    const data = fs.createReadStream(pdfFile)

    data.pipe(req)

    await p
  }))
})
