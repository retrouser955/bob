![License](https://img.shields.io/github/license/brrrbot/bob)

**A (badly made) Discord music bot powered by Discord Player with support for Youtube & Spotify**

**Requirements:**
```
1. Node.js
2. npm
3. Discord bot token from Discord dev portal
4. API keys if applicable (Spotify keys from Spotify dev website)
5. ffmpeg and path to ffmpeg in system environment variables
6. yt-dlp & yt-dlp-rajiko installed for RadikoExtractor (using pip would be most convienient)
```

**How to use:**
```
1. clone this repo
2. *npm i
3. setup env and config files (add config files in /bot/src/commands/build -> colors.json && botDeco.json)
4. *npm run deploy-command
5. *npm run start
```

**env configuration: (seperate values with commas)**
```
TOKEN=bot-token(s)
CLIENT_IDS=discord-bot-user-id(s)
GUILD_IDS=server-id(s)
SPOTIFY_CLIENT_ID=spotify-client-id
SPOTIFY_CLIENT_SECRET=spotify-client-secret
```

**colors.json configuration**
```
{
  <source>: <color>,
  ...
}
```

**botDeco.json configuration**
```
{
  <bot_user_id>: {
    "color": <color>,
    "thumbnail": <thumbnail_url>
  },
  ...
}
```

**Commands:**
```
1. /play: Paste in URL
2. /search: Select source and input name of song (doesnt work for playlist)
```

**Credits:**
[@iTsMaaT](https://github.com/iTsMaaT) for Spotify extractor and bot code inspiration
[@retrouser955](https://github.com/retrouser955) for Youtubei extractor

**Built with:**
[discord.js](https://github.com/discordjs/discord.js)
[discord-player](https://github.com/Androz2091/discord-player)

**Retro's Notes**  
I am using this bot as a testing bot on Windows. Therefore, ffmpeg-static is installed. If you are gonna run this on a Linux machine, please just uninstall it and install FFmpeg.

Changes include:
- Using discord-player-youtubei
- Decoding using mediabunny (node-av) when possible
```powershell
> tasklist /FI "IMAGENAME eq ffmpeg.exe"
INFO: No tasks are running which match the specified criteria.
```