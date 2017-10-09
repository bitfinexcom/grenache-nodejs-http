'use strict'

const Grenache = require('./../')
const Link = require('grenache-nodejs-link')

const link = new Link({
  grape: 'http://127.0.0.1:30001'
})
link.start()

setInterval(() => {
  link.put({ v: 'hello world' }, (err, hash) => {
    console.log('data saved to the DHT', err, hash)
    if (hash) {
      link.get(hash, (err, res) => {
        console.log('data requested to the DHT', err, res)
      })
    }
  })
}, 2000)
