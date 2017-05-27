'use strict'

const http = require('http')
const https = require('https')
const assert = require('assert')

const _ = require('lodash')
const Base = require('grenache-nodejs-base')

class TransportRPCClient extends Base.TransportRPCClient {
  constructor (client, conf) {
    super(client, conf)

    this.conf = conf
    this.init()
  }

  init () {
    super.init()

    this.socket = this.getSocket(this.conf.secure)
  }

  getSocket (secure) {
    if (!secure) {
      return http
    }

    assert(Buffer.isBuffer(secure.key), 'conf.secure.key must be a Buffer')
    assert(Buffer.isBuffer(secure.cert), 'conf.secure.cert must be a Buffer')
    assert(Buffer.isBuffer(secure.ca), 'conf.secure.ca must be a Buffer')

    return https
  }

  getOpts (postData, opts, secure) {
    const def = {
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }

    if (!secure) {
      return _.extend(def, opts)
    }

    return _.extend(def, opts, secure)
  }

  request (key, payload, opts, cb) {
    this._request(key, payload, opts, cb)
  }

  sendRequest (req) {
    const [host, port] = this.conf.dest.split(':')
    const postData = this.format([req.rid, req.key, req.payload])

    this.post({
      hostname: host,
      port: port,
      timeout: req.opts.timeout
    }, postData, (err, body) => {
      if (err) {
        this.handleReply(req.rid, new Error('ERR_REQUEST_GENERIC'))
        return
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

  post (_opts, postData, _cb) {
    const socket = this.socket
    const opts = this.getOpts(postData, _opts, this.conf.secure)

    let isExecuted = false

    const cb = (err, body) => {
      if (isExecuted) return
      isExecuted = true
      _cb(err, body)
    }

    const req = socket.request(opts, (res) => {
      let body = []

      res.on('data', (chunk) => {
        body.push(chunk)
      })
      res.on('end', () => {
        body = body.join('')
        cb(null, body)
      })
    })

    req.on('error', (err) => {
      cb(err)
    })

    req.write(postData)
    req.end()
  }
}

module.exports = TransportRPCClient
