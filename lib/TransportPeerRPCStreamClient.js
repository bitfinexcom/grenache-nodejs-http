'use strict'

const request = require('request')
const assert = require('assert')

const _ = require('lodash')
const Base = require('grenache-nodejs-base')

class TransportRPCStreamClient extends Base.TransportRPCClient {
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
      return request
    }

    assert(Buffer.isBuffer(secure.key), 'conf.secure.key must be a Buffer')
    assert(Buffer.isBuffer(secure.cert), 'conf.secure.cert must be a Buffer')
    assert(Buffer.isBuffer(secure.ca), 'conf.secure.ca must be a Buffer')

    return request
  }

  getOpts (opts, secure) {
    const u = secure
      ? ('https://' + this.conf.dest) : ('http://' + this.conf.dest)

    const def = {
      url: u,
      path: '/',
      method: 'POST'
    }

    if (!secure) {
      return _.extend(def, opts)
    }

    return _.extend(def, opts, secure)
  }

  request (key, payload, opts, cb) {
    return this._request(key, payload, opts, cb)
  }

  _request (key, payload, opts, cb) {
    const req = this.newRequest(key, payload, opts, cb)
    this.addRequest(req)
    return this.sendRequest(req)
  }

  sendRequest (req) {
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
        ...addHeaders
      },
      timeout: req.opts.timeout
    }

    const opts = this.getOpts(_opts, this.conf.secure)
    const stream = this.socket.post(opts)
    return stream
  }
}

module.exports = TransportRPCStreamClient
