import {
	getLinkpath,
	MarkdownPostProcessorContext,
	Notice,
	Plugin,
} from "obsidian";

import { AudioPlayerRenderer } from "./audioPlayerRenderer";
import { AudioComment } from "./types";
import { secondsToNumber } from "./utils";

const parseComments = (commentSection: string): Array<AudioComment> => {
	const lines = commentSection.split("\n") as string[];
	const comments = lines.map((x, i) => {
		const split = x.split(" --- ");
		const timeStamp = secondsToNumber(split[0]);
		const cmt: AudioComment = {
			timeNumber: timeStamp,
			timeString: split[0],
			content: split[1],
			index: i,
		};
		return cmt;
	});
	return comments;
};

export default class AudioPlayer extends Plugin {
	async onload() {
		const player = document.createElement("audio");
		player.volume = 0.5;
		const body = document.getElementsByTagName("body")[0];
		body.appendChild(player);

		this.addCommand({
			id: "pause-audio",
			name: "Pause Audio",
			callback: () => {
				new Notice("Audio paused");
				const ev = new Event("allpause");
				document.dispatchEvent(ev);
				player.pause();
			},
		});

		this.addCommand({
			id: "resume-audio",
			name: "Resume Audio",
			callback: () => {
				new Notice("Audio resumed");
				const ev = new Event("allresume");
				document.dispatchEvent(ev);
				if (player.src) player.play();
			},
		});

		this.addCommand({
			id: "add-audio-comment",
			name: "Add bookmark",
			callback: () => {
				const ev = new Event("addcomment");
				document.dispatchEvent(ev);
			},
		});

		this.addCommand({
			id: "audio-forward-5s",
			name: "+5 sec",
			callback: () => {
				if (player.src) player.currentTime += 5;
			},
		});

		this.addCommand({
			id: "audio-back-5s",
			name: "-5 sec",
			callback: () => {
				if (player.src) player.currentTime -= 5;
			},
		});

		this.registerMarkdownCodeBlockProcessor(
			"audio-player",
			(
				source: string,
				el: HTMLElement,
				ctx: MarkdownPostProcessorContext
			) => {
				// parse file name
				const audioParamsAndComments = source.split("\n\n");
				if (audioParamsAndComments.length < 2) return;

				const audioParams = audioParamsAndComments[0].trim();
				const audioComments = audioParamsAndComments[1].trim();

				const playerIdRe = /id\:(.+)/g;
				const playerId =
					playerIdRe.exec(audioParams)?.at(1)?.trim() || "default";

				const audioFileNameRe = /audio\:\s*\[\[(.+)\]\]/g;
				const audioFileName =
					audioFileNameRe.exec(audioParams)?.at(1) || null;

				if (!audioFileName) return;

				const allowedExtensions = [
					"mp3",
					"wav",
					"ogg",
					"flac",
					"mp4",
					"m4a",
				];
				const link = this.app.metadataCache.getFirstLinkpathDest(
					getLinkpath(audioFileName),
					audioFileName
				);
				if (!link || !allowedExtensions.includes(link.extension))
					return;

				// create root $el
				const container = el.createDiv();
				container.classList.add("base-container");

				const comments =
					//create vue app
					ctx.addChild(
						new AudioPlayerRenderer(el, {
							filepath: link.path,
							comments: parseComments(audioComments),
							playerId,
							player,
						})
					);
			}
		);
	}
}
