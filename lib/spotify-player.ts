export function initSpotifyPlayer(token: string, onReady: (deviceId: string) => void, onStateChange: (state: any) => void) {
  const script = document.createElement('script')
  script.src = 'https://sdk.scdn.co/spotify-player.js'
  document.body.appendChild(script)

  window.onSpotifyWebPlaybackSDKReady = () => {
    const player = new window.Spotify.Player({
      name: 'Artist Rabbit Hole Room',
      getOAuthToken: (cb: (token: string) => void) => cb(token),
      volume: 0.8
    })

    player.addListener('ready', ({ device_id }: { device_id: string }) => {
      onReady(device_id)
    })

    player.addListener('player_state_changed', onStateChange)
    player.connect()
    return player
  }
}
