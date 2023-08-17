# Obsidian Audio Player

-   one audio instance for the whole obsidian vault
-   easy to initialize
-   wave visualizer
-   keeps playing even if you've closed the tab
-   add bookmarks to your audio files
-   minimal version of player
-   chapter support, only play part of your audio file

## How to use

````
```audio-player
audio: [[my_audio.ogg]]
title: Yuru Talk 18

00:00:37 --- Section 1
00:02:42 --- Section 2
00:01:04 --- Section 3
```
````

![image](/preview/preview.png)

### Combine mini player with chapter support to only play part of the audio file

````
```audio-player
audio: [[my_audio.ogg]]
chapter: 00:00:37;00:01:06
type: small
```
````

this will only play the given chapter (00:00:37 - 00:01:06) of the given audio file.

![image](/preview/mini.png)

### Options

-   `audio` - Internal obsidian link to the audio file
-   `title` - Optional: Title to display
-   `type` - Optional: Set to 'small' for smaller player
-   `chapter` - Optional: Part of the audio to play

### Two simple Commands

accessable through command menu (Ctrl-P)

1. **Pause Audio** to pause whatever audio is playing
2. **Resume Audio** to resume

## Warning: VBR (variable bitrate) Audio files can desync

Audio files using VBR can desync the waveform with the played audio. If you can, use CBR for your audio files. See [here](https://terrillthompson.com/624) for more info.
