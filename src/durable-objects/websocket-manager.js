export class WebSocketManager {
  constructor(state, env) {
    this.state = state
    this.env = env
    this.sessions = []
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade')
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected websocket', { status: 400 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    server.accept()
    server.addEventListener('message', (event) => {
      server.send(`echo: ${event.data}`)
    })

    return new Response(null, { status: 101, webSocket: client })
  }
}
