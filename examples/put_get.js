'use strict'

const _ = require('lodash')
const Base = require('grenache-nodejs-base')
const Peer = require('./../lib/PeerRPC')

const link = new Base.Link({
  grape: 'ws://127.0.0.1:30002'
})
link.start()

setInterval(() => {
  let hash = null

  link.put({ v: 'hello world' }, (err, res) => {
    console.log('data saved to the DHT', err, res)
    if (!err) hash = res
  })

  if (hash) {
    link.get(hash, console.log)
  }
}, 2000)
