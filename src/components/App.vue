<template>
	<div style="position: relative">
		<div class="audio-player-default" tabindex="0">
			<div
				:class="{
					'player-container-small': type === 'small',
					'player-container': type !== 'small',
				}"
			>
				<div class="controls">
					<div
						:class="{
							playpause: type === 'default',
							'playpause-small': type === 'small',
						}"
						@click="togglePlay"
						ref="playpause"
					/>
					<div v-if="type !== 'small'" class="title">
						{{ displayName }}
					</div>
				</div>
				<div class="spectrum">
					<div
						:class="{
							waveform: type === 'default',
							'waveform-small': type === 'small',
						}"
					>
						<div
							class="wv"
							v-for="(s, i) in normalizedPcmSamples"
							:key="fileIdentifier + i"
							:class="{ played: i < currentBar }"
							@mousedown="barMouseDownHandler(i)"
							:style="{
								height: s * 100 + '%',
							}"
						/>
					</div>
					<div class="timeline" v-if="type !== 'small'">
						<span class="current-time">
							{{ displayedCurrentTime }}
						</span>
						<span class="duration">
							{{ displayedDuration }}
						</span>
					</div>
				</div>
			</div>
		</div>
		<div class="comment-list" v-if="type !== 'small'">
			<AudioCommentVue
				v-for="cmt in commentsSorted"
				v-bind:class="{ 'active-comment': cmt == activeComment }"
				@play-from="playFrom"
				@move-playhead="setPlayheadSecs"
				:cmt="cmt"
				:key="cmt.timeString"
			></AudioCommentVue>
		</div>
	</div>
</template>

<script lang="ts">
import { TFile, setIcon } from "obsidian";
import { defineComponent, PropType, ref } from "vue";
import {
	AudioChapter,
	AudioComment,
	AudioPlayCommentEventPayload,
	PlayCommentCommand,
} from "../types";
import { secondsToString, secondsToNumber, hashCode } from "../utils";

import AudioCommentVue from "./AudioComment.vue";
import { type } from "os";

