import {
	getIcon,
	getLinkpath,
	MarkdownPostProcessorContext,
	MarkdownRenderChild,
	Notice,
	Plugin,
} from "obsidian";

import { AudioPlayerRenderer } from "./audioPlayerRenderer";
import { AudioChapter, AudioComment, PlayCommentCommand } from "./types";
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
class AudioPlayCommentComponent extends MarkdownRenderChild {
	playing = false;
	constructor(
		containerEl: HTMLElement,
		private playerId: string,
		private commentName: string,
		private stopPlaying: () => void
	) {
		super(containerEl);
	}

	onload(): void {
		const playEl = this.containerEl.createSpan();
		playEl.addClass("play-comment");
		const icon = this.playing ? getIcon("pause", 18) : getIcon("play", 18);
		if (icon) {
			playEl.appendChild(icon);
		}
		playEl.addEventListener("click", () => {
			if (this.playing) {
				this.stopPlaying();
				const icon = getIcon("play", 18);
				if (icon) {
					playEl.replaceChildren(icon);
				}
			} else {
				const icon = getIcon("pause", 18);
				if (icon) {
					playEl.replaceChildren(icon);
				}
				const playEvent = new CustomEvent(PlayCommentCommand, {
					detail: {
						playerId: this.playerId,
						comment: this.commentName,
					},
				});
				document.dispatchEvent(playEvent);
			}
			this.playing = !this.playing;
		});

		const playElContainer = this.containerEl.createDiv();
		playElContainer.addClass("play-comment-container");
		playElContainer.appendChild(playEl);
		this.containerEl.replaceWith(playElContainer);
	}
}

export default class AudioPlayer extends Plugin {
	player: HTMLAudioElement;

	onunload(): void {
		this.player.remove();
	}

	async onload() {
		this.player = document.createElement("audio");
		this.player.volume = 0.5;
		const body = document.getElementsByTagName("body")[0];
		body.appendChild(this.player);

		console.log(this.app.workspace.containerEl);

		this.addCommand({
			id: "pause-audio",
			name: "Pause Audio",
			callback: () => {
				new Notice("Audio paused");
				const ev = new Event("allpause");
				document.dispatchEvent(ev);
				this.player.pause();
			},
		});

		this.addCommand({
			id: "resume-audio",
			name: "Resume Audio",
			callback: () => {
				new Notice("Audio resumed");
				const ev = new Event("allresume");
				document.dispatchEvent(ev);
				if (this.player.src) this.player.play();
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
				if (this.player.src) this.player.currentTime += 5;
			},
		});

		this.addCommand({
			id: "audio-back-5s",
			name: "-5 sec",
			callback: () => {
				if (this.player.src) this.player.currentTime -= 5;
			},
		});

		this.registerObsidianProtocolHandler("audioplayer", (e) => {
			const parameters = e as {
				action: string;
				playerId?: string;
				chapter?: string;
			};
			if (e.das) {
				e.das;
			}
		});

		this.registerMarkdownPostProcessor((el, ctx) => {
			const linkTags = el.querySelectorAll("a");
			const audioPlayCommentLinkRe =
				/audioplayer:\/\/(?<playerId>.+):(?<commentName>.+)/g;

			linkTags.forEach((linkTag) => {
				const reResult = audioPlayCommentLinkRe.exec(linkTag.href);
				if (reResult?.groups) {
					const { playerId, commentName } = reResult.groups;
					const scopedPlayerId = ctx.docId + playerId;
					ctx.addChild(
						new AudioPlayCommentComponent(
							linkTag,
							scopedPlayerId,
							decodeURI(commentName),
							() => {
								new Notice("Audio paused");
								const ev = new Event("allpause");
								document.dispatchEvent(ev);
								this.player.pause();
							}
						)
					);
				}
			});
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
				if (audioParamsAndComments.length < 1) return;

				const audioParams = audioParamsAndComments[0].trim();
				let audioComments = "";
				if (audioParamsAndComments.length > 1) {
					audioComments = audioParamsAndComments[1].trim();
				}

				const playerIdRe = /id\:(.+)/g;
				const playerId =
					playerIdRe.exec(audioParams)?.at(1)?.trim() || "default";
				const scopedPlayerId = ctx.docId + playerId;

				const typeRe = /type\:(.+)/g;
				const type = (typeRe.exec(audioParams)?.at(1)?.trim() ||
					"default") as "small" | "default";

				const chapterRe =
					/chapter\:\s*(\d{2}:\d{2}:\d{2})\s*;\s*(\d{2}:\d{2}:\d{2})/g;
				const chapterCapture = chapterRe.exec(audioParams);

				let chapter: AudioChapter | undefined = undefined;
				if (chapterCapture && chapterCapture.length === 3) {
					chapter = {
						from: secondsToNumber(chapterCapture[1]),
						till: secondsToNumber(chapterCapture[2]),
					};
				}

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
							playerId: scopedPlayerId,
							player: this.player,
							chapter,
							type,
						})
					);
			}
		);
	}
}
