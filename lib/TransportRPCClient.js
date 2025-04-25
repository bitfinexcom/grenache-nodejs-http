'use strict'

const duplexify = require('duplexify')
const fetch = require('node-fetch')
const assert = require('assert')
const http = require('http')
const https = require('https')
const zlib = require('zlib')
const { PassThrough } = require('stream')

const Base = require('grenache-nodejs-base')

class TransportRPCClient extends Base.TransportRPCClient {
  constructor (client, conf) {
    super(client, conf)

    this.conf = conf
    this.init()
  }

  init () {
    super.init()

    if (this.conf.secure) {
      assert(Buffer.isBuffer(this.conf.secure.key), 'conf.secure.key must be a Buffer')
      assert(Buffer.isBuffer(this.conf.secure.cert), 'conf.secure.cert must be a Buffer')
      assert(Buffer.isBuffer(this.conf.secure.ca), 'conf.secure.ca must be a Buffer')
    }
  }

  getOpts (_opts, secure) {
    const u = secure
      ? ('https://' + this.conf.dest)
      : ('http://' + this.conf.dest)

    const def = {
      url: u,
      path: '/',
      method: 'POST'
    }

    const opts = { ...def, ..._opts }
    if (secure) {
      opts.agent = new https.Agent(secure)
    }

    return opts
  }

  request (key, payload, opts, cb) {
    this._request(key, payload, opts, cb)
  }

  async sendRequest (req) {
    let postData = this.format([req.rid, req.key, req.payload])
    const isCompress = req.opts.compress

    if (isCompress) {
      try {
        postData = await (new Promise((resolve, reject) => {
          zlib.gzip(postData, (err, res) => {
            if (err) {
              return reject(err)
            }

            resolve(res)
          })
        }))
      } catch (e) {
        this.handleReply(
          req.rid,
          new Error('ERR_REQUEST_ENCODING_COMPRESSION')
        )
      }
    }

    this.post({
      timeout: req.opts.timeout,
      body: postData,
      headers: {
        'grc-compress': isCompress ? 'gzip' : 'none'
      },
      encoding: null
    }, async (err, body) => {
      if (err) {
        this.handleReply(req.rid, new Error(`ERR_REQUEST_GENERIC: ${err.message}`))
        return
      }

      if (isCompress) {
        try {
          body = await new Promise((resolve, reject) => {
            zlib.gunzip(body, (err, res) => {
              if (err) {
                return reject(err)
              }

              resolve(res)
            })
          })
        } catch (e) {
          this.handleReply(
            req.rid,
            new Error('ERR_REPLY_ENCODING_COMPRESSION')
          )
          return
        }
      }

      const data = this.parse(body)

      if (!data) {
        this.handleReply(req.rid, new Error('ERR_REPLY_EMPTY'))
        return
      }

      const [rid, _err, res] = data
      this.handleReply(rid, _err ? new Error(_err) : null, res)
    })
  }

  async post (_opts, _cb) {
    const opts = this.getOpts(_opts, this.conf.secure)

    let isExecuted = false

    const cb = (err, body) => {
      if (isExecuted) return
      isExecuted = true
      _cb(err, body)
    }

    try {
      const resp = await fetch(opts.url, {
        ...opts,
        method: 'POST'
      })

      const body = await resp.buffer()

      if (!resp.ok) {
        const err = new Error(body)
        err.code = resp.status
        return cb(err)
      }

      return cb(null, body)
    } catch (err) {
      return cb(err)
    }
  }

  async requestStream (key, opts) {
    return this._requestStream(key, opts)
  }

  async sendRequestStream (req) {
    const addHeaders = {}
    const _h = req.opts.headers || {}
    Object.keys(_h).forEach((k) => {
      if (typeof _h[k] === 'string') {
        addHeaders[k] = _h[k]
        return
      }
      addHeaders[k] = JSON.stringify(_h[k])
    })

    const _opts = {
      headers: {
        _gr: this.format([req.rid, req.key]),
        connection: 'close',
        'transfer-encoding': 'chunked',
        ...addHeaders
      },
      timeout: req.opts.timeout
    }

    const opts = this.getOpts(_opts, this.conf.secure)

    // node-fetch does not support multiplex communication, no response is received until body is fully streamed
    const reqStream = new PassThrough()
    const resStream = new PassThrough()

    const url = new URL(opts.url)
    const httpReq = (this.conf.secure ? https : http).request({
      ...opts,
      hostname: url.hostname,
      port: url.port,
      protocol: url.protocol,
      path: url.pathname,
      method: 'POST'
    }, (res) => {
      res.pipe(resStream)
    })

    httpReq.on('error', (err) => {
      reqStream.destroy(err)
      resStream.destroy(err)
    })
    reqStream.pipe(httpReq)
    return duplexify(reqStream, resStream)
  }
}

module.exports = TransportRPCClient