export default defineComponent({
	name: "App",
	components: {
		AudioCommentVue,
	},
	props: {
		title: { type: String, required: false },
		filepath: { type: String, required: true },
		type: { type: String, required: true },
		chapter: {
			type: Object as PropType<AudioChapter>,
			required: false,
		},
		comments: {
			type: Object as PropType<Array<AudioComment>>,
			required: true,
		},
		audio: {
			type: Object as PropType<HTMLAudioElement>,
			required: true,
		},
	},
	data() {
		return {
			toggle: false,
			items: [...Array(100).keys()],
			srcPath: "",

			normalizedPcmSamples: [] as number[],
			sampleResolution: 100,
			duration: 0,
			currentTime: 0,
			playing: false,
			button: undefined as HTMLSpanElement | undefined,

			clickCount: 0,
			newComment: "",
			activeComment: null as AudioComment | null,
		};
	},
	computed: {
		displayName() {
			return this.title ? this.title : this.filepath.split("/").at(-1);
		},
		fileIdentifier() {
			const chapterHash = hashCode(JSON.stringify(this.chapter) || "");
			return `${this.filepath}${chapterHash}`;
		},
		displayedCurrentTime() {
			return secondsToString(this.currentTime);
		},
		displayedDuration() {
			return secondsToString(this.chapterDuration);
		},
		currentBar() {
			const currentBar =
				((this.currentTime - (this.chapter?.from || 0)) /
					this.chapterDuration) *
				this.sampleResolution;
			return currentBar;
		},
		commentsSorted() {
			return this.comments.sort(
				(x: AudioComment, y: AudioComment) =>
					x.timeNumber - y.timeNumber
			);
		},
		chapterDuration() {
			return this.chapter
				? this.chapter.till - this.chapter.from
				: this.duration;
		},
	},
	methods: {
		isCurrent() {
			return this.audio.dataset.currentFI === this.fileIdentifier;
		},
		async loadFile() {
			// read file from vault
			const file = window.app.vault.getAbstractFileByPath(
				this.filepath
			) as TFile;

			// process audio file & set audio el source
			if (file && file instanceof TFile) {
				//check cached values
				if (!this.loadCache()) this.processAudio(file.path);

				this.srcPath = window.app.vault.getResourcePath(file);
			}
		},
		saveCache() {
			localStorage[this.fileIdentifier] = JSON.stringify(
				this.normalizedPcmSamples
			);
			localStorage[`${this.fileIdentifier}_duration`] = this.duration;
		},
		loadCache(): boolean {
			let cachedData = localStorage[this.fileIdentifier];
			let cachedDuration =
				localStorage[`${this.fileIdentifier}_duration`];

			if (!cachedData) {
				return false;
			}

			this.normalizedPcmSamples = JSON.parse(cachedData);
			this.duration = Number.parseFloat(cachedDuration);
			return true;
		},
		async processAudio(path: string) {
			const arrBuf = await window.app.vault.adapter.readBinary(path);
			const audioContext = new AudioContext();
			const tempArray: Array<number> = [];

			audioContext.decodeAudioData(arrBuf, (buf) => {
				let rawData = buf.getChannelData(0);
				this.duration = buf.duration;

				const sampleRate = buf.sampleRate;
				let chapterStartAtSample = Math.floor(
					this.chapter ? this.chapter.from * sampleRate : 0
				);
				let chapterEndAtSample = Math.floor(
					this.chapter
						? this.chapter.till * sampleRate
						: rawData.length
				);

				let chapterSampleCount =
					chapterEndAtSample - chapterStartAtSample;

				const blockSize = Math.floor(
					chapterSampleCount / this.sampleResolution
				);

				let highestSample = 0;
				for (let i = 0; i < this.sampleResolution; i++) {
					let blockStart = chapterStartAtSample + blockSize * i;
					let sum = 0;
					for (let j = 0; j < blockSize; j++) {
						sum += Math.abs(rawData[blockStart + j]);
					}
					const sample = sum / blockSize;
					tempArray.push(sample);
					if (sample > highestSample) {
						highestSample = sample;
					}
				}

				const normalizedPcmSamples = tempArray.map(
					(x) => x / highestSample
				);
				this.normalizedPcmSamples = normalizedPcmSamples;
				this.saveCache();
			});
		},
		barMouseDownHandler(i: number) {
			let time =
				(i / this.sampleResolution) * this.chapterDuration +
				(this.chapter?.from || 0);
			this.setPlayheadSecs(time);
		},
		playComment(comment: string) {
			const targetComment = this.comments.find(
				(c: AudioComment) => c.content === comment
			);
			if (targetComment) {
				this.playFrom(targetComment.timeNumber);
			}
		},
		playFrom(time: any) {
			this.setPlayheadSecs(time);
			this.play();
		},
		setPlayheadSecs(time: any) {
			this.currentTime = time;
			if (!this.isCurrent()) this.togglePlay();

			if (this.isCurrent()) {
				this.audio.currentTime = time;
			}
		},
		togglePlay() {
			if (this.playing) {
				this.pause();
			} else {
				this.play();
			}
		},
		play() {
			if (this.audio.dataset.currentFI !== this.fileIdentifier) {
				this.globalPause();
				this.audio.dataset.currentFI = this.fileIdentifier;
			}
			if (this.srcPath !== this.audio.src) {
				this.audio.src = this.srcPath;
			}
			if (this.currentTime > 0) {
				this.audio.currentTime = this.currentTime;
			} else {
				this.audio.currentTime = this.chapter ? this.chapter.from : 0;
			}
			this.audio.addEventListener("timeupdate", this.timeUpdateHandler);
			this.playing = true;
			this.setBtnIcon("pause");
			this.audio.play();
		},
		pause() {
			this.audio.pause();
			this.playing = false;
			this.setBtnIcon("play");
			this.audio.removeEventListener(
				"timeupdate",
				this.timeUpdateHandler
			);
		},
		globalPause() {
			this.playing = false;
			const ev = new Event("allpause");
			document.dispatchEvent(ev);
		},
		timeUpdateHandler() {
			if (this.isCurrent()) {
				this.currentTime = this.audio.currentTime;

				const nextComment = this.commentsSorted.filter(
					(x: AudioComment) => this.audio.currentTime >= x.timeNumber
				);

				if (nextComment.length == 1) {
					this.activeComment = nextComment[0];
				}
				if (nextComment.length > 1) {
					this.activeComment = nextComment[nextComment.length - 1];
				}

				if (this.chapter && this.currentTime > this.chapter.till) {
					this.pause();
					this.currentTime = this.chapter.from;
				}
			}
		},
		setBtnIcon(icon: string) {
			if (this.button) {
				setIcon(this.button, icon);
			}
		},
		allResumeListener() {
			if (this.isCurrent()) this.setBtnIcon("pause");
		},
		allPauseListener() {
			this.audio.pause();
			this.playing = false;
			this.setBtnIcon("play");
		},
		audioEndedListener() {
			if (this.audio.dataset.currentFI === this.fileIdentifier) {
				this.setBtnIcon("play");
				this.audio.pause();
				this.playing = false;

				if (this.chapter) {
					this.audio.currentTime = this.chapter.from;
				}
			}
		},
	},
	created() {
		this.loadFile();
	},
	mounted() {
		this.button = this.$refs.playpause as HTMLSpanElement;
		this.setBtnIcon("play");

		document.addEventListener("allpause", this.allPauseListener);
		document.addEventListener("allresume", this.allResumeListener);
		this.audio.addEventListener("ended", this.audioEndedListener);

		// get current time
		if (this.audio.dataset.currentFI === this.fileIdentifier) {
			this.currentTime = this.audio.currentTime;
			this.audio.addEventListener("timeupdate", this.timeUpdateHandler);
			this.setBtnIcon(this.audio.paused ? "play" : "pause");
		}
	},
	beforeUnmount() {
		this.audio.removeEventListener("ended", this.audioEndedListener);
		this.audio.addEventListener("timeupdate", this.timeUpdateHandler);
		document.removeEventListener("allpause", this.allPauseListener);
		document.removeEventListener("allresume", this.allResumeListener);
	},
	beforeDestroy() {},
});
</script>
