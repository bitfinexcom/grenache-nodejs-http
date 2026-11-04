'use strict'

const test = require('brittle')
const fs = require('fs')
const path = require('path')
const { rpcTestCase } = require('./before-after')

const rpcTest = rpcTestCase({ transport: 'stream', disableBuffered: true })

test('RPC integration', (t) => {
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

  t.test('manual request handling works', { timeout: 7000 }, rpcTest(async ({ t, service, peer }) => {
    service.on('stream', (req, res, meta) => {
      t.is(meta.isStream, false)

      if (meta.isStream === false) {
        // console.log('no stream content, decide to parse')
        service.handleBufferedRequest(req, res, meta)
      }
    })

    service.on('request', (rid, key, payload, handler, cert, meta) => {
      t.ok(typeof rid === 'string')
      t.is(key, 'rpc_test')
      const [pdf, opts] = payload.args
      t.alike(opts, optsPdf)

      t.alike([pdf[0], pdf[1], pdf[2]].join(''), '255')

      t.is(meta.isStream, false)
      handler.reply(null, 'ok')
    })

    const opts = { timeout: 100000 }
    await new Promise(resolve => {
      peer.request('rpc_test', queryUploadPublicPdf, opts, (err, result) => {
        if (err) throw err
        t.alike(result, 'ok')
        resolve()
      })
    })
  }))
})
