'use strict'

const { startGrapes, stopGrapes } = require('./helper')

const grapeTestCase = (grapeCallback) => (testBlock) => {
  return async (t) => {
    let teardown
    try {
      teardown = await _registerGrapes(grapeCallback)
      await testBlock(t)
    } finally {
      if (teardown) await teardown()
    }
  }
}

const _registerGrapes = async (cb) => {
  const grapes = await startGrapes()

  const announceTask = new Promise((resolve) => {
    grapes[0].once('announce', () => resolve())
  })
  const stop = await cb()
  await announceTask

  return async () => {
    await stop()
    await stopGrapes(grapes)
  }
}

module.exports = { grapeTestCase }
