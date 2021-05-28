/* eslint-env mocha */
'use strict'

const { expect } = require('aegir/utils/chai')
const { AbortController } = require('native-abort-controller')

const f = require('./utils/factory')()

describe('.pubsub', function () {
  this.timeout(20 * 1000)
  describe('.subscribe', () => {
    let ipfs
    let ctl

    beforeEach(async function () {
      this.timeout(30 * 1000) // slow CI

      ctl = await await f.spawn({
        args: '--enable-pubsub-experiment'
      })

      ipfs = ctl.api
    })

    afterEach(() => f.clean())

    it('.onError when connection is closed', async () => {
      const topic = 'gossipboom'
      let messageCount = 0
      let onError
      const error = new Promise(resolve => { onError = resolve })

      await ipfs.pubsub.subscribe(topic, message => {
        messageCount++

        if (messageCount === 2) {
          // Stop the daemon
          ctl.stop().catch()
        }
      }, {
        onError
      })

      await ipfs.pubsub.publish(topic, 'hello')
      await ipfs.pubsub.publish(topic, 'bye')

      await expect(error).to.eventually.be.fulfilled().and.to.be.instanceOf(Error)
    })

    it('does not call onError when aborted', async () => {
      const controller = new AbortController()
      const topic = 'gossipabort'
      const messages = []
      let onError
      let onReceived

      const received = new Promise(resolve => { onReceived = resolve })
      const error = new Promise(resolve => { onError = resolve })

      await ipfs.pubsub.subscribe(topic, message => {
        messages.push(message)
        if (messages.length === 2) {
          onReceived()
        }
      }, {
        onError,
        signal: controller.signal
      })

      await ipfs.pubsub.publish(topic, 'hello')
      await ipfs.pubsub.publish(topic, 'bye')

      await received
      controller.abort()

      // Stop the daemon
      await ctl.stop()
      // Just to make sure no error is caused by above line
      setTimeout(onError, 200, 'aborted')

      await expect(error).to.eventually.be.fulfilled().and.to.equal('aborted')
    })
  })
})
