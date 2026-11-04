'use strict'

const test = require('brittle')
const fs = require('fs')
const path = require('path')
const { rpcTestCase } = require('./before-after')

const rpcTest = rpcTestCase({ transport: 'stream', disableBuffered: true })

test('RPC integration', (t) => {
  const pdfFile = path.join(__dirname, './example-amazon-dynamo-sosp2007.pdf')

  t.test('manual request handling works', { timeout: 7000 }, rpcTest(async ({ t, service, peer }) => {
    service.on('stream', (req, res, meta, handler) => {
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
    const req = peer.stream('rpc_test', {
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
